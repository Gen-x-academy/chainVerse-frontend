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
