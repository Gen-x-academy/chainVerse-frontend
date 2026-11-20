/**
 * CAPSTONE-099: categorized integrity concern reports.
 * Evidence is referenced by opaque ids only; private contact details and
 * narrative content never enter the frontend aggregate, URL or audit record.
 */
import {
  auditEvent, authorize, fail, ok, replay, tenantGuard, versionGuard,
  INTEGRITY_ERRORS, type IntegrityActor, type IntegrityAggregate, type IntegrityResult,
} from './shared';

export const REPORT_CATEGORIES = ['authorship', 'fabrication', 'plagiarism', 'safety', 'funds', 'conduct', 'disclosure'] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];
export type ContactPreference = 'none' | 'platform_email' | 'platform_phone';
export type ReportStatus = 'submitted' | 'triaged' | 'investigating' | 'resolved' | 'dismissed';
export const MAX_EVIDENCE_REFS = 20;

export interface IntegrityReport extends IntegrityAggregate {
  id: string;
  projectId: string;
  reporterId: string;
  category: ReportCategory;
  severity: 'low' | 'medium' | 'high';
  status: ReportStatus;
  /** Opaque server-held evidence identifiers. Never raw files or text. */
  evidenceRefs: readonly string[];
  contactPreference: ContactPreference;
  assignedTo?: string;
  resolution?: { outcome: 'upheld' | 'not_upheld' | 'referred'; reasonCode: string; decidedBy: string; decidedAt: string };
}

export type ReportLedger = Map<string, IntegrityResult<IntegrityReport>>;

export function submitReport(
  actor: IntegrityActor,
  input: {
    requestId: string; projectId: string; category: ReportCategory; severity: IntegrityReport['severity'];
    evidenceRefs: readonly string[]; contactPreference: ContactPreference; now: string;
  },
  ledger: ReportLedger = new Map(),
): IntegrityResult<IntegrityReport> {
  const denied = authorize(actor, 'integrity:reports:submit');
  if (denied) return denied;
  return replay(ledger, input.requestId, () => {
    if (!input.projectId || !REPORT_CATEGORIES.includes(input.category)) {
      return fail(INTEGRITY_ERRORS.VALIDATION_FAILED, 'Choose a valid project and report category.');
    }
    if (input.evidenceRefs.length > MAX_EVIDENCE_REFS || input.evidenceRefs.some((ref) => !/^ev_[A-Za-z0-9_-]+$/.test(ref))) {
      return fail(INTEGRITY_ERRORS.VALIDATION_FAILED, `Provide at most ${MAX_EVIDENCE_REFS} opaque evidence references.`);
    }
    const report: IntegrityReport = {
      id: `rep_${input.requestId}`, tenantId: actor.tenantId, projectId: input.projectId,
      reporterId: actor.actorId, category: input.category, severity: input.severity, status: 'submitted',
      evidenceRefs: input.evidenceRefs, contactPreference: input.contactPreference, revision: 1,
    };
    void auditEvent('report_submitted', actor, report.id, { action: 'submit', category: input.category, status: report.status });
    return ok(report);
  });
}

/** Triage is restricted to reviewers and records only a reason code. */
export function triageReport(
  actor: IntegrityActor,
  report: IntegrityReport | undefined,
  input: { requestId: string; expectedRevision: number; decision: 'accept' | 'decline' | 'escalate'; reasonCode: string; now: string },
  ledger: ReportLedger = new Map(),
): IntegrityResult<IntegrityReport> {
  const denied = authorize(actor, 'integrity:reports:triage');
  if (denied) return denied;
  const missing = tenantGuard(actor, report);
  if (missing) return missing;
  const stale = versionGuard(report, input.expectedRevision);
  if (stale) return stale;
  if (report.status !== 'submitted') {
    return fail(INTEGRITY_ERRORS.INVALID_TRANSITION, 'Only a submitted report can be triaged.');
  }
  return replay(ledger, input.requestId, () => {
    const status: ReportStatus = input.decision === 'accept' ? 'investigating' : input.decision === 'escalate' ? 'investigating' : 'dismissed';
    const updated: IntegrityReport = { ...report, status, assignedTo: actor.actorId, revision: report.revision + 1 };
    void auditEvent('report_triaged', actor, report.id, { action: 'triage', fromStatus: report.status, toStatus: status, reasonCode: input.reasonCode });
    return ok(updated);
  });
}

export function resolveReport(
  actor: IntegrityActor,
  report: IntegrityReport | undefined,
  input: { requestId: string; expectedRevision: number; outcome: 'upheld' | 'not_upheld' | 'referred'; reasonCode: string; now: string },
  ledger: ReportLedger = new Map(),
): IntegrityResult<IntegrityReport> {
  const denied = authorize(actor, 'integrity:reports:triage');
  if (denied) return denied;
  const missing = tenantGuard(actor, report);
  if (missing) return missing;
  const stale = versionGuard(report, input.expectedRevision);
  if (stale) return stale;
  if (report.status !== 'investigating') {
    return fail(INTEGRITY_ERRORS.INVALID_TRANSITION, 'Only an investigating report can be resolved.');
  }
  return replay(ledger, input.requestId, () => {
    if (!input.reasonCode.trim()) return fail(INTEGRITY_ERRORS.VALIDATION_FAILED, 'A reason code is required for the outcome.');
    const updated: IntegrityReport = {
      ...report, status: 'resolved', revision: report.revision + 1,
      resolution: { outcome: input.outcome, reasonCode: input.reasonCode, decidedBy: actor.actorId, decidedAt: input.now },
    };
    void auditEvent('report_resolved', actor, report.id, { action: 'resolve', toStatus: updated.status, reasonCode: input.reasonCode });
    return ok(updated);
  });
}
