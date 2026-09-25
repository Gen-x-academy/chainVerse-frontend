/**
 * Sponsor and regulator audit exports (issue #1157).
 *
 * Produces scoped evidence packages covering program governance, decisions,
 * consent, funds, and payments. Exports require strong authorization, redact
 * applicants outside the reviewer's scope, include integrity metadata so the
 * package can be tamper-evident, and expire securely.
 */

import { apiClient } from '@/src/lib/api-client';
import { auditFingerprint, type ScholarshipAuditEvent } from './audit';

export type AuditExportAudience = 'sponsor' | 'regulator';

/** Sponsor and regulator viewers that may request an export. */
export type AuditExportViewerRole = 'sponsor-admin' | 'regulator' | 'support';

export type AuditExportScope = {
  programId: string;
  from: string;
  to: string;
};

export type AuditExportRequest = {
  id: string;
  audience: AuditExportAudience;
  scope: AuditExportScope;
  requestedBy: string;
  expiresAt: string;
};

export type AuditExportRecord = {
  eventId: string;
  actor: string;
  action: string;
  resourceId: string;
  outcome: string;
  occurredAt: string;
};

export type AuditExportPackage = {
  packageId: string;
  audience: AuditExportAudience;
  generatedAt: string;
  expiresAt: string;
  integrityHash: string;
  redactedApplicantIds: string[];
  records: AuditExportRecord[];
};

export const AUDIT_EXPORT_TTL_MS = 24 * 60 * 60 * 1000;

export function createAuditExportRequest(
  input: { audience: AuditExportAudience; scope: AuditExportScope; requestedBy: string },
  now: Date = new Date()
): AuditExportRequest {
  return {
    id: `audit-export-${now.getTime()}`,
    audience: input.audience,
    scope: input.scope,
    requestedBy: input.requestedBy,
    expiresAt: new Date(now.getTime() + AUDIT_EXPORT_TTL_MS).toISOString(),
  };
}

/** Sponsors require a sponsor admin; regulators require a regulator identity. */
export function isAuditExportAuthorized(
  audience: AuditExportAudience,
  viewerRole: AuditExportViewerRole
): boolean {
  return audience === 'sponsor' ? viewerRole === 'sponsor-admin' : viewerRole === 'regulator';
}

export function isAuditExportExpired(
  auditExport: AuditExportPackage,
  now: Date = new Date()
): boolean {
  return Date.parse(auditExport.expiresAt) <= now.getTime();
}

/** Program-level facts are safe to share; applicant-level facts are scoped. */
export function buildAuditExportPackage(
  events: ScholarshipAuditEvent[],
  request: AuditExportRequest,
  authorizedApplicantIds: string[],
  allApplicantIds: string[],
  now: Date = new Date()
): AuditExportPackage {
  const from = Date.parse(request.scope.from);
  const to = Date.parse(request.scope.to);
  const authorized = new Set(authorizedApplicantIds);

  const records: AuditExportRecord[] = events
    .filter((event) => {
      const occurredAt = Date.parse(event.occurredAt);
      if (Number.isNaN(occurredAt) || occurredAt < from || occurredAt > to) return false;
      if (event.action.startsWith('program.')) return true;
      return authorized.has(event.resourceId);
    })
    .map((event) => ({
      eventId: event.id,
      actor: event.actor,
      action: event.action,
      resourceId: event.resourceId,
      outcome: event.outcome,
      occurredAt: event.occurredAt,
    }));

  return {
    packageId: `package-${request.id}`,
    audience: request.audience,
    generatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + AUDIT_EXPORT_TTL_MS).toISOString(),
    integrityHash: auditFingerprint(JSON.stringify(records)),
    redactedApplicantIds: allApplicantIds.filter((applicantId) => !authorized.has(applicantId)),
    records,
  };
}

export const scholarshipAuditExportService = {
  request: (input: {
    audience: AuditExportAudience;
    scope: AuditExportScope;
  }): Promise<AuditExportRequest> =>
    apiClient.post<AuditExportRequest>('/scholarships/audit-exports', input),

  get: (requestId: string): Promise<AuditExportPackage> =>
    apiClient.get<AuditExportPackage>(`/scholarships/audit-exports/${requestId}`),
};
