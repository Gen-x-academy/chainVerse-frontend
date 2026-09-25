'use client';

import { useMemo, type ReactNode } from 'react';
import { appendAuditEvent, SECURITY_RELEVANT_READS, verifyAuditChain } from '../audit';
import {
  createCorrectionErasureRequest,
  createDataAccessRequest,
  decideCorrectionErasure,
  isExportExpired,
  redactPersonalDataExport,
} from '../privacy';
import {
  buildAuditExportPackage,
  createAuditExportRequest,
  isAuditExportAuthorized,
  isAuditExportExpired,
} from '../audit-export';

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <div className="mt-4 space-y-2 text-sm text-slate-700">{children}</div>
    </section>
  );
}

export function ScholarshipAuditPrivacyPanel() {
  const events = useMemo(() => {
    const first = appendAuditEvent(undefined, {
      actor: 'reviewer-1',
      action: 'application.read',
      resource: 'application',
      resourceId: 'application-1',
      outcome: 'success',
      requestId: 'request-1',
      occurredAt: '2026-09-24T10:00:00.000Z',
      changeMetadata: { changedFields: [], summary: 'Application viewed by reviewer' },
    });
    const second = appendAuditEvent(first, {
      actor: 'reviewer-1',
      action: 'decision.recorded',
      resource: 'application',
      resourceId: 'application-1',
      outcome: 'success',
      requestId: 'request-2',
      occurredAt: '2026-09-24T10:05:00.000Z',
      changeMetadata: { changedFields: ['status'], summary: 'Decision recorded' },
    });
    return [first, second];
  }, []);

  const chain = useMemo(() => verifyAuditChain(events), [events]);

  const exportRequest = useMemo(() => createDataAccessRequest('applicant-1', 'json'), []);
  const erasure = useMemo(
    () =>
      decideCorrectionErasure(
        createCorrectionErasureRequest('applicant-1', 'erasure'),
        { status: 'completed' }
      ),
    []
  );

  const auditExport = useMemo(() => {
    const request = createAuditExportRequest({
      audience: 'regulator',
      scope: { programId: 'program-1', from: '2026-09-01T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z' },
      requestedBy: 'regulator-1',
    });
    const pkg = buildAuditExportPackage(events, request, ['application-1'], ['application-1', 'application-2']);
    return { request, pkg };
  }, [events]);

  const redactedExport = redactPersonalDataExport({
    applicantId: 'applicant-1',
    reviewerNotes: 'private reviewer note',
    status: 'approved',
  });

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 text-slate-900">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Scholarships audit &amp; privacy
        </p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Immutable audit trail, data access &amp; erasure
        </h1>
        <p className="max-w-2xl text-sm text-slate-600 md:text-base">
          Append-only, hash-chained audit events, applicant data access and export, correction and
          erasure handling that preserves lawful records, and scoped audit exports.
        </p>
      </header>

      <Panel
        title="Immutable audit trail"
        description="Every event links to the previous one by hash; edits break the chain."
      >
        <p role="status" aria-live="polite">
          Chain status: {chain.valid ? 'intact' : `broken at ${chain.brokenAt}`}
        </p>
        <p>Security-relevant reads recorded: {SECURITY_RELEVANT_READS.join(', ')}</p>
        <ul className="list-disc pl-5" aria-label="Recent audit events">
          {events.map((event) => (
            <li key={event.id}>
              #{event.sequence} {event.action} · {event.outcome} · {event.actor}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Applicant data access"
        description="Exports are asynchronous, expiring, and exclude other users' private notes."
      >
        <p>
          Request {exportRequest.id} · {exportRequest.format} · expires{' '}
          {new Date(exportRequest.expiresAt).toISOString().slice(0, 10)}
        </p>
        <p>Expired: {isExportExpired(exportRequest) ? 'yes' : 'no'}</p>
        <p>Excluded private fields: {'reviewerNotes' in redactedExport ? 'no' : 'yes'}</p>
      </Panel>

      <Panel
        title="Correction & erasure"
        description="Outcomes are tracked and lawful financial and audit records are preserved."
      >
        <p>
          Erasure {erasure.id}: {erasure.status}
        </p>
        <p>Preserved records: {erasure.preservedRecords.join(', ') || 'none'}</p>
      </Panel>

      <Panel
        title="Sponsor & regulator audit exports"
        description="Exports require strong authorization and redact unrelated applicants."
      >
        <p>
          Regulator export authorized:{' '}
          {isAuditExportAuthorized(auditExport.request.audience, 'regulator') ? 'yes' : 'no'}
        </p>
        <p>Redacted applicant ids: {auditExport.pkg.redactedApplicantIds.join(', ') || 'none'}</p>
        <p>Integrity hash: {auditExport.pkg.integrityHash}</p>
        <p>Expired: {isAuditExportExpired(auditExport.pkg) ? 'yes' : 'no'}</p>
      </Panel>
    </section>
  );
}

export default ScholarshipAuditPrivacyPanel;
