/** MENTOR-059: handle no-show reporting. */

import { IDEMPOTENCY_KEY_PATTERN } from './session-booking';
import {
  HOUR_MS,
  MINUTES,
  buildEventId,
  canScheduleForAgreement,
  createSessionLedger,
  isSafePlainText,
  schedulingError,
  stableHash,
  type MentorshipSession,
  type NoShowClaim,
  type NoShowConsequence,
  type NoShowEvidence,
  type NoShowOutcome,
  type NoShowReport,
  type NoShowResponse,
  type NoShowType,
  type SchedulingActor,
  type SchedulingError,
  type SchedulingEvent,
  type SchedulingEventType,
  type SchedulingIssue,
  type SessionLedger,
} from './session-core';

export interface NoShowPolicy {
  /** Minutes after the scheduled start before anyone may report. */
  opensAfterMinutes: number;
  /** Hours after the scheduled end during which a report can still be made. */
  reportWindowHours: number;
  /** Hours the accused has to respond before any policy may act. */
  responseWindowHours: number;
  maxEvidenceItems: number;
  maxNoteLength: number;
  maxAttachmentBytes: number;
  allowedMimeTypes: readonly string[];
  /** When false, nothing is ever resolved without a coordinator. */
  autoConsequences: boolean;
}

export const DEFAULT_NO_SHOW_POLICY: NoShowPolicy = {
  opensAfterMinutes: 10,
  reportWindowHours: 24,
  responseWindowHours: 48,
  maxEvidenceItems: 3,
  maxNoteLength: 500,
  maxAttachmentBytes: 5 * 1024 * 1024,
  allowedMimeTypes: ['image/png', 'image/jpeg', 'application/pdf'],
  autoConsequences: false,
};

export const STATEMENT_MIN_LENGTH = 5;
export const STATEMENT_MAX_LENGTH = 1000;
export const ATTACHMENT_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/;

/** What each participant may report. Nobody reports their own absence as someone else's. */
export const REPORTABLE_TYPES: Record<'mentor' | 'mentee', readonly NoShowType[]> = {
  mentee: ['mentor', 'both', 'technical'],
  mentor: ['mentee', 'both', 'technical'],
};

const ADVERSE: readonly NoShowOutcome[] = ['uphold_mentor_no_show', 'uphold_mentee_no_show', 'uphold_both_absent'];

const CONSEQUENCE_OF: Record<NoShowOutcome, NoShowConsequence> = {
  uphold_mentor_no_show: 'refund_mentee',
  uphold_mentee_no_show: 'compensate_mentor',
  uphold_both_absent: 'none',
  technical_issue: 'none',
  dismiss: 'none',
};

export const NO_SHOW_OUTCOMES = Object.keys(CONSEQUENCE_OF) as NoShowOutcome[];

export const NO_SHOW_OUTCOME_LABELS: Record<NoShowOutcome, string> = {
  uphold_mentor_no_show: 'Mentor did not attend',
  uphold_mentee_no_show: 'Mentee did not attend',
  uphold_both_absent: 'Neither attended',
  technical_issue: 'Technical problem',
  dismiss: 'Dismiss the report',
};

export const NO_SHOW_CONSEQUENCE_LABELS: Record<NoShowConsequence, string> = {
  pending_policy: 'No consequence has been applied. Consequences wait for review under the program policy.',
  none: 'No financial consequence applies.',
  refund_mentee: 'The mentee will be refunded.',
  compensate_mentor: 'The mentor will be compensated.',
};

/** Outcomes that go against a participant and so need due process first. */
export function isAdverseOutcome(outcome: NoShowOutcome): boolean {
  return ADVERSE.includes(outcome);
}

function fail(
  code: Parameters<typeof schedulingError>[0],
  issues?: SchedulingIssue[],
): { ok: false; error: SchedulingError } {
  return { ok: false, error: schedulingError(code, issues) };
}

export type NoShowResult =
  | {
      ok: true;
      ledger: SessionLedger;
      report: NoShowReport;
      /** Present exactly once per new fact; absent on any replay. */
      event?: SchedulingEvent;
      /** True when this claim joined a report another participant opened. */
      merged: boolean;
      replayed: boolean;
    }
  | { ok: false; error: SchedulingError };

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Checks and normalises evidence. The result is rebuilt field by field, so
 * unknown properties never reach a report.
 */
export function normalizeEvidence(
  evidence: unknown,
  policy: NoShowPolicy,
): { evidence: NoShowEvidence[]; issues: SchedulingIssue[] } {
  const issues: SchedulingIssue[] = [];
  const out: NoShowEvidence[] = [];
  if (evidence === undefined) return { evidence: out, issues };
  if (!Array.isArray(evidence)) {
    return { evidence: out, issues: [{ field: 'evidence', message: 'Evidence must be a list.' }] };
  }
  if (evidence.length > policy.maxEvidenceItems) {
    issues.push({ field: 'evidence', message: `Attach at most ${policy.maxEvidenceItems} pieces of evidence.` });
    return { evidence: out, issues };
  }
  evidence.forEach((item: unknown, index) => {
    const field = `evidence.${index}`;
    const candidate = item as Partial<{
      kind: string;
      text: string;
      attachmentRef: string;
      mimeType: string;
      sizeBytes: number;
    }>;
    if (candidate?.kind === 'note') {
      const text = typeof candidate.text === 'string' ? candidate.text.trim() : '';
      if (text.length === 0 || text.length > policy.maxNoteLength) {
        issues.push({ field, message: `A note must be 1 to ${policy.maxNoteLength} characters.` });
      } else if (!isSafePlainText(text)) {
        issues.push({ field, message: 'A note must be plain text without markup.' });
      } else {
        out.push({ kind: 'note', text });
      }
    } else if (candidate?.kind === 'attachment') {
      const { attachmentRef, mimeType, sizeBytes } = candidate;
      if (typeof attachmentRef !== 'string' || !ATTACHMENT_REF_PATTERN.test(attachmentRef)) {
        issues.push({ field, message: 'The attachment reference is not valid.' });
      } else if (typeof mimeType !== 'string' || !policy.allowedMimeTypes.includes(mimeType)) {
        issues.push({ field, message: `Attachments must be one of ${policy.allowedMimeTypes.join(', ')}.` });
      } else if (!Number.isInteger(sizeBytes) || (sizeBytes as number) < 1 || (sizeBytes as number) > policy.maxAttachmentBytes) {
        issues.push({ field, message: `An attachment must be under ${Math.floor(policy.maxAttachmentBytes / 1024 / 1024)} MB.` });
      } else {
        out.push({ kind: 'attachment', attachmentRef, mimeType, sizeBytes: sizeBytes as number });
      }
    } else {
      issues.push({ field, message: 'Evidence must be a note or an attachment.' });
    }
  });
  return { evidence: out, issues };
}

function validateStatement(statement: unknown): { value: string; issues: SchedulingIssue[] } {
  const value = typeof statement === 'string' ? statement.trim() : '';
  if (value.length < STATEMENT_MIN_LENGTH) {
    return { value, issues: [{ field: 'statement', message: `Describe what happened in at least ${STATEMENT_MIN_LENGTH} characters.` }] };
  }
  if (value.length > STATEMENT_MAX_LENGTH) {
    return { value, issues: [{ field: 'statement', message: `Keep the statement to ${STATEMENT_MAX_LENGTH} characters or fewer.` }] };
  }
  if (!isSafePlainText(value)) {
    return { value, issues: [{ field: 'statement', message: 'The statement must be plain text without markup.' }] };
  }
  return { value, issues: [] };
}

function eventFor(
  type: SchedulingEventType,
  session: MentorshipSession,
  report: NoShowReport,
  actorId: string,
  discriminator: string,
  now: Date,
  extra: Partial<SchedulingEvent> = {},
): SchedulingEvent {
  return {
    eventId: buildEventId(type, session.sessionId, session.revision, `${report.reportId}|${discriminator}`),
    type,
    sessionId: session.sessionId,
    agreementId: session.agreementId,
    engagementId: session.engagementId,
    tenantId: session.tenantId,
    revision: session.revision,
    occurredAt: now.toISOString(),
    actorId,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    reportId: report.reportId,
    ...extra,
  };
}

function isParticipant(actor: SchedulingActor, session: MentorshipSession): actor is SchedulingActor & { role: 'mentor' | 'mentee' } {
  return (actor.role === 'mentor' || actor.role === 'mentee') && canScheduleForAgreement(actor, session);
}

function isCoordinator(actor: SchedulingActor, session: MentorshipSession): boolean {
  return (actor.role === 'coordinator' || actor.role === 'administrator') && canScheduleForAgreement(actor, session);
}

function findReportBySession(ledger: SessionLedger, sessionId: string): NoShowReport | undefined {
  return ledger.noShowReports.find((report) => report.sessionId === sessionId);
}

function replaceReport(ledger: SessionLedger, report: NoShowReport): readonly NoShowReport[] {
  return ledger.noShowReports.some((candidate) => candidate.reportId === report.reportId)
    ? ledger.noShowReports.map((candidate) => (candidate.reportId === report.reportId ? report : candidate))
    : [...ledger.noShowReports, report];
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

export interface CreateNoShowReportInput {
  actor: SchedulingActor;
  sessionId: string;
  type: NoShowType;
  statement: string;
  evidence?: readonly unknown[];
  idempotencyKey: string;
  policy: NoShowPolicy;
}

/**
 * A participant reports a no-show for a session.
 *
 * Order: authorisation, key format, idempotency, session state, an earlier
 * claim by the same reporter, whether the report is already resolved,
 * validation, the reporting window. Unknown sessions are reported as
 * `NOT_AUTHORIZED` so ids cannot be probed.
 *
 * There is one report per session. If the other participant already opened
 * it, the new claim merges into it and the original response deadline stands.
 * A repeat by the same person is a replay and mints no new event.
 */
export function createNoShowReport(
  ledger: SessionLedger,
  input: CreateNoShowReportInput,
  now: Date = new Date(),
): NoShowResult {
  const { actor, policy } = input;
  const session = ledger.sessions.find((candidate) => candidate.sessionId === input.sessionId);
  if (!session || !isParticipant(actor, session)) return fail('NOT_AUTHORIZED');
  if (!IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey ?? '')) return fail('IDEMPOTENCY_KEY_INVALID');

  const statement = validateStatement(input.statement);
  const normalized = normalizeEvidence(input.evidence, policy);
  const scopedKey = `${actor.userId}|noshow|${session.sessionId}|${input.idempotencyKey}`;
  const fingerprint = JSON.stringify([session.sessionId, input.type, statement.value, normalized.evidence]);

  const existing = findReportBySession(ledger, session.sessionId);
  const own = existing?.claims.find((claim) => claim.reporterId === actor.userId);

  const prior = ledger.idempotency[scopedKey];
  if (prior) {
    if (prior.fingerprint !== fingerprint) return fail('IDEMPOTENCY_KEY_REUSED');
    if (existing && own) return { ok: true, ledger, report: existing, merged: false, replayed: true };
  }

  if (session.status === 'cancelled') return fail('SESSION_NOT_BOOKED');
  if (own) {
    return own.type === input.type
      ? { ok: true, ledger, report: existing as NoShowReport, merged: false, replayed: true }
      : fail('NO_SHOW_ALREADY_REPORTED');
  }
  if (existing?.status === 'resolved') return fail('NO_SHOW_ALREADY_RESOLVED');

  const issues = [...statement.issues, ...normalized.issues];
  if (!REPORTABLE_TYPES[actor.role].includes(input.type)) {
    issues.push({ field: 'type', message: 'Choose what happened from the options offered to you.' });
  }
  if (issues.length > 0) return fail('INVALID_SESSION', issues);

  const nowMs = now.getTime();
  if (nowMs < Date.parse(session.startsAt) + policy.opensAfterMinutes * MINUTES) return fail('NO_SHOW_TOO_EARLY');
  if (nowMs > Date.parse(session.endsAt) + policy.reportWindowHours * HOUR_MS) return fail('NO_SHOW_WINDOW_CLOSED');

  const reportId = existing?.reportId ?? `nsr-${stableHash(`noshow|${session.sessionId}`)}`;
  const claim: NoShowClaim = {
    claimId: `nsc-${stableHash(`${reportId}|${actor.userId}`)}`,
    reporterId: actor.userId,
    reporterRole: actor.role,
    type: input.type,
    statement: statement.value,
    evidence: normalized.evidence,
    reportedAt: now.toISOString(),
  };
  const claims = [...(existing?.claims ?? []), claim];
  const report: NoShowReport = {
    reportId,
    sessionId: session.sessionId,
    agreementId: session.agreementId,
    tenantId: session.tenantId,
    status: 'open',
    claims,
    responses: existing?.responses ?? [],
    conflicting: claims.length > 1 && new Set(claims.map((item) => item.type)).size > 1,
    responseDeadline: existing?.responseDeadline ?? new Date(nowMs + policy.responseWindowHours * HOUR_MS).toISOString(),
    consequence: 'pending_policy',
    createdAt: existing?.createdAt ?? now.toISOString(),
  };

  const event = eventFor('mentorship.session.no_show_reported', session, report, actor.userId, claim.claimId, now, {
    noShowType: input.type,
  });
  const next = createSessionLedger({
    ...ledger,
    noShowReports: replaceReport(ledger, report),
    idempotency: { ...ledger.idempotency, [scopedKey]: { fingerprint, sessionId: session.sessionId } },
    events: [...ledger.events, event],
  });
  return { ok: true, ledger: next, report, event, merged: Boolean(existing), replayed: false };
}

// ---------------------------------------------------------------------------
// Due process
// ---------------------------------------------------------------------------

/** Participants accused by at least one claim who have not filed a claim themselves. */
export function accusedParties(report: NoShowReport, session: Pick<MentorshipSession, 'mentorId' | 'menteeId'>): string[] {
  const claimants = new Set(report.claims.map((claim) => claim.reporterId));
  return [session.mentorId, session.menteeId].filter(
    (party) =>
      !claimants.has(party) &&
      report.claims.some((claim) => claim.type !== 'technical' && claim.reporterId !== party),
  );
}

/**
 * Due process: every accused participant has responded, or the response
 * deadline has passed. Claimants have been heard through their own claim.
 */
export function dueProcessSatisfied(
  report: NoShowReport,
  session: Pick<MentorshipSession, 'mentorId' | 'menteeId'>,
  now: Date,
): boolean {
  const unheard = accusedParties(report, session).filter(
    (party) => !report.responses.some((response) => response.responderId === party),
  );
  return unheard.length === 0 || now.getTime() >= Date.parse(report.responseDeadline);
}

export interface RespondToNoShowInput {
  actor: SchedulingActor;
  reportId: string;
  statement: string;
  evidence?: readonly unknown[];
  policy: NoShowPolicy;
}

/**
 * The other participant answers a report. A repeat of the same answer is a
 * replay. A different second answer is refused, so the record stays stable.
 * Answering is allowed until the report is resolved, even after the deadline.
 */
export function respondToNoShowReport(
  ledger: SessionLedger,
  input: RespondToNoShowInput,
  now: Date = new Date(),
): NoShowResult {
  const { actor, policy } = input;
  const report = ledger.noShowReports.find((candidate) => candidate.reportId === input.reportId);
  const session = report ? ledger.sessions.find((candidate) => candidate.sessionId === report.sessionId) : undefined;
  if (!report || !session || !isParticipant(actor, session)) return fail('NOT_AUTHORIZED');

  const statement = validateStatement(input.statement);
  const normalized = normalizeEvidence(input.evidence, policy);

  const earlier = report.responses.find((response) => response.responderId === actor.userId);
  if (earlier) {
    const same = earlier.statement === statement.value && JSON.stringify(earlier.evidence) === JSON.stringify(normalized.evidence);
    return same ? { ok: true, ledger, report, merged: false, replayed: true } : fail('NO_SHOW_ALREADY_RESPONDED');
  }
  if (report.status === 'resolved') return fail('NO_SHOW_ALREADY_RESOLVED');
  if (report.claims.some((claim) => claim.reporterId === actor.userId)) return fail('NO_SHOW_ALREADY_REPORTED');

  const issues = [...statement.issues, ...normalized.issues];
  if (issues.length > 0) return fail('INVALID_SESSION', issues);

  const response: NoShowResponse = {
    responderId: actor.userId,
    statement: statement.value,
    evidence: normalized.evidence,
    respondedAt: now.toISOString(),
  };
  const updated: NoShowReport = { ...report, responses: [...report.responses, response] };
  const event = eventFor('mentorship.session.no_show_responded', session, updated, actor.userId, actor.userId, now);
  const next = createSessionLedger({
    ...ledger,
    noShowReports: replaceReport(ledger, updated),
    events: [...ledger.events, event],
  });
  return { ok: true, ledger: next, report: updated, event, merged: false, replayed: false };
}

// ---------------------------------------------------------------------------
// Resolution and consequences
// ---------------------------------------------------------------------------

function resolve(
  ledger: SessionLedger,
  report: NoShowReport,
  session: MentorshipSession,
  outcome: NoShowOutcome,
  resolvedBy: string,
  note: string,
  now: Date,
): NoShowResult {
  const consequence = CONSEQUENCE_OF[outcome];
  const resolved: NoShowReport = {
    ...report,
    status: 'resolved',
    outcome,
    consequence,
    resolvedBy,
    resolvedAt: now.toISOString(),
    ...(note ? { resolutionNote: note } : {}),
  };
  const event = eventFor('mentorship.session.no_show_resolved', session, resolved, resolvedBy, 'resolved', now, {
    resolution: outcome,
    consequence,
  });
  const next = createSessionLedger({
    ...ledger,
    noShowReports: replaceReport(ledger, resolved),
    events: [...ledger.events, event],
  });
  return { ok: true, ledger: next, report: resolved, event, merged: false, replayed: false };
}

export interface ResolveNoShowInput {
  actor: SchedulingActor;
  reportId: string;
  outcome: NoShowOutcome;
  /** Visible to the participants and coordinators; never sent in events. */
  note?: string;
}

/**
 * A coordinator or administrator decides the report. An outcome that goes
 * against a participant needs due process first: the accused must have
 * responded or the deadline must have passed. Resolving again with the same
 * outcome is a replay; a different outcome is refused.
 */
export function resolveNoShowReport(
  ledger: SessionLedger,
  input: ResolveNoShowInput,
  now: Date = new Date(),
): NoShowResult {
  const { actor } = input;
  const report = ledger.noShowReports.find((candidate) => candidate.reportId === input.reportId);
  const session = report ? ledger.sessions.find((candidate) => candidate.sessionId === report.sessionId) : undefined;
  if (!report || !session || !isCoordinator(actor, session)) return fail('NOT_AUTHORIZED');

  if (!NO_SHOW_OUTCOMES.includes(input.outcome)) {
    return fail('INVALID_SESSION', [{ field: 'outcome', message: 'Choose an outcome for this report.' }]);
  }
  const note = (input.note ?? '').trim();
  if (note.length > 500 || (note && !isSafePlainText(note))) {
    return fail('INVALID_SESSION', [{ field: 'note', message: 'The note must be plain text of 500 characters or fewer.' }]);
  }

  if (report.status === 'resolved') {
    return report.outcome === input.outcome
      ? { ok: true, ledger, report, merged: false, replayed: true }
      : fail('NO_SHOW_ALREADY_RESOLVED');
  }
  if (ADVERSE.includes(input.outcome) && !dueProcessSatisfied(report, session, now)) {
    return fail('DUE_PROCESS_PENDING');
  }
  return resolve(ledger, report, session, input.outcome, actor.userId, note, now);
}

/**
 * Applies consequences to reports nobody contested, but only if the policy
 * says so. With the default policy this does nothing. When enabled, it acts on
 * a report that has a single claim, no conflict and no response, after the
 * response deadline has passed, so the accused has had their chance.
 */
export function applyDueConsequences(
  ledger: SessionLedger,
  policy: Pick<NoShowPolicy, 'autoConsequences'>,
  now: Date = new Date(),
): { ledger: SessionLedger; resolved: string[] } {
  if (!policy.autoConsequences) return { ledger, resolved: [] };

  let current = ledger;
  const resolved: string[] = [];
  for (const report of ledger.noShowReports) {
    const session = ledger.sessions.find((candidate) => candidate.sessionId === report.sessionId);
    const claim = report.claims[0];
    const contested = report.conflicting || report.claims.length !== 1 || report.responses.length > 0;
    if (!session || report.status !== 'open' || contested) continue;
    if (claim.type !== 'mentor' && claim.type !== 'mentee') continue;
    if (now.getTime() < Date.parse(report.responseDeadline)) continue;

    const outcome: NoShowOutcome = claim.type === 'mentor' ? 'uphold_mentor_no_show' : 'uphold_mentee_no_show';
    const result = resolve(current, report, session, outcome, 'system', '', now);
    if (result.ok) {
      current = result.ledger;
      resolved.push(report.reportId);
    }
  }
  return { ledger: current, resolved };
}

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

function restricted(evidence: readonly NoShowEvidence[]): NoShowEvidence[] {
  return evidence.map((item) => (item.kind === 'attachment' ? { kind: 'attachment', restricted: true } : item));
}

/**
 * Reports are confidential. Only the session's participants and coordinators
 * of the tenant see one. Coordinators see everything. A participant sees every
 * statement and note, so they can answer fairly, but attachment references are
 * restricted to the person who supplied them.
 */
export function redactNoShowReportFor(
  report: NoShowReport,
  session: Pick<MentorshipSession, 'tenantId' | 'mentorId' | 'menteeId'>,
  viewer: SchedulingActor,
): NoShowReport | null {
  if (viewer.tenantId !== report.tenantId) return null;
  if ((viewer.role === 'coordinator' || viewer.role === 'administrator') && canScheduleForAgreement(viewer, session)) {
    return report;
  }
  if (!canScheduleForAgreement(viewer, session)) return null;
  return {
    ...report,
    claims: report.claims.map((claim) =>
      claim.reporterId === viewer.userId ? claim : { ...claim, evidence: restricted(claim.evidence) },
    ),
    responses: report.responses.map((response) =>
      response.responderId === viewer.userId ? response : { ...response, evidence: restricted(response.evidence) },
    ),
  };
}
