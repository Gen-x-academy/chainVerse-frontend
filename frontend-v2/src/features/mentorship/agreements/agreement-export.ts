/** MENTOR-052: privacy-safe export of participant agreement records. */
import type { AgreementTerms } from './engagement-agreement';

export type AgreementExportFormat = 'json' | 'csv';
export type AgreementParticipantRole = 'mentor' | 'mentee' | 'guardian';

export interface AgreementParticipant {
  userId: string;
  role: AgreementParticipantRole;
}

export interface AcceptedAgreementTerms extends AgreementTerms {
  version: number;
  acceptedAt: string;
  internalNotes?: string;
}

export interface AgreementApprovalRecord {
  id: string;
  participantId: string;
  role: AgreementParticipantRole;
  version: number;
  decision: 'accepted' | 'declined';
  decidedAt: string;
  internalNote?: string;
}

export type AgreementAmendmentStatus = 'proposed' | 'accepted' | 'rejected' | 'withdrawn';

export interface AgreementAmendmentRecord {
  id: string;
  baseVersion: number;
  proposedBy: string;
  proposedAt: string;
  reason: string;
  changes: Partial<
    Pick<AgreementTerms, 'goals' | 'sessionsPerMonth' | 'sessionMinutes' | 'endDate'>
  >;
  status: AgreementAmendmentStatus;
  acceptedBy: string[];
  internalNote?: string;
}

export type AgreementSessionStatus = 'scheduled' | 'completed' | 'cancelled' | 'no-show';

export interface AgreementSessionRecord {
  id: string;
  startedAt: string;
  durationMinutes: number;
  status: AgreementSessionStatus;
  privateNote?: string;
}

export interface AgreementFinancialSnapshot {
  currency: string;
  agreedMinor: number;
  paidMinor: number;
  refundedMinor: number;
}

export interface AgreementExportSource {
  agreementId: string;
  engagementId: string;
  participants: readonly AgreementParticipant[];
  terms: AcceptedAgreementTerms;
  amendments?: readonly AgreementAmendmentRecord[];
  approvals?: readonly AgreementApprovalRecord[];
  sessions?: readonly AgreementSessionRecord[];
  financials: AgreementFinancialSnapshot;
}

export interface ExportedAgreementTerms {
  version: number;
  acceptedAt: string;
  goals: string[];
  sessionsPerMonth: number;
  sessionMinutes: number;
  startDate: string;
  endDate: string;
  communicationChannel: AgreementTerms['communicationChannel'];
  confidentiality: boolean;
  paymentTerms?: string;
}

export interface ExportedAmendment {
  id: string;
  baseVersion: number;
  proposedBy: string;
  proposedAt: string;
  reason: string;
  changes: AgreementAmendmentRecord['changes'];
  status: AgreementAmendmentStatus;
  acceptedBy: string[];
}

export interface ExportedApproval {
  id: string;
  participantId: string;
  role: AgreementParticipantRole;
  version: number;
  decision: AgreementApprovalRecord['decision'];
  decidedAt: string;
}

export interface ExportedSession {
  id: string;
  startedAt: string;
  durationMinutes: number;
  status: AgreementSessionStatus;
}

export interface AgreementSessionSummary {
  total: number;
  scheduled: number;
  completed: number;
  cancelled: number;
  noShow: number;
  completedMinutes: number;
  firstStartedAt?: string;
  lastStartedAt?: string;
  items: ExportedSession[];
}

export interface ExportedFinancialSummary extends AgreementFinancialSnapshot {
  outstandingMinor: number;
}

export interface AgreementExportBundle {
  schemaVersion: 1;
  agreementId: string;
  engagementId: string;
  generatedAt: string;
  generatedFor: { participantId: string; role: AgreementParticipantRole };
  terms: ExportedAgreementTerms;
  amendments: ExportedAmendment[];
  approvals: ExportedApproval[];
  sessions: AgreementSessionSummary;
  financials: ExportedFinancialSummary;
  privacy: {
    privateNotesExcluded: true;
    excludedFields: readonly string[];
  };
}

export type AgreementExportJobStatus = 'ready' | 'expired';

export interface AgreementExportJob {
  id: string;
  agreementId: string;
  engagementId: string;
  requestedBy: string;
  format: AgreementExportFormat;
  requestedAt: string;
  expiresAt: string;
  downloadToken: string;
  status: AgreementExportJobStatus;
  idempotencyKey?: string;
  downloadedAt?: string;
  bundle: AgreementExportBundle;
}

export type AgreementExportAuditAction = 'request' | 'download';

export interface AgreementExportAuditEntry {
  id: string;
  agreementId: string;
  actorId: string;
  action: AgreementExportAuditAction;
  outcome: 'success' | 'denied';
  reason?: AgreementExportErrorCode;
  occurredAt: string;
  correlationId?: string;
}

export interface AgreementExportState {
  jobs: AgreementExportJob[];
  audit: AgreementExportAuditEntry[];
}

export const AGREEMENT_EXPORT_SCHEMA_VERSION = 1;
export const AGREEMENT_EXPORT_LINK_TTL_MS = 15 * 60 * 1000;
export const AGREEMENT_EXPORT_RATE_LIMIT_MAX = 3;
export const AGREEMENT_EXPORT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export const AGREEMENT_EXPORT_PRIVATE_FIELDS = [
  'terms.internalNotes',
  'approvals[].internalNote',
  'amendments[].internalNote',
  'sessions[].privateNote',
] as const;

export type AgreementExportErrorCode =
  | 'NOT_A_PARTICIPANT'
  | 'INVALID_AGREEMENT'
  | 'INVALID_FORMAT'
  | 'RATE_LIMITED'
  | 'LINK_NOT_FOUND'
  | 'LINK_EXPIRED'
  | 'LINK_NOT_OWNED';

export interface AgreementExportError {
  code: AgreementExportErrorCode;
  message: string;
  status: number;
  retryAfterMs?: number;
}

export type AgreementExportResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: AgreementExportError };

const ERROR_MESSAGES: Record<AgreementExportErrorCode, string> = {
  NOT_A_PARTICIPANT: 'Only participants in this agreement can export its records.',
  INVALID_AGREEMENT: 'The agreement record is incomplete or invalid, so it cannot be exported.',
  INVALID_FORMAT: 'Choose the JSON or CSV export format.',
  RATE_LIMITED: 'You have requested too many exports. Try again later.',
  LINK_NOT_FOUND: 'This export link is not valid.',
  LINK_EXPIRED: 'This export link has expired. Request a new export.',
  LINK_NOT_OWNED: 'This export was requested by a different participant.',
};

const ERROR_STATUS: Record<AgreementExportErrorCode, number> = {
  NOT_A_PARTICIPANT: 403,
  INVALID_AGREEMENT: 422,
  INVALID_FORMAT: 400,
  RATE_LIMITED: 429,
  LINK_NOT_FOUND: 404,
  LINK_EXPIRED: 410,
  LINK_NOT_OWNED: 403,
};

export function createAgreementExportState(): AgreementExportState {
  return { jobs: [], audit: [] };
}

export function agreementExportError(
  code: AgreementExportErrorCode,
  retryAfterMs?: number,
): AgreementExportError {
  return { code, message: ERROR_MESSAGES[code], status: ERROR_STATUS[code], retryAfterMs };
}

export function canParticipantExportAgreement(
  source: AgreementExportSource,
  actorId: string,
): AgreementParticipant | undefined {
  return source.participants.find((participant) => participant.userId === actorId);
}

export function isAgreementExportLinkExpired(
  job: Pick<AgreementExportJob, 'expiresAt'>,
  now: Date = new Date(),
): boolean {
  return now.getTime() >= Date.parse(job.expiresAt);
}

export interface RequestAgreementExportInput {
  agreement: AgreementExportSource;
  actorId: string;
  format?: AgreementExportFormat;
  idempotencyKey?: string;
  correlationId?: string;
  now?: Date;
  idFactory?: () => string;
  tokenFactory?: () => string;
}

export interface AgreementExportRequestValue {
  job: AgreementExportJob;
}

export interface DownloadAgreementExportInput {
  token: string;
  actorId: string;
  correlationId?: string;
  now?: Date;
}

export interface AgreementExportDownloadValue {
  job: AgreementExportJob;
  bundle: AgreementExportBundle;
}

function nextAuditId(state: AgreementExportState): string {
  return `agx-audit-${state.audit.length + 1}`;
}

function denied(
  state: AgreementExportState,
  input: {
    agreementId: string;
    actorId: string;
    action: AgreementExportAuditAction;
    code: AgreementExportErrorCode;
    now: Date;
    correlationId?: string;
    retryAfterMs?: number;
  },
): { state: AgreementExportState; result: { ok: false; error: AgreementExportError } } {
  const entry: AgreementExportAuditEntry = {
    id: nextAuditId(state),
    agreementId: input.agreementId,
    actorId: input.actorId,
    action: input.action,
    outcome: 'denied',
    reason: input.code,
    occurredAt: input.now.toISOString(),
    correlationId: input.correlationId,
  };
  return {
    state: { ...state, audit: [...state.audit, entry] },
    result: { ok: false, error: agreementExportError(input.code, input.retryAfterMs) },
  };
}

function validateAgreement(source: AgreementExportSource): boolean {
  if (!source.agreementId.trim() || !source.engagementId.trim()) return false;
  if (source.participants.length === 0) return false;

  const { terms } = source;
  if (!Number.isInteger(terms.version) || terms.version < 1) return false;
  if (!Array.isArray(terms.goals)) return false;
  if (!Number.isInteger(terms.sessionsPerMonth) || terms.sessionsPerMonth < 0) return false;
  if (!Number.isInteger(terms.sessionMinutes) || terms.sessionMinutes < 0) return false;
  if (Number.isNaN(Date.parse(terms.startDate)) || Number.isNaN(Date.parse(terms.endDate))) return false;
  if (!terms.acceptedAt || Number.isNaN(Date.parse(terms.acceptedAt))) return false;

  for (const session of source.sessions ?? []) {
    if (!session.id.trim() || Number.isNaN(Date.parse(session.startedAt))) return false;
    if (!Number.isInteger(session.durationMinutes) || session.durationMinutes < 0) return false;
  }

  const { financials } = source;
  if (!financials.currency.trim()) return false;
  for (const amount of [financials.agreedMinor, financials.paidMinor, financials.refundedMinor]) {
    if (!Number.isInteger(amount) || amount < 0) return false;
  }
  if (financials.refundedMinor > financials.paidMinor) return false;

  return true;
}

function exportTerms(terms: AcceptedAgreementTerms): ExportedAgreementTerms {
  const exported: ExportedAgreementTerms = {
    version: terms.version,
    acceptedAt: terms.acceptedAt,
    goals: [...terms.goals],
    sessionsPerMonth: terms.sessionsPerMonth,
    sessionMinutes: terms.sessionMinutes,
    startDate: terms.startDate,
    endDate: terms.endDate,
    communicationChannel: terms.communicationChannel,
    confidentiality: terms.confidentiality,
  };
  if (terms.paymentTerms !== undefined) exported.paymentTerms = terms.paymentTerms;
  return exported;
}

function exportChanges(
  changes: AgreementAmendmentRecord['changes'],
): AgreementAmendmentRecord['changes'] {
  const exported: AgreementAmendmentRecord['changes'] = {};
  if (changes.goals !== undefined) exported.goals = [...changes.goals];
  if (changes.sessionsPerMonth !== undefined) exported.sessionsPerMonth = changes.sessionsPerMonth;
  if (changes.sessionMinutes !== undefined) exported.sessionMinutes = changes.sessionMinutes;
  if (changes.endDate !== undefined) exported.endDate = changes.endDate;
  return exported;
}

function exportAmendments(
  amendments: readonly AgreementAmendmentRecord[] = [],
): ExportedAmendment[] {
  return [...amendments]
    .sort((a, b) => a.baseVersion - b.baseVersion || a.id.localeCompare(b.id))
    .map((amendment) => ({
      id: amendment.id,
      baseVersion: amendment.baseVersion,
      proposedBy: amendment.proposedBy,
      proposedAt: amendment.proposedAt,
      reason: amendment.reason,
      changes: exportChanges(amendment.changes),
      status: amendment.status,
      acceptedBy: [...amendment.acceptedBy],
    }));
}

function exportApprovals(approvals: readonly AgreementApprovalRecord[] = []): ExportedApproval[] {
  return [...approvals]
    .sort(
      (a, b) =>
        a.version - b.version ||
        Date.parse(a.decidedAt) - Date.parse(b.decidedAt) ||
        a.id.localeCompare(b.id),
    )
    .map((approval) => ({
      id: approval.id,
      participantId: approval.participantId,
      role: approval.role,
      version: approval.version,
      decision: approval.decision,
      decidedAt: approval.decidedAt,
    }));
}

function exportSessions(sessions: readonly AgreementSessionRecord[] = []): AgreementSessionSummary {
  const items: ExportedSession[] = [...sessions]
    .sort(
      (a, b) =>
        Date.parse(a.startedAt) - Date.parse(b.startedAt) || a.id.localeCompare(b.id),
    )
    .map((session) => ({
      id: session.id,
      startedAt: session.startedAt,
      durationMinutes: session.durationMinutes,
      status: session.status,
    }));

  const count = (status: AgreementSessionStatus) =>
    items.filter((session) => session.status === status).length;

  return {
    total: items.length,
    scheduled: count('scheduled'),
    completed: count('completed'),
    cancelled: count('cancelled'),
    noShow: count('no-show'),
    completedMinutes: items
      .filter((session) => session.status === 'completed')
      .reduce((total, session) => total + session.durationMinutes, 0),
    firstStartedAt: items[0]?.startedAt,
    lastStartedAt: items[items.length - 1]?.startedAt,
    items,
  };
}

function exportFinancials(financials: AgreementFinancialSnapshot): ExportedFinancialSummary {
  return {
    currency: financials.currency,
    agreedMinor: financials.agreedMinor,
    paidMinor: financials.paidMinor,
    refundedMinor: financials.refundedMinor,
    outstandingMinor: Math.max(0, financials.agreedMinor - financials.paidMinor + financials.refundedMinor),
  };
}

export function buildAgreementExportBundle(
  source: AgreementExportSource,
  participant: AgreementParticipant,
  now: Date = new Date(),
): AgreementExportBundle {
  return {
    schemaVersion: AGREEMENT_EXPORT_SCHEMA_VERSION,
    agreementId: source.agreementId,
    engagementId: source.engagementId,
    generatedAt: now.toISOString(),
    generatedFor: { participantId: participant.userId, role: participant.role },
    terms: exportTerms(source.terms),
    amendments: exportAmendments(source.amendments),
    approvals: exportApprovals(source.approvals),
    sessions: exportSessions(source.sessions),
    financials: exportFinancials(source.financials),
    privacy: {
      privateNotesExcluded: true,
      excludedFields: [...AGREEMENT_EXPORT_PRIVATE_FIELDS],
    },
  };
}

function recentSuccessfulRequests(state: AgreementExportState, actorId: string, now: Date) {
  const windowStart = now.getTime() - AGREEMENT_EXPORT_RATE_LIMIT_WINDOW_MS;
  return state.audit.filter(
    (entry) =>
      entry.actorId === actorId &&
      entry.action === 'request' &&
      entry.outcome === 'success' &&
      Date.parse(entry.occurredAt) > windowStart,
  );
}

export function requestAgreementExport(
  state: AgreementExportState,
  input: RequestAgreementExportInput,
): { state: AgreementExportState; result: AgreementExportResult<AgreementExportRequestValue> } {
  const now = input.now ?? new Date();
  const agreementId = input.agreement.agreementId;
  const participant = canParticipantExportAgreement(input.agreement, input.actorId);

  if (!participant) {
    return denied(state, {
      agreementId,
      actorId: input.actorId,
      action: 'request',
      code: 'NOT_A_PARTICIPANT',
      now,
      correlationId: input.correlationId,
    });
  }

  const format = input.format ?? 'json';
  if (format !== 'json' && format !== 'csv') {
    return denied(state, {
      agreementId,
      actorId: input.actorId,
      action: 'request',
      code: 'INVALID_FORMAT',
      now,
      correlationId: input.correlationId,
    });
  }

  if (!validateAgreement(input.agreement)) {
    return denied(state, {
      agreementId,
      actorId: input.actorId,
      action: 'request',
      code: 'INVALID_AGREEMENT',
      now,
      correlationId: input.correlationId,
    });
  }

  if (input.idempotencyKey) {
    const existing = state.jobs.find(
      (job) =>
        job.requestedBy === input.actorId &&
        job.agreementId === agreementId &&
        job.format === format &&
        job.idempotencyKey === input.idempotencyKey,
    );
    if (existing) {
      return { state, result: { ok: true, value: { job: existing } } };
    }
  }

  const recent = recentSuccessfulRequests(state, input.actorId, now);
  if (recent.length >= AGREEMENT_EXPORT_RATE_LIMIT_MAX) {
    const oldest = recent.reduce((earliest, entry) =>
      Date.parse(entry.occurredAt) < Date.parse(earliest.occurredAt) ? entry : earliest,
    );
    const retryAfterMs = Math.max(
      0,
      Date.parse(oldest.occurredAt) + AGREEMENT_EXPORT_RATE_LIMIT_WINDOW_MS - now.getTime(),
    );
    return denied(state, {
      agreementId,
      actorId: input.actorId,
      action: 'request',
      code: 'RATE_LIMITED',
      now,
      correlationId: input.correlationId,
      retryAfterMs,
    });
  }

  const jobId = input.idFactory?.() ?? `agx-${state.jobs.length + 1}`;
  const downloadToken = input.tokenFactory?.() ?? `agx-token-${state.jobs.length + 1}`;
  const job: AgreementExportJob = {
    id: jobId,
    agreementId,
    engagementId: input.agreement.engagementId,
    requestedBy: input.actorId,
    format,
    requestedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + AGREEMENT_EXPORT_LINK_TTL_MS).toISOString(),
    downloadToken,
    status: 'ready',
    idempotencyKey: input.idempotencyKey,
    bundle: buildAgreementExportBundle(input.agreement, participant, now),
  };

  const audit: AgreementExportAuditEntry = {
    id: nextAuditId(state),
    agreementId,
    actorId: input.actorId,
    action: 'request',
    outcome: 'success',
    occurredAt: now.toISOString(),
    correlationId: input.correlationId,
  };

  return {
    state: { jobs: [...state.jobs, job], audit: [...state.audit, audit] },
    result: { ok: true, value: { job } },
  };
}

export function downloadAgreementExport(
  state: AgreementExportState,
  input: DownloadAgreementExportInput,
): { state: AgreementExportState; result: AgreementExportResult<AgreementExportDownloadValue> } {
  const now = input.now ?? new Date();
  const job = state.jobs.find((candidate) => candidate.downloadToken === input.token);

  if (!job) {
    return denied(state, {
      agreementId: '',
      actorId: input.actorId,
      action: 'download',
      code: 'LINK_NOT_FOUND',
      now,
      correlationId: input.correlationId,
    });
  }

  if (job.requestedBy !== input.actorId) {
    return denied(state, {
      agreementId: job.agreementId,
      actorId: input.actorId,
      action: 'download',
      code: 'LINK_NOT_OWNED',
      now,
      correlationId: input.correlationId,
    });
  }

  if (isAgreementExportLinkExpired(job, now)) {
    const expiredJob: AgreementExportJob = { ...job, status: 'expired' };
    const expiredState: AgreementExportState = {
      ...state,
      jobs: state.jobs.map((candidate) => (candidate.id === job.id ? expiredJob : candidate)),
    };
    return denied(expiredState, {
      agreementId: job.agreementId,
      actorId: input.actorId,
      action: 'download',
      code: 'LINK_EXPIRED',
      now,
      correlationId: input.correlationId,
    });
  }

  if (job.downloadedAt) {
    return { state, result: { ok: true, value: { job, bundle: job.bundle } } };
  }

  const downloadedJob: AgreementExportJob = { ...job, downloadedAt: now.toISOString() };
  const audit: AgreementExportAuditEntry = {
    id: nextAuditId(state),
    agreementId: job.agreementId,
    actorId: input.actorId,
    action: 'download',
    outcome: 'success',
    occurredAt: now.toISOString(),
    correlationId: input.correlationId,
  };

  return {
    state: {
      jobs: state.jobs.map((candidate) => (candidate.id === job.id ? downloadedJob : candidate)),
      audit: [...state.audit, audit],
    },
    result: { ok: true, value: { job: downloadedJob, bundle: downloadedJob.bundle } },
  };
}
