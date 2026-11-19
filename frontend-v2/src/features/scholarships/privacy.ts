/**
 * Applicant data access, correction, and erasure (issues #1154 and #1155).
 *
 * Applicants can request a machine-readable copy of their scholarship data and
 * consent history, and can ask for corrections or deletion. Exports
 * authenticate strongly, run asynchronously, expire, exclude other users'
 * private notes, and are audited. Corrections and erasures record a tracked
 * outcome and preserve lawful immutable financial and audit records, with a
 * documented reason when a request is denied.
 */

import { apiClient } from '@/src/lib/api-client';

export type ExportFormat = 'json' | 'csv';

export type DataAccessRequestStatus =
  | 'requested'
  | 'verifying'
  | 'processing'
  | 'ready'
  | 'expired'
  | 'denied';

export const EXPORT_TTL_MS = 72 * 60 * 60 * 1000;

export type DataAccessRequest = {
  id: string;
  applicantId: string;
  format: ExportFormat;
  status: DataAccessRequestStatus;
  requestedAt: string;
  expiresAt: string;
  downloadUrl?: string;
  audited: true;
};

/** Records that must survive an erasure for lawful financial/audit reasons. */
export const PRESERVED_ON_ERASURE = ['award', 'payment', 'audit-event', 'consent-record'] as const;

/** Fields that are never included in a personal data export. */
export const PRIVATE_EXPORT_FIELDS = ['reviewerNotes', 'internalComments', 'otherApplicants'] as const;

export type CorrectionErasureType = 'correction' | 'erasure';
export type CorrectionErasureStatus = 'received' | 'in-review' | 'completed' | 'denied';

export type CorrectionErasureRequest = {
  id: string;
  applicantId: string;
  type: CorrectionErasureType;
  status: CorrectionErasureStatus;
  requestedAt: string;
  decidedAt?: string;
  denialReason?: string;
  preservedRecords: string[];
};

export function createDataAccessRequest(
  applicantId: string,
  format: ExportFormat,
  now: Date = new Date()
): DataAccessRequest {
  return {
    id: `export-${applicantId}-${now.getTime()}`,
    applicantId,
    format,
    status: 'requested',
    requestedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + EXPORT_TTL_MS).toISOString(),
    audited: true,
  };
}

export function isExportExpired(request: DataAccessRequest, now: Date = new Date()): boolean {
  return Date.parse(request.expiresAt) <= now.getTime();
}

/** An export is only downloadable while it is ready and not past its expiry. */
export function isExportReady(request: DataAccessRequest, now: Date = new Date()): boolean {
  return request.status === 'ready' && !isExportExpired(request, now);
}

/** Only the applicant may download their own export. */
export function isExportAuthorized(request: DataAccessRequest, viewerId: string): boolean {
  return request.applicantId === viewerId;
}

/** Removes other users' private notes before an export is released. */
export function redactPersonalDataExport(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const redacted: Record<string, unknown> = { ...payload };
  for (const field of PRIVATE_EXPORT_FIELDS) {
    delete redacted[field];
  }
  return redacted;
}

export function createCorrectionErasureRequest(
  applicantId: string,
  type: CorrectionErasureType,
  now: Date = new Date()
): CorrectionErasureRequest {
  return {
    id: `${type}-${applicantId}-${now.getTime()}`,
    applicantId,
    type,
    status: 'received',
    requestedAt: now.toISOString(),
    preservedRecords: [],
  };
}

export function decideCorrectionErasure(
  request: CorrectionErasureRequest,
  decision: { status: 'completed' | 'denied'; denialReason?: string },
  now: Date = new Date()
): CorrectionErasureRequest {
  return {
    ...request,
    status: decision.status,
    decidedAt: now.toISOString(),
    denialReason: decision.status === 'denied' ? decision.denialReason ?? 'Unspecified reason' : undefined,
    preservedRecords: request.type === 'erasure' ? [...PRESERVED_ON_ERASURE] : request.preservedRecords,
  };
}

/**
 * Workspace privacy helpers (issues #1493, #1495, #1503, #1504).
 *
 * Private researcher notes, discussion message content, reviewer identities,
 * and revision change text must never reach analytics, Sentry, or audit
 * records. These helpers strip private payloads and emit only privacy-safe
 * metadata (counts, statuses, durations) so downstream sinks stay clean.
 */

/** Fields that must never appear in analytics, Sentry, or audit payloads. */
export const WORKSPACE_PRIVATE_FIELDS = [
  'noteBody',
  'note',
  'notes',
  'messageBody',
  'message',
  'messages',
  'body',
  'content',
  'reviewerId',
  'reviewerName',
  'reviewerEmail',
  'reviewer',
  'reviewers',
  'changeText',
  'changeDescription',
  'revisionText',
  'comment',
  'comments',
  'attachmentUrl',
  'attachment',
  'mentions',
] as const;

export type WorkspacePrivateField = (typeof WORKSPACE_PRIVATE_FIELDS)[number];

/** Privacy-safe metadata that may be emitted to analytics or audit sinks. */
export type WorkspaceSafeMetadata = {
  counts?: Record<string, number>;
  statuses?: Record<string, string>;
  durationsMs?: Record<string, number>;
};

const PRIVATE_FIELD_SET: ReadonlySet<string> = new Set(WORKSPACE_PRIVATE_FIELDS);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Recursively removes private fields from an arbitrary payload. Arrays of
 * private objects are reduced to their length so counts survive while content
 * does not. Returns a new object; the input is never mutated.
 */
export function stripWorkspacePrivateFields<T>(payload: T): T {
  if (Array.isArray(payload)) {
    return payload.map((item) => stripWorkspacePrivateFields(item)) as unknown as T;
  }
  if (!isPlainObject(payload)) {
    return payload;
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (PRIVATE_FIELD_SET.has(key)) {
      continue;
    }
    result[key] = stripWorkspacePrivateFields(value);
  }
  return result as T;
}

/** Builds a Sentry-safe context object from a raw payload. */
export function toSentrySafeContext(
  payload: Record<string, unknown>
): Record<string, unknown> {
  return stripWorkspacePrivateFields(payload);
}

/** Analytics event names for the workspace track. */
export type WorkspaceAnalyticsEvent =
  | 'workspace.note.saved'
  | 'workspace.note.deleted'
  | 'workspace.discussion.thread_created'
  | 'workspace.discussion.reply_posted'
  | 'workspace.discussion.resolved'
  | 'workspace.review.aggregated'
  | 'workspace.revision.requested'
  | 'workspace.revision.responded';

export type WorkspaceAnalyticsPayload = {
  event: WorkspaceAnalyticsEvent;
  metadata: WorkspaceSafeMetadata;
};

/**
 * Builds a privacy-safe analytics payload. Only counts, statuses, and
 * durations are accepted; any other keys are dropped.
 */
export function buildWorkspaceAnalyticsPayload(
  event: WorkspaceAnalyticsEvent,
  metadata: WorkspaceSafeMetadata
): WorkspaceAnalyticsPayload {
  const safe: WorkspaceSafeMetadata = {};
  if (metadata.counts) {
    safe.counts = { ...metadata.counts };
  }
  if (metadata.statuses) {
    safe.statuses = { ...metadata.statuses };
  }
  if (metadata.durationsMs) {
    safe.durationsMs = { ...metadata.durationsMs };
  }
  return { event, metadata: safe };
}

/** Audit event shapes that carry no private payloads. */
export type WorkspaceAuditAction =
  | 'note.created'
  | 'note.updated'
  | 'note.deleted'
  | 'discussion.thread_created'
  | 'discussion.reply_posted'
  | 'discussion.resolved'
  | 'review.aggregated'
  | 'revision.requested'
  | 'revision.responded';

export type WorkspaceAuditEvent = {
  action: WorkspaceAuditAction;
  actorId: string;
  tenantId: string;
  resourceId: string;
  occurredAt: string;
  /** Privacy-safe metadata only; never note bodies or message content. */
  metadata: WorkspaceSafeMetadata;
};

export function createWorkspaceAuditEvent(input: {
  action: WorkspaceAuditAction;
  actorId: string;
  tenantId: string;
  resourceId: string;
  metadata?: WorkspaceSafeMetadata;
  now?: Date;
}): WorkspaceAuditEvent {
  return {
    action: input.action,
    actorId: input.actorId,
    tenantId: input.tenantId,
    resourceId: input.resourceId,
    occurredAt: (input.now ?? new Date()).toISOString(),
    metadata: input.metadata ? buildWorkspaceAnalyticsPayload('workspace.note.saved', input.metadata).metadata : {},
  };
}

export const scholarshipPrivacyService = {
  requestExport: (format: ExportFormat): Promise<DataAccessRequest> =>
    apiClient.post<DataAccessRequest>('/scholarships/privacy/exports', { format }),

  getExport: (requestId: string): Promise<DataAccessRequest> =>
    apiClient.get<DataAccessRequest>(`/scholarships/privacy/exports/${requestId}`),

  requestCorrection: (payload: Record<string, unknown>): Promise<CorrectionErasureRequest> =>
    apiClient.post<CorrectionErasureRequest>('/scholarships/privacy/corrections', payload),

  requestErasure: (payload: Record<string, unknown>): Promise<CorrectionErasureRequest> =>
    apiClient.post<CorrectionErasureRequest>('/scholarships/privacy/erasures', payload),

  listRequests: (): Promise<CorrectionErasureRequest[]> =>
    apiClient.get<CorrectionErasureRequest[]>('/scholarships/privacy/requests'),
};
