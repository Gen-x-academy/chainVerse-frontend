/**
 * CAPSTONE-098: research ethics screening before activation or material change.
 * Screening decisions are versioned; a material change invalidates approval.
 */
import {
  auditEvent, authorize, fail, ok, replay, tenantGuard, versionGuard,
  INTEGRITY_ERRORS, type IntegrityActor, type IntegrityAggregate, type IntegrityResult,
} from './shared';

export type ScreeningStatus = 'draft' | 'screening' | 'pending_approval' | 'approved' | 'blocked' | 'superseded';
export type ApprovalPathway = 'exempt' | 'expedited' | 'full_board' | 'blocked';

export interface ScreeningFlags {
  humanSubjects: boolean;
  sensitiveData: boolean;
  fieldwork: boolean;
  dualUse: boolean;
  safetyConcerns: boolean;
  safetyMitigation?: boolean;
}

export interface EthicsScreening extends IntegrityAggregate {
  id: string;
  projectId: string;
  projectVersion: number;
  status: ScreeningStatus;
  flags: ScreeningFlags;
  pathway: ApprovalPathway;
  decision?: { outcome: 'approved' | 'rejected' | 'changes_required'; reasonCode: string; decidedBy: string; decidedAt: string };
}

export type ScreeningLedger = Map<string, IntegrityResult<EthicsScreening>>;

export const ALLOWED_SCREENING_TRANSITIONS: Record<ScreeningStatus, readonly ScreeningStatus[]> = {
  draft: ['screening'],
  screening: ['pending_approval', 'approved', 'blocked'],
  pending_approval: ['approved', 'blocked', 'screening'],
  approved: ['superseded'],
  blocked: [],
  superseded: [],
};

/** Required approval pathway; no private assessment text is retained. */
export function requiredPathway(flags: ScreeningFlags): ApprovalPathway {
  if (flags.dualUse && !flags.safetyMitigation) return 'blocked';
  if (flags.safetyConcerns && !flags.safetyMitigation) return 'full_board';
  if (flags.sensitiveData || flags.dualUse) return 'full_board';
  if (flags.humanSubjects || flags.fieldwork) return 'expedited';
  return 'exempt';
}

export function startScreening(
  actor: IntegrityActor,
  input: { requestId: string; projectId: string; projectVersion: number; flags: ScreeningFlags; now: string },
  ledger: ScreeningLedger = new Map(),
): IntegrityResult<EthicsScreening> {
  const denied = authorize(actor, 'integrity:screening:create');
  if (denied) return denied;
  return replay(ledger, input.requestId, () => {
    if (!input.projectId || !Number.isInteger(input.projectVersion) || input.projectVersion < 1) {
      return fail(INTEGRITY_ERRORS.VALIDATION_FAILED, 'A project and version are required.');
    }
    const pathway = requiredPathway(input.flags);
    const screening: EthicsScreening = {
      id: `scr_${input.requestId}`, tenantId: actor.tenantId, projectId: input.projectId,
      projectVersion: input.projectVersion, status: 'screening', flags: input.flags, pathway, revision: 1,
    };
    void auditEvent('screening_started', actor, screening.id, { action: 'start', status: screening.status, reasonCode: pathway });
    return ok(screening);
  });
}

export function submitAssessment(
  actor: IntegrityActor,
  screening: EthicsScreening | undefined,
  input: { requestId: string; expectedRevision: number; flags: ScreeningFlags; now: string },
  ledger: ScreeningLedger = new Map(),
): IntegrityResult<EthicsScreening> {
  const denied = authorize(actor, 'integrity:screening:create');
  if (denied) return denied;
  const missing = tenantGuard(actor, screening);
  if (missing) return missing;
  const stale = versionGuard(screening, input.expectedRevision);
  if (stale) return stale;
  if (!['draft', 'screening'].includes(screening.status)) {
    return fail(INTEGRITY_ERRORS.INVALID_TRANSITION, 'This screening has already been assessed.', ALLOWED_SCREENING_TRANSITIONS[screening.status]);
  }
  return replay(ledger, input.requestId, () => {
    const pathway = requiredPathway(input.flags);
    const status: ScreeningStatus = pathway === 'blocked' ? 'blocked' : pathway === 'exempt' ? 'approved' : 'pending_approval';
    const updated: EthicsScreening = {
      ...screening, flags: input.flags, pathway, status, revision: screening.revision + 1,
    };
    void auditEvent('screening_assessed', actor, screening.id, { action: 'assess', fromStatus: screening.status, toStatus: status, reasonCode: pathway });
    return ok(updated);
  });
}

export function decideScreening(
  actor: IntegrityActor,
  screening: EthicsScreening | undefined,
  input: { requestId: string; expectedRevision: number; outcome: 'approved' | 'rejected' | 'changes_required'; reasonCode: string; now: string },
  ledger: ScreeningLedger = new Map(),
): IntegrityResult<EthicsScreening> {
  const denied = authorize(actor, 'integrity:screening:decide');
  if (denied) return denied;
  const missing = tenantGuard(actor, screening);
  if (missing) return missing;
  const stale = versionGuard(screening, input.expectedRevision);
  if (stale) return stale;
  if (screening.status !== 'pending_approval') {
    return fail(INTEGRITY_ERRORS.INVALID_TRANSITION, 'Only a screening awaiting approval can be decided.', ALLOWED_SCREENING_TRANSITIONS[screening.status]);
  }
  return replay(ledger, input.requestId, () => {
    const status: ScreeningStatus =
      input.outcome === 'approved' ? 'approved' : input.outcome === 'rejected' ? 'blocked' : 'screening';
    const updated: EthicsScreening = {
      ...screening, status, revision: screening.revision + 1,
      decision: { outcome: input.outcome, reasonCode: input.reasonCode, decidedBy: actor.actorId, decidedAt: input.now },
    };
    void auditEvent('screening_decided', actor, screening.id, { action: 'decide', toStatus: status, reasonCode: input.reasonCode });
    return ok(updated);
  });
}

/** A material change requires a new version and invalidates the old approval. */
export function recordMaterialChange(
  actor: IntegrityActor,
  screening: EthicsScreening | undefined,
  input: { requestId: string; expectedRevision: number; projectVersion: number; now: string },
  ledger: ScreeningLedger = new Map(),
): IntegrityResult<EthicsScreening> {
  const denied = authorize(actor, 'integrity:screening:create');
  if (denied) return denied;
  const missing = tenantGuard(actor, screening);
  if (missing) return missing;
  const stale = versionGuard(screening, input.expectedRevision);
  if (stale) return stale;
  if (screening.status !== 'approved') {
    return fail(INTEGRITY_ERRORS.INVALID_TRANSITION, 'Only an approved screening can be superseded.');
  }
  return replay(ledger, input.requestId, () => {
    if (input.projectVersion <= screening.projectVersion) {
      return fail(INTEGRITY_ERRORS.CONFLICT, 'A material change needs a newer project version.');
    }
    const updated: EthicsScreening = {
      ...screening, status: 'screening', projectVersion: input.projectVersion, revision: screening.revision + 1,
      decision: undefined,
    };
    void auditEvent('screening_superseded', actor, screening.id, { action: 'material_change', toStatus: updated.status });
    return ok(updated);
  });
}
