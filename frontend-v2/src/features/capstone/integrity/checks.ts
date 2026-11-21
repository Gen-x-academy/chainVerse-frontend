/**
 * CAPSTONE-097: consent-aware originality and citation checks.
 *
 * Provider status is normalized into a provider-independent lifecycle. Scores
 * and excerpts stay in a restricted aggregate and are never placed in audit
 * events, public views, analytics, or URLs.
 */
import {
  auditEvent,
  authorize,
  fail,
  inTenant,
  ok,
  replay,
  tenantGuard,
  versionGuard,
  INTEGRITY_ERRORS,
  type IntegrityActor,
  type IntegrityAggregate,
  type IntegrityResult,
} from './shared';

export type CheckStatus =
  | 'draft'
  | 'queued'
  | 'running'
  | 'report_ready'
  | 'human_review'
  | 'completed'
  | 'failed';

export type ConsentScope = 'similarity' | 'citations' | 'both';

export interface RestrictedScores {
  /** 0..100, only exposed to authorized reviewers. */
  similarity: number;
  citationCoverage: number;
  excerptReferences: readonly string[];
}

export interface OriginalityCheck extends IntegrityAggregate {
  id: string;
  projectId: string;
  submissionVersionId: string;
  status: CheckStatus;
  consent?: { grantedBy: string; scope: ConsentScope; grantedAt: string };
  thresholds: { similarity: number; citationCoverage: number };
  /** Provider-independent status label; provider names are never surfaced. */
  providerStatus: 'not_requested' | 'pending' | 'processing' | 'ready' | 'error';
  scores?: RestrictedScores;
  decision?: { outcome: 'released' | 'escalated'; reasonCode: string; decidedBy: string; decidedAt: string };
}

export interface RequestCheckInput {
  requestId: string;
  projectId: string;
  submissionVersionId: string;
  expectedRevision?: number;
  consent: { granted: boolean; scope: ConsentScope; grantedBy: string };
  thresholds: { similarity: number; citationCoverage: number };
  now: string;
}

export type CheckLedger = Map<string, IntegrityResult<OriginalityCheck>>;

export const ALLOWED_CHECK_TRANSITIONS: Record<CheckStatus, readonly CheckStatus[]> = {
  draft: ['queued'],
  queued: ['running', 'failed'],
  running: ['report_ready', 'failed'],
  report_ready: ['human_review', 'completed'],
  human_review: ['completed'],
  completed: [],
  failed: ['queued'],
};

const inRange = (value: number) => Number.isFinite(value) && value >= 0 && value <= 100;

/** Public projection: restricted scores and excerpts are never returned. */
export function publicCheck(check: OriginalityCheck): Omit<OriginalityCheck, 'scores'> {
  const { scores: _scores, ...safe } = check;
  return safe;
}

export function needsHumanReview(check: OriginalityCheck): boolean {
  if (!check.scores) return false;
  return (
    check.scores.similarity >= check.thresholds.similarity ||
    check.scores.citationCoverage < check.thresholds.citationCoverage
  );
}

export function requestCheck(
  actor: IntegrityActor,
  existing: OriginalityCheck | undefined,
  input: RequestCheckInput,
  ledger: CheckLedger = new Map(),
): IntegrityResult<OriginalityCheck> {
  const denied = authorize(actor, 'integrity:checks:request');
  if (denied) return denied;
  if (existing) {
    const missing = tenantGuard(actor, existing);
    if (missing) return missing;
    if (input.expectedRevision !== undefined) {
      const stale = versionGuard(existing, input.expectedRevision);
      if (stale) return stale;
    }
    if (existing.submissionVersionId === input.submissionVersionId && ['queued', 'running'].includes(existing.status)) {
      return ok(existing, true);
    }
    if (!ALLOWED_CHECK_TRANSITIONS[existing.status].includes('queued')) {
      return fail(INTEGRITY_ERRORS.INVALID_TRANSITION, 'This submission version cannot be checked again.', ALLOWED_CHECK_TRANSITIONS[existing.status]);
    }
  }
  return replay(ledger, input.requestId, () => {
    if (!input.consent.granted || input.consent.grantedBy !== actor.actorId) {
      return fail(INTEGRITY_ERRORS.CONSENT_REQUIRED, 'Explicit consent from the submitter is required.');
    }
    if (
      !input.projectId ||
      !input.submissionVersionId ||
      !inRange(input.thresholds.similarity) ||
      !inRange(input.thresholds.citationCoverage) ||
      (input.consent.scope !== 'both' && input.consent.scope !== 'similarity' && input.consent.scope !== 'citations')
    ) {
      return fail(INTEGRITY_ERRORS.VALIDATION_FAILED, 'Check the consent scope and thresholds.');
    }
    if (existing && input.projectId !== existing.projectId) {
      return fail(INTEGRITY_ERRORS.TENANT_MISMATCH, 'The project does not match this check.');
    }
    const check: OriginalityCheck = {
      id: existing?.id ?? `chk_${input.requestId}`,
      tenantId: actor.tenantId,
      projectId: input.projectId,
      submissionVersionId: input.submissionVersionId,
      status: 'queued',
      revision: (existing?.revision ?? 0) + 1,
      consent: { grantedBy: actor.actorId, scope: input.consent.scope, grantedAt: input.now },
      thresholds: input.thresholds,
      providerStatus: 'pending',
    };
    void auditEvent('check_requested', actor, check.id, { action: 'request', status: check.status, reasonCode: input.consent.scope });
    return ok(check);
  });
}

export interface ProviderUpdateInput {
  requestId: string;
  expectedRevision: number;
  status: 'pending' | 'processing' | 'complete' | 'error';
  scores?: RestrictedScores;
  now: string;
}

/** Provider status is mapped once; callers never branch on a provider-specific value. */
export function normalizeProviderStatus(status: ProviderUpdateInput['status']): OriginalityCheck['providerStatus'] {
  return { pending: 'pending', processing: 'processing', complete: 'ready', error: 'error' }[status];
}

export function applyProviderUpdate(
  actor: IntegrityActor,
  check: OriginalityCheck | undefined,
  input: ProviderUpdateInput,
  ledger: CheckLedger = new Map(),
): IntegrityResult<OriginalityCheck> {
  const denied = authorize(actor, 'integrity:checks:ingest');
  if (denied) return denied;
  const missing = tenantGuard(actor, check);
  if (missing) return missing;
  const stale = versionGuard(check, input.expectedRevision);
  if (stale) return stale;
  if (!['queued', 'running'].includes(check.status)) {
    return fail(INTEGRITY_ERRORS.INVALID_TRANSITION, 'Results can only arrive for a running check.');
  }
  return replay(ledger, input.requestId, () => {
    const providerStatus = normalizeProviderStatus(input.status);
    if (providerStatus === 'error') {
      return ok({ ...check, status: 'failed', providerStatus, revision: check.revision + 1 });
    }
    if (providerStatus === 'pending' || providerStatus === 'processing') {
      return ok({ ...check, status: 'running', providerStatus, revision: check.revision + 1 });
    }
    if (!input.scores || !inRange(input.scores.similarity) || !inRange(input.scores.citationCoverage)) {
      return fail(INTEGRITY_ERRORS.VALIDATION_FAILED, 'A completed check requires scores in the 0..100 range.');
    }
    const updated: OriginalityCheck = {
      ...check,
      status: 'report_ready',
      providerStatus,
      scores: input.scores,
      revision: check.revision + 1,
    };
    void auditEvent('check_report_ready', actor, check.id, { action: 'ingest', status: updated.status });
    return ok(updated);
  });
}

export interface ReviewDecisionInput {
  requestId: string;
  expectedRevision: number;
  outcome: 'released' | 'escalated';
  reasonCode: string;
  now: string;
}

/** A human reviewer releases a restricted report or escalates it for review. */
export function decideCheck(
  actor: IntegrityActor,
  check: OriginalityCheck | undefined,
  input: ReviewDecisionInput,
  ledger: CheckLedger = new Map(),
): IntegrityResult<OriginalityCheck> {
  const denied = authorize(actor, 'integrity:checks:review');
  if (denied) return denied;
  const missing = tenantGuard(actor, check);
  if (missing) return missing;
  const stale = versionGuard(check, input.expectedRevision);
  if (stale) return stale;
  if (!['report_ready', 'human_review'].includes(check.status)) {
    return fail(INTEGRITY_ERRORS.INVALID_TRANSITION, 'Only a ready report can be reviewed.');
  }
  if (check.status === 'human_review' && input.outcome === 'escalated') {
    return fail(INTEGRITY_ERRORS.INVALID_TRANSITION, 'The check is already with human review.');
  }
  if (needsHumanReview(check) && input.outcome === 'released') {
    return fail(INTEGRITY_ERRORS.INVALID_TRANSITION, 'Threshold breach requires escalation to human review.');
  }
  return replay(ledger, input.requestId, () => {
    const status: CheckStatus = input.outcome === 'escalated' ? 'human_review' : 'completed';
    const updated: OriginalityCheck = {
      ...check,
      status,
      decision: { outcome: input.outcome, reasonCode: input.reasonCode, decidedBy: actor.actorId, decidedAt: input.now },
      revision: check.revision + 1,
    };
    void auditEvent('check_decided', actor, check.id, { action: 'review', fromStatus: check.status, toStatus: status, reasonCode: input.reasonCode });
    return ok(updated);
  });
}
