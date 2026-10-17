/** MENTOR-086: report mentorship conduct concerns with category, urgency, evidence refs and a safe contact preference. */
export type ReportCategory = 'profile' | 'message' | 'session' | 'payment' | 'offline-conduct';
export type ReportUrgency = 'low' | 'normal' | 'high' | 'immediate';
export type SafeContactPreference = 'in-app' | 'email' | 'none';
export type ReportStatus = 'submitted' | 'triaged' | 'resolved' | 'withdrawn';
export type EvidenceKind = 'message' | 'session' | 'payment' | 'file' | 'link';

/** A pointer to material that supports the report; the material itself is never copied in. */
export interface EvidenceRef {
  kind: EvidenceKind;
  ref: string;
}

export type ReportEventType = 'submitted' | 'triaged' | 'resolved' | 'withdrawn';

export interface ReportEvent {
  at: string;
  actorId: string;
  type: ReportEventType;
  note?: string;
}

export interface ConductReport {
  id: string;
  reporterId: string;
  subjectId: string;
  engagementId?: string;
  category: ReportCategory;
  description: string;
  urgency: ReportUrgency;
  evidence: EvidenceRef[];
  safeContact: SafeContactPreference;
  status: ReportStatus;
  submittedAt: string;
  /** Append-only trail of report lifecycle events. */
  history: ReportEvent[];
}

export interface SubmitConductReportInput {
  id: string;
  reporterId: string;
  subjectId: string;
  engagementId?: string;
  category: ReportCategory;
  description: string;
  urgency?: ReportUrgency;
  evidence?: EvidenceRef[];
  safeContact?: SafeContactPreference;
}

export const REPORT_CATEGORIES: readonly ReportCategory[] = ['profile', 'message', 'session', 'payment', 'offline-conduct'];
export const DESCRIPTION_MIN = 20;
export const DESCRIPTION_MAX = 5000;
export const MAX_EVIDENCE_REFS = 20;

/** Hours until a report of each urgency should be picked up (used to order the triage queue). */
export const URGENCY_SLA_HOURS: Record<ReportUrgency, number> = {
  immediate: 1,
  high: 8,
  normal: 72,
  low: 168,
};

export function submitConductReport(input: SubmitConductReportInput, now: Date = new Date()): ConductReport {
  if (!input.reporterId) throw new Error('A report needs a reporter');
  if (!input.subjectId) throw new Error('A report needs a subject');
  if (input.reporterId === input.subjectId) throw new Error('You cannot report yourself');
  if (!REPORT_CATEGORIES.includes(input.category)) throw new Error('Unknown report category');

  const description = input.description.trim();
  if (description.length < DESCRIPTION_MIN) {
    throw new Error(`Describe the concern in at least ${DESCRIPTION_MIN} characters`);
  }
  if (description.length > DESCRIPTION_MAX) {
    throw new Error(`Keep the description under ${DESCRIPTION_MAX} characters`);
  }

  const evidence = input.evidence ?? [];
  if (evidence.length > MAX_EVIDENCE_REFS) {
    throw new Error(`Attach at most ${MAX_EVIDENCE_REFS} evidence references`);
  }
  for (const item of evidence) {
    if (!item.ref.trim()) throw new Error('An evidence reference cannot be empty');
  }

  return {
    id: input.id,
    reporterId: input.reporterId,
    subjectId: input.subjectId,
    engagementId: input.engagementId,
    category: input.category,
    description,
    urgency: input.urgency ?? 'normal',
    evidence: evidence.map((item) => ({ kind: item.kind, ref: item.ref.trim() })),
    safeContact: input.safeContact ?? 'in-app',
    status: 'submitted',
    submittedAt: now.toISOString(),
    history: [{ at: now.toISOString(), actorId: input.reporterId, type: 'submitted' }],
  };
}

const advance = (
  report: ConductReport,
  actorId: string,
  type: ReportEventType,
  status: ReportStatus,
  now: Date,
  note?: string,
): ConductReport => ({
  ...report,
  status,
  history: [...report.history, { at: now.toISOString(), actorId, type, note }],
});

export function triageConductReport(report: ConductReport, actorId: string, now: Date = new Date()): ConductReport {
  if (report.status !== 'submitted') throw new Error('Only a submitted report can be triaged');
  return advance(report, actorId, 'triaged', 'triaged', now);
}

export function resolveConductReport(report: ConductReport, actorId: string, note: string, now: Date = new Date()): ConductReport {
  if (report.status === 'withdrawn' || report.status === 'resolved') {
    throw new Error('A closed report cannot be resolved again');
  }
  if (!note.trim()) throw new Error('A resolution needs a short note');
  return advance(report, actorId, 'resolved', 'resolved', now, note.trim());
}

/** Only the reporter may withdraw, and only while the report is still open. */
export function withdrawConductReport(report: ConductReport, actorId: string, now: Date = new Date()): ConductReport {
  if (actorId !== report.reporterId) throw new Error('Only the reporter can withdraw this report');
  if (report.status === 'resolved' || report.status === 'withdrawn') {
    throw new Error('A closed report cannot be withdrawn');
  }
  return advance(report, actorId, 'withdrawn', 'withdrawn', now);
}

/** Orders open reports by urgency first, then oldest first, for deterministic triage. */
export function orderTriageQueue(reports: ConductReport[]): ConductReport[] {
  const rank: Record<ReportUrgency, number> = { immediate: 0, high: 1, normal: 2, low: 3 };
  return reports
    .filter((report) => report.status === 'submitted' || report.status === 'triaged')
    .sort((a, b) => rank[a.urgency] - rank[b.urgency] || Date.parse(a.submittedAt) - Date.parse(b.submittedAt));
}
