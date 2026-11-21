/**
 * CAPSTONE-102: project disputes (team, review, IP and funding).
 * Claims, responses, evidence references, deadlines, reasoned outcomes,
 * appeals and idempotent remedies. No private payloads are stored here.
 */
import {
  auditEvent, authorize, fail, ok, replay, tenantGuard, versionGuard,
  INTEGRITY_ERRORS, type IntegrityActor, type IntegrityAggregate, type IntegrityResult,
} from './shared';

export const DISPUTE_TYPES = ['team', 'review', 'ip', 'funding'] as const;
export type DisputeType = (typeof DISPUTE_TYPES)[number];
export type DisputeStatus = 'open' | 'responded' | 'evidence_due' | 'decided' | 'appealed' | 'remedied' | 'rejected';

export interface DisputeResponse {
  actorId: string;
  reasonCode: string;
  at: string;
}

export interface ProjectDispute extends IntegrityAggregate {
  id: string;
  projectId: string;
  type: DisputeType;
  claimantId: string;
  respondentId?: string;
  status: DisputeStatus;
  reasonCode: string;
  evidenceRefs: readonly string[];
  responseDeadline: string;
  appealDeadline?: string;
  responses: readonly DisputeResponse[];
  outcome?: { reasonCode: string; remedyCode: string; decidedBy: string; decidedAt: string };
  appeal?: { reasonCode: string; by: string; at: string };
  remedy?: { remedyCode: string; requestId: string; appliedBy: string; at: string };
}

export type DisputeLedger = Map<string, IntegrityResult<ProjectDispute>>;

const validRef = (ref: string) => /^ev_[A-Za-z0-9_-]+$/.test(ref);
const after = (value: string, now: string) => Number.isFinite(Date.parse(value)) && Date.parse(value) > Date.parse(now);

/** Public projection omits evidence references and private party negotiation text. */
export function publicDispute(dispute: ProjectDispute): Omit<ProjectDispute, 'evidenceRefs'> {
  const { evidenceRefs: _refs, ...safe } = dispute;
  return safe;
}

export function fileDispute(
  actor: IntegrityActor,
  input: {
    requestId: string; projectId: string; type: DisputeType; respondentId?: string; reasonCode: string;
    evidenceRefs: readonly string[]; responseDeadline: string; appealDeadline?: string; now: string;
  },
  ledger: DisputeLedger = new Map(),
): IntegrityResult<ProjectDispute> {
  const denied = authorize(actor, 'integrity:disputes:file');
  if (denied) return denied;
  return replay(ledger, input.requestId, () => {
    if (!input.projectId || !DISPUTE_TYPES.includes(input.type) || !input.reasonCode.trim()) {
      return fail(INTEGRITY_ERRORS.VALIDATION_FAILED, 'A project, dispute type and reason code are required.');
    }
    if (input.evidenceRefs.some((ref) => !validRef(ref)) || input.evidenceRefs.length > 20) {
      return fail(INTEGRITY_ERRORS.VALIDATION_FAILED, 'Evidence must use opaque references (at most 20).');
    }
    if (!after(input.responseDeadline, input.now) || (input.appealDeadline && !after(input.appealDeadline, input.now))) {
      return fail(INTEGRITY_ERRORS.VALIDATION_FAILED, 'Deadlines must be in the future.');
    }
    const dispute: ProjectDispute = {
      id: `dsp_${input.requestId}`, tenantId: actor.tenantId, projectId: input.projectId,
      type: input.type, claimantId: actor.actorId, respondentId: input.respondentId,
      status: 'open', reasonCode: input.reasonCode, evidenceRefs: input.evidenceRefs,
      responseDeadline: input.responseDeadline, appealDeadline: input.appealDeadline,
      responses: [], revision: 1,
    };
    void auditEvent('dispute_filed', actor, dispute.id, { action: 'file', category: dispute.type, status: dispute.status, reasonCode: dispute.reasonCode });
    return ok(dispute);
  });
}

export function respondToDispute(
  actor: IntegrityActor,
  dispute: ProjectDispute | undefined,
  input: { requestId: string; expectedRevision: number; reasonCode: string; requestEvidence?: boolean; deadline?: string; now: string },
  ledger: DisputeLedger = new Map(),
): IntegrityResult<ProjectDispute> {
  const denied = authorize(actor, 'integrity:disputes:read');
  if (denied) return denied;
  const missing = tenantGuard(actor, dispute);
  if (missing) return missing;
  const stale = versionGuard(dispute, input.expectedRevision);
  if (stale) return stale;
  if (actor.actorId !== dispute.respondentId && !actor.permissions.includes('integrity:disputes:decide')) {
    return fail(INTEGRITY_ERRORS.FORBIDDEN, 'Only the respondent or an authorized reviewer can respond.');
  }
  if (!['open', 'evidence_due'].includes(dispute.status)) {
    return fail(INTEGRITY_ERRORS.INVALID_TRANSITION, 'This dispute is not awaiting a response.');
  }
  if (Date.parse(input.now) > Date.parse(dispute.responseDeadline)) {
    return fail(INTEGRITY_ERRORS.DEADLINE_PASSED, 'The response deadline has passed.');
  }
  return replay(ledger, input.requestId, () => {
    if (!input.reasonCode.trim()) return fail(INTEGRITY_ERRORS.VALIDATION_FAILED, 'A response reason code is required.');
    const status: DisputeStatus = input.requestEvidence ? 'evidence_due' : 'responded';
    const updated: ProjectDispute = {
      ...dispute, status, revision: dispute.revision + 1,
      ...(input.deadline ? { responseDeadline: input.deadline } : {}),
      responses: [...dispute.responses, { actorId: actor.actorId, reasonCode: input.reasonCode, at: input.now }],
    };
    void auditEvent('dispute_responded', actor, dispute.id, { action: 'respond', fromStatus: dispute.status, toStatus: status, reasonCode: input.reasonCode });
    return ok(updated);
  });
}

export function decideDispute(
  actor: IntegrityActor,
  dispute: ProjectDispute | undefined,
  input: { requestId: string; expectedRevision: number; reasonCode: string; remedyCode: string; now: string },
  ledger: DisputeLedger = new Map(),
): IntegrityResult<ProjectDispute> {
  const denied = authorize(actor, 'integrity:disputes:decide');
  if (denied) return denied;
  const missing = tenantGuard(actor, dispute);
  if (missing) return missing;
  const stale = versionGuard(dispute, input.expectedRevision);
  if (stale) return stale;
  if (!['responded', 'evidence_due', 'appealed'].includes(dispute.status)) {
    return fail(INTEGRITY_ERRORS.INVALID_TRANSITION, 'Only a dispute with a response or appeal can be decided.');
  }
  return replay(ledger, input.requestId, () => {
    if (!input.reasonCode.trim() || !input.remedyCode.trim()) {
      return fail(INTEGRITY_ERRORS.VALIDATION_FAILED, 'A reasoned outcome and remedy code are required.');
    }
    const updated: ProjectDispute = {
      ...dispute, status: 'decided', revision: dispute.revision + 1, appeal: undefined,
      outcome: { reasonCode: input.reasonCode, remedyCode: input.remedyCode, decidedBy: actor.actorId, decidedAt: input.now },
    };
    void auditEvent('dispute_decided', actor, dispute.id, { action: 'decide', toStatus: updated.status, reasonCode: input.reasonCode });
    return ok(updated);
  });
}

export function appealDispute(
  actor: IntegrityActor,
  dispute: ProjectDispute | undefined,
  input: { requestId: string; expectedRevision: number; reasonCode: string; now: string },
  ledger: DisputeLedger = new Map(),
): IntegrityResult<ProjectDispute> {
  const denied = authorize(actor, 'integrity:disputes:read');
  if (denied) return denied;
  const missing = tenantGuard(actor, dispute);
  if (missing) return missing;
  const stale = versionGuard(dispute, input.expectedRevision);
  if (stale) return stale;
  if (actor.actorId !== dispute.claimantId && actor.actorId !== dispute.respondentId) {
    return fail(INTEGRITY_ERRORS.FORBIDDEN, 'Only a party to the dispute can appeal.');
  }
  if (dispute.status !== 'decided') return fail(INTEGRITY_ERRORS.INVALID_TRANSITION, 'Only a decided dispute can be appealed.');
  if (!dispute.appealDeadline || Date.parse(input.now) > Date.parse(dispute.appealDeadline)) {
    return fail(INTEGRITY_ERRORS.DEADLINE_PASSED, 'The appeal window has closed.');
  }
  return replay(ledger, input.requestId, () => {
    if (!input.reasonCode.trim()) return fail(INTEGRITY_ERRORS.VALIDATION_FAILED, 'An appeal reason code is required.');
    const updated: ProjectDispute = {
      ...dispute, status: 'appealed', revision: dispute.revision + 1,
      appeal: { reasonCode: input.reasonCode, by: actor.actorId, at: input.now },
    };
    void auditEvent('dispute_appealed', actor, dispute.id, { action: 'appeal', toStatus: updated.status, reasonCode: input.reasonCode });
    return ok(updated);
  });
}

/** Remedy application is idempotent: a retry replays the original outcome. */
export function applyRemedy(
  actor: IntegrityActor,
  dispute: ProjectDispute | undefined,
  input: { requestId: string; expectedRevision: number; remedyCode: string; now: string },
  ledger: DisputeLedger = new Map(),
): IntegrityResult<ProjectDispute> {
  const denied = authorize(actor, 'integrity:disputes:decide');
  if (denied) return denied;
  const missing = tenantGuard(actor, dispute);
  if (missing) return missing;
  const stale = versionGuard(dispute, input.expectedRevision);
  if (stale) return stale;
  if (!['decided', 'appealed'].includes(dispute.status) || !dispute.outcome) {
    return fail(INTEGRITY_ERRORS.INVALID_TRANSITION, 'No decided remedy is available to apply.');
  }
  if (dispute.remedy) return ok(dispute, true);
  return replay(ledger, input.requestId, () => {
    if (input.remedyCode !== dispute.outcome?.remedyCode) {
      return fail(INTEGRITY_ERRORS.CONFLICT, 'The remedy does not match the recorded outcome.');
    }
    const updated: ProjectDispute = {
      ...dispute, status: 'remedied', revision: dispute.revision + 1,
      remedy: { remedyCode: input.remedyCode, requestId: input.requestId, appliedBy: actor.actorId, at: input.now },
    };
    void auditEvent('dispute_remedy_applied', actor, dispute.id, { action: 'remedy', toStatus: updated.status, reasonCode: input.remedyCode });
    return ok(updated);
  });
}
