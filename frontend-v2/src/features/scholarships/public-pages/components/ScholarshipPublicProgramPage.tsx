'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { formatAwardAmount, publicProgramService } from '../service';
import type { PublicPageRevision, PublicProgramPage } from '../types';

export type PublicProgramLoadState = 'loading' | 'ready' | 'error';

export type ScholarshipPublicProgramPageProps = {
  slug: string;
  /**
   * `undefined` loads the page from the service on mount; `null` is an explicit
   * empty state (the slug exists but has no published revision).
   */
  page?: PublicProgramPage | null;
  revisions?: PublicPageRevision[];
  state?: PublicProgramLoadState;
  errorMessage?: string;
  canManage?: boolean;
};

const PANEL =
  'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm';
const FOCUS = 'focus:outline-none focus:ring-2 focus:ring-emerald-200';

export function ScholarshipPublicProgramPage({
  slug,
  page: pageProp,
  revisions: revisionsProp,
  state: stateProp,
  errorMessage,
  canManage = false,
}: ScholarshipPublicProgramPageProps) {
  const headingId = useId();
  const linkInputId = `${headingId}-canonical`;
  const [page, setPage] = useState<PublicProgramPage | null | undefined>(pageProp);
  const [revisions, setRevisions] = useState<PublicPageRevision[]>(revisionsProp ?? []);
  const [state, setState] = useState<PublicProgramLoadState>(stateProp ?? 'loading');
  const [failure, setFailure] = useState<string>(errorMessage ?? '');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (pageProp !== undefined) {
      setPage(pageProp);
      setState(stateProp ?? 'ready');
      setFailure(errorMessage ?? '');
    }
  }, [pageProp, stateProp, errorMessage]);

  useEffect(() => {
    if (pageProp !== undefined) return;
    let cancelled = false;
    setState('loading');
    setFailure('');
    publicProgramService
      .get(slug)
      .then((loaded) => {
        if (cancelled) return;
        setPage(loaded);
        setState('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPage(null);
        setState('error');
        setFailure(err instanceof Error ? err.message : 'The public program page could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
  }, [slug, pageProp]);

  const copyCanonicalLink = useCallback(async () => {
    if (!page) return;
    try {
      await navigator.clipboard.writeText(page.canonicalUrl);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }, [page]);

  if (state === 'loading') {
    return (
      <div className={PANEL} role="status" aria-live="polite" data-testid="public-page-loading">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Loading public program page</h1>
        <p className="mt-2 text-sm text-slate-600">
          Fetching the published program for <span className="font-mono">{slug}</span>.
        </p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div
        className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800"
        role="alert"
        data-testid="public-page-error"
      >
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          The public program page is unavailable
        </h1>
        <p className="mt-2">{failure || 'The public program page could not be loaded.'}</p>
        <p className="mt-3">
          Next step: confirm the slug <span className="font-mono">{slug}</span> is correct and that the
          program is published, then retry.
        </p>
      </div>
    );
  }

  if (!page) {
    return (
      <div
        className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600"
        role="status"
        aria-live="polite"
        data-testid="public-page-empty"
      >
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">No public program page</h1>
        <p className="mt-2">
          Nothing has been published at <span className="font-mono">{slug}</span> yet. Next step: an
          administrator can publish the program from the public programs list.
        </p>
      </div>
    );
  }

  if (page.visibility !== 'public' || page.publishedFields.length === 0) {
    const refused = page.visibility === 'invitation-only' || page.visibility === 'unpublished';
    return (
      <section className={PANEL} aria-labelledby={headingId} data-testid="public-page-refused">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Publication status: not available
        </p>
        <h1 id={headingId} className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          This program is not available publicly
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {refused
            ? `The program "${page.programId}" is marked "${page.visibility}" and is never published to a shareable page.`
            : 'No publishable field is available for this program, so nothing is shared publicly.'}
        </p>
        {canManage && (
          <p className="mt-3 text-sm text-slate-600">
            Next step: review the field publishability settings, then publish a revision.
          </p>
        )}
        {!canManage && (
          <p className="mt-3 text-sm text-slate-600" role="note">
            Ask the program administrator for a shareable link once the program is published.
          </p>
        )}
      </section>
    );
  }

  return (
    <article className={PANEL} aria-labelledby={headingId} data-testid="public-page-ready">
      <header className="border-b border-slate-100 pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Public program &mdash; revision {page.revision}
        </p>
        <h1 id={headingId} className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          {page.title}
        </h1>
        {page.summary && <p className="mt-2 text-base text-slate-600">{page.summary}</p>}
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
          <span aria-hidden="true">&#10003;</span> Published
          {page.publishedAt ? ` on ${page.publishedAt.slice(0, 10)}` : ''}
        </p>
      </header>

      <section className="mt-6" aria-labelledby={`${headingId}-facts`}>
        <h2 id={`${headingId}-facts`} className="text-lg font-semibold text-slate-900">
          Program facts
        </h2>
        <dl className="mt-3 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Award</dt>
            <dd className="mt-2 text-2xl font-bold text-slate-900">
              {formatAwardAmount(page)}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Application deadline
            </dt>
            <dd className="mt-2 text-2xl font-bold text-slate-900">
              {page.applicationDeadline || 'Not published'}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Sponsor</dt>
            <dd className="mt-2 text-2xl font-bold text-slate-900">
              {page.sponsorName || 'Not published'}
            </dd>
          </div>
        </dl>
      </section>

      {page.description && (
        <section className="mt-6" aria-labelledby={`${headingId}-description`}>
          <h2 id={`${headingId}-description`} className="text-lg font-semibold text-slate-900">
            About this program
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{page.description}</p>
        </section>
      )}

      {page.eligibilitySummary.length > 0 && (
        <section className="mt-6" aria-labelledby={`${headingId}-eligibility`}>
          <h2 id={`${headingId}-eligibility`} className="text-lg font-semibold text-slate-900">
            Who can apply
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            {page.eligibilitySummary.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6" aria-labelledby={`${headingId}-share`}>
        <h2 id={`${headingId}-share`} className="text-lg font-semibold text-slate-900">
          Share this page
        </h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor={linkInputId} className="block text-sm font-medium text-slate-700">
              Canonical link
            </label>
            <input
              id={linkInputId}
              readOnly
              value={page.canonicalUrl}
              className={`mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 ${FOCUS}`}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void copyCanonicalLink()}
              className={`rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 ${FOCUS}`}
            >
              Copy link
            </button>
            <a
              href={page.canonicalUrl}
              target="_blank"
              rel="noreferrer noopener"
              className={`rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 ${FOCUS}`}
            >
              Preview page
            </a>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-600" role="status" aria-live="polite">
          {copyState === 'copied' && 'Link copied to the clipboard.'}
          {copyState === 'failed' &&
            'The clipboard is unavailable in this browser. Select the link above and copy it manually.'}
        </p>
      </section>

      <section className="mt-6" aria-labelledby={`${headingId}-metadata`}>
        <h2 id={`${headingId}-metadata`} className="text-lg font-semibold text-slate-900">
          Indexable metadata
        </h2>
        <details className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <summary className={`cursor-pointer text-sm font-semibold text-indigo-700 ${FOCUS}`}>
            Show the JSON-LD payload emitted for search engines
          </summary>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
            <code>{JSON.stringify(page.structuredData, null, 2)}</code>
          </pre>
          <p className="mt-2 text-xs text-slate-500">
            Only whitelisted program fields reach this payload &mdash; no applicant, reviewer, or
            selection data.
          </p>
        </details>
      </section>

      <section className="mt-6" aria-labelledby={`${headingId}-revisions`}>
        <h2 id={`${headingId}-revisions`} className="text-lg font-semibold text-slate-900">
          Revision history
        </h2>
        {revisions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600" role="status" aria-live="polite">
            No revisions recorded yet. Next step: publish a revision to create one.
          </p>
        ) : (
          <ol className="mt-2 space-y-2">
            {revisions.map((revision) => (
              <li
                key={`${revision.slug}-${revision.revision}`}
                className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600"
              >
                <span className="font-semibold text-slate-900">Revision {revision.revision}</span>
                {' · '}
                published {revision.publishedAt} by {revision.publishedBy}
                {' · '}
                <span className="font-mono text-xs">checksum {revision.checksum}</span>
                <p className="mt-1 text-xs text-slate-500">{revision.note}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}

export default ScholarshipPublicProgramPage;
