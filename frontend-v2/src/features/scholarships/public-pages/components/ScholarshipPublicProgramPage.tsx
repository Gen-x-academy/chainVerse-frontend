'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { formatAwardAmount, publicProgramService } from '../service';
import type { PublicPageRevision, PublicProgramPage, PublicProgramSummary } from '../types';

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
  /**
   * Publicly listed programs for the browse/filter UI (#1136). Omitted means no
   * catalog is rendered, so a single-program page is unaffected.
   */
  catalog?: PublicProgramSummary[];
  /** Server-ranked matches for the signed-in student (#1137). */
  matches?: ScholarshipMatch[];
  /** Program IDs the student dismissed; they are filtered out of matches. */
  dismissedProgramIds?: string[];
  /** Current catalog filter state, when the host keeps it in the URL. */
  filters?: CatalogFilters;
  catalogPage?: number;
  onFiltersChange?: (filters: CatalogFilters) => void;
  onDismissMatch?: (programId: string) => void;
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
  catalog = [],
  matches = [],
  dismissedProgramIds = [],
  filters = {},
  catalogPage = 1,
  onFiltersChange,
  onDismissMatch,
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

  // Catalog state is derived on every render so the list, the counts and the
  // page number can never disagree with each other.
  const filteredCatalog = filterCatalog(catalog, filters);
  const catalogPageState = catalogCounts(catalog, filters);
  const pagedCatalog = paginateCatalog(filteredCatalog, catalogPage, 6);

  // Matches are ranked and sanitized before they reach the DOM; a match whose
  // reasons referenced a protected trait is dropped entirely.
  const rankedMatches = rankMatches(matches, dismissedProgramIds);
  const coldStartMatches = rankedMatches.filter((match) => match.coldStart);

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

      {rankedMatches.length > 0 && (
        <section className="mt-6" aria-labelledby={`${headingId}-matches`} data-testid="public-page-matches">
          <h2 id={`${headingId}-matches`} className="text-lg font-semibold text-slate-900">
            Recommended for you
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Ranked from your verified eligibility and the interests you stated. Sponsors never see these
            signals.
          </p>
          {coldStartMatches.length > 0 && (
            <p
              className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
              role="note"
              data-testid="public-page-matches-cold-start"
            >
              You have no verified eligibility on file yet, so these suggestions use your stated interests
              only and may be less precise.
            </p>
          )}
          <ul className="mt-3 space-y-3">
            {rankedMatches.map((match) => (
              <li key={match.programId} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{match.slug}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Match {Math.round(match.score * 100)}%
                      {match.coldStart ? ' · based on stated interests only' : ''}
                    </p>
                  </div>
                  {onDismissMatch && (
                    <button
                      type="button"
                      onClick={() => onDismissMatch(match.programId)}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                    >
                      Not interested
                    </button>
                  )}
                </div>
                {/* Recommendations always explain themselves. */}
                <ul className="mt-2 flex flex-wrap gap-2">
                  {match.reasons.map((reason) => (
                    <li
                      key={reason.code}
                      className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800"
                    >
                      {reason.label}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      {catalog.length > 0 && (
        <section className="mt-6" aria-labelledby={`${headingId}-catalog`} data-testid="public-page-catalog">
          <h2 id={`${headingId}-catalog`} className="text-lg font-semibold text-slate-900">
            Browse open programs
          </h2>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Search
              <input
                type="search"
                value={filters.search ?? ''}
                onChange={(event) =>
                  onFiltersChange?.({ ...filters, search: event.target.value })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Minimum award
              <input
                type="number"
                min={0}
                value={filters.awardMin ?? ''}
                onChange={(event) => {
                  const raw = Number(event.target.value);
                  onFiltersChange?.({
                    ...filters,
                    ...(Number.isFinite(raw) && raw > 0 ? { awardMin: raw } : { awardMin: undefined }),
                  });
                }}
                className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Open on
              <input
                type="date"
                value={filters.openOn ?? ''}
                onChange={(event) =>
                  onFiltersChange?.({ ...filters, openOn: event.target.value || undefined })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900"
              />
            </label>
          </div>

          {/* Counts always describe the current query, not the whole catalog. */}
          <p className="mt-3 text-sm text-slate-600" role="status" aria-live="polite">
            Showing {catalogPageState.matching} of {catalogPageState.total} listed program(s)
            {catalogPageState.excludedPrivate > 0
              ? ` · ${catalogPageState.excludedPrivate} not publicly listed and hidden`
              : ''}
          </p>

          {catalogPageState.matching === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              No programs match these filters. Next step: widen the search or clear the minimum award.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {pagedCatalog.items.map((program) => (
                <li key={program.slug} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="font-semibold text-slate-900">{program.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{program.summary}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatAwardAmount(program)} · closes {program.applicationDeadline || 'not published'}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {catalogPageState.matching > 0 && (
            <p className="mt-3 text-xs text-slate-600">
              Page {pagedCatalog.page} of {pagedCatalog.pageCount}
            </p>
          )}
        </section>
      )}
    </article>
  );
}

export default ScholarshipPublicProgramPage;

// ---------------------------------------------------------------------------
// Catalog search and filters (#1136)
// ---------------------------------------------------------------------------

export type CatalogFilters = {
  search?: string;
  /** Minimum award in the program's own currency units. */
  awardMin?: number;
  /** ISO date; only programs still open on this date are returned. */
  openOn?: string;
  fundingType?: 'award' | 'bursary' | 'sponsorship';
};

/** Only fully public programs belong in a public catalog. */
export function isPubliclyListed(program: PublicProgramSummary): boolean {
  return program.visibility === 'public';
}

function matchesSearch(program: PublicProgramSummary, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  return (
    program.title.toLowerCase().includes(needle) ||
    program.summary.toLowerCase().includes(needle)
  );
}

/**
 * Apply catalog filters. Every predicate is conjunctive, so the result always
 * matches the query exactly rather than being a best-effort ordering.
 */
export function filterCatalog(
  programs: PublicProgramSummary[],
  filters: CatalogFilters
): PublicProgramSummary[] {
  return programs.filter((program) => {
    if (!isPubliclyListed(program)) return false;
    if (filters.search && !matchesSearch(program, filters.search)) return false;
    if (filters.fundingType && !program.summary.toLowerCase().includes(filters.fundingType)) {
      return false;
    }
    if (typeof filters.awardMin === 'number') {
      if (program.awardAmountCents < filters.awardMin * 100) return false;
    }
    if (filters.openOn) {
      const deadline = Date.parse(program.applicationDeadline);
      const on = Date.parse(filters.openOn);
      if (Number.isNaN(deadline) || Number.isNaN(on) || deadline < on) return false;
    }
    return true;
  });
}

/** Counts per filter value, computed against the same filtered set. */
export function catalogCounts(
  programs: PublicProgramSummary[],
  filters: CatalogFilters
): { total: number; matching: number; excludedPrivate: number } {
  const matching = filterCatalog(programs, filters).length;
  return {
    total: programs.length,
    matching,
    excludedPrivate: programs.filter((program) => !isPubliclyListed(program)).length,
  };
}

/** Filters are URL-backed so a filtered view can be shared as a link. */
export function parseFiltersFromSearch(search: string): CatalogFilters {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const awardMin = Number(params.get('awardMin'));
  return {
    ...(params.get('search') ? { search: params.get('search') as string } : {}),
    ...(params.get('fundingType')
      ? { fundingType: params.get('fundingType') as CatalogFilters['fundingType'] }
      : {}),
    ...(params.get('openOn') ? { openOn: params.get('openOn') as string } : {}),
    ...(Number.isFinite(awardMin) && awardMin > 0 ? { awardMin } : {}),
  };
}

export function filtersToSearch(filters: CatalogFilters): string {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.fundingType) params.set('fundingType', filters.fundingType);
  if (filters.openOn) params.set('openOn', filters.openOn);
  if (typeof filters.awardMin === 'number' && filters.awardMin > 0) {
    params.set('awardMin', String(filters.awardMin));
  }
  const serialised = params.toString();
  return serialised ? `?${serialised}` : '';
}

export type CatalogPage<T> = {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

/**
 * Clamp pagination to the available range so an out-of-range or stale page
 * number resolves to a valid page instead of an empty view.
 */
export function paginateCatalog<T>(items: T[], page: number, pageSize: number): CatalogPage<T> {
  const size = Math.max(1, pageSize);
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const start = (current - 1) * size;

  return {
    items: items.slice(start, start + size),
    page: current,
    pageCount,
    total: items.length,
    hasPrevious: current > 1,
    hasNext: current < pageCount,
  };
}

// ---------------------------------------------------------------------------
// Personalized matching (#1137)
// ---------------------------------------------------------------------------

/**
 * Attributes that must never influence ranking.
 *
 * Matching is driven only by verified eligibility and stated interests. A
 * protected trait may only be used where there is a documented legal basis,
 * which is a server policy decision — the browser has no way to justify one, so
 * it refuses them outright rather than silently ranking on them.
 */
export const PROTECTED_TRAIT_KEYS = [
  'age',
  'dateofbirth',
  'dob',
  'sex',
  'gender',
  'race',
  'ethnicity',
  'religion',
  'disability',
  'nationality',
  'maritalstatus',
  'pregnancy',
  'sexualorientation',
] as const;

export type MatchReasonCode =
  | 'VERIFIED_ELIGIBILITY'
  | 'STATED_INTEREST'
  | 'AWARD_SIZE'
  | 'DEADLINE_SOON'
  | 'SIMILAR_PROGRAM';

export type MatchReason = {
  code: MatchReasonCode;
  label: string;
};

export type ScholarshipMatch = {
  programId: string;
  slug: string;
  /** Server-computed 0–1 score. The browser never derives this. */
  score: number;
  reasons: MatchReason[];
  /**
   * True when the student has no verified eligibility on file and the ranking
   * fell back to stated interests alone.
   */
  coldStart: boolean;
};

export function isProtectedTrait(key: string): boolean {
  const normalised = key.toLowerCase().replace(/[\s_-]/g, '');
  return (PROTECTED_TRAIT_KEYS as readonly string[]).some((trait) => normalised.includes(trait));
}

/**
 * Drop any reason that would disclose a protected trait, and refuse to rank a
 * program whose score was derived from one.
 */
export function sanitizeMatch(match: ScholarshipMatch): ScholarshipMatch | null {
  const reasons = match.reasons.filter((reason) => !isProtectedTrait(reason.label));
  if (reasons.length !== match.reasons.length) {
    return null;
  }
  if (reasons.length === 0) return null;
  return { ...match, reasons };
}

/** Highest score first; ties broken by programId so ordering is stable. */
export function rankMatches(
  matches: ScholarshipMatch[],
  dismissed: string[] = []
): ScholarshipMatch[] {
  const dismissedSet = new Set(dismissed);
  return matches
    .map(sanitizeMatch)
    .filter((match): match is ScholarshipMatch => match !== null)
    .filter((match) => !dismissedSet.has(match.programId))
    .sort((a, b) => (b.score - a.score) || a.programId.localeCompare(b.programId));
}
