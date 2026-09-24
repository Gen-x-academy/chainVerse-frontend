'use client';

import { useEffect, useMemo, useState } from 'react';
import { useScholarshipProgramsStore } from './store';
import type { ProgramTermRevision } from './types';

type PublishedProgramTermsProps = {
  programId?: string;
  programName?: string;
  canReview?: boolean;
  applicationId?: string;
};

export function PublishedProgramTerms({
  programId = 'chainverse-scholarship',
  programName = 'ChainVerse Scholarship',
  canReview = true,
  applicationId = 'application-demo-001',
}: PublishedProgramTermsProps) {
  const { revisions, loading, error, fetchProgramTerms, acceptTerms, acceptedRevisionId } = useScholarshipProgramsStore();
  const [expandedRevisionId, setExpandedRevisionId] = useState<string | null>(null);

  useEffect(() => {
    void fetchProgramTerms(programId);
  }, [fetchProgramTerms, programId]);

  useEffect(() => {
    if (revisions.length > 0 && !expandedRevisionId) {
      setExpandedRevisionId(revisions[0].id);
    }
  }, [expandedRevisionId, revisions]);

  const currentRevision = useMemo(
    () => revisions.find((revision) => revision.version === '2025.03') ?? revisions[0] ?? null,
    [revisions],
  );

  const handleAccept = async (revision: ProgramTermRevision) => {
    if (!canReview) return;

    await acceptTerms({
      applicationId,
      programId,
      revisionId: revision.id,
      termsVersion: revision.version,
      integrityHash: revision.integrityHash,
    });
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600" role="status" aria-live="polite">
        Loading published program terms...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700" role="alert">
        {error}
      </div>
    );
  }

  if (!revisions.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600" role="status" aria-live="polite">
        No published program terms are available right now.
      </div>
    );
  }

  return (
    <section aria-labelledby="program-terms-heading" className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Program terms</p>
          <h2 id="program-terms-heading" className="mt-2 text-3xl font-black text-slate-900">{programName}</h2>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
          {currentRevision?.version ?? 'v1'} published
        </span>
      </div>

      {!canReview && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="note">
          You do not have permission to accept these terms.
        </div>
      )}

      <div className="mt-6 space-y-4" aria-live="polite">
        {revisions.map((revision) => {
          const isExpanded = expandedRevisionId === revision.id;
          const isAccepted = acceptedRevisionId === revision.id;

          return (
            <article key={revision.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedRevisionId(isExpanded ? null : revision.id)}
                  className="text-left text-lg font-semibold text-slate-900 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  {revision.revisionLabel}
                </button>

                <div className="flex items-center gap-2">
                  {revision.immutable && (
                    <span className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                      Immutable
                    </span>
                  )}
                  {isAccepted && (
                    <span className="rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                      Accepted
                    </span>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="mt-4 space-y-4">
                  <p className="text-sm text-slate-600">{revision.summary}</p>

                  <dl className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <dt className="font-medium text-slate-500">Version</dt>
                      <dd className="mt-1 font-mono text-base text-slate-900">{revision.version}</dd>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <dt className="font-medium text-slate-500">Published</dt>
                      <dd className="mt-1 text-base text-slate-900">{new Date(revision.publishedAt).toLocaleString()}</dd>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <dt className="font-medium text-slate-500">Award value</dt>
                      <dd className="mt-1 text-base text-slate-900">{revision.awardValue}</dd>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <dt className="font-medium text-slate-500">Integrity hash</dt>
                      <dd className="mt-1 break-all font-mono text-[11px] text-slate-900">{revision.integrityHash}</dd>
                    </div>
                  </dl>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-600">Eligibility</h3>
                      <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-700">
                        {revision.eligibility.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-600">Obligations</h3>
                      <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-700">
                        {revision.obligations.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-600">Key deadlines</h3>
                    <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-700">
                      {revision.deadlines.map((item) => (
                        <li key={item.label}><span className="font-medium text-slate-900">{item.label}:</span> {item.value}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-600">Revision history</h3>
                    <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-700">
                      {revision.changelog.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-500">
                      Each revision is immutable and published once. Previous terms remain available for audit and applicant history.
                    </p>
                    <button
                      type="button"
                      disabled={!canReview || isAccepted}
                      onClick={() => void handleAccept(revision)}
                      className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isAccepted ? 'Accepted' : 'Accept this version'}
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
