'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type TimelineEntryKind =
  | 'objective'
  | 'task'
  | 'milestone'
  | 'decision'
  | 'review'
  | 'funding'
  | 'charter_change';

export type TimelineEntryStatus =
  | 'planned'
  | 'active'
  | 'completed'
  | 'blocked'
  | 'cancelled';

export interface TimelineEntry {
  id: string;
  kind: TimelineEntryKind;
  title: string;
  summary?: string;
  status: TimelineEntryStatus;
  occurredAt: string;
  updatedAt?: string;
  actorRole?: string;
  href?: string;
}

export interface ProjectTimeline {
  projectId: string;
  projectName: string;
  generatedAt: string;
  entries: TimelineEntry[];
}

export type TimelineCapability =
  | 'project.timeline.read'
  | 'project.timeline.manage';

export interface TimelineViewer {
  userId: string;
  roles: string[];
  capabilities: string[];
}

export type TimelineLoadState =
  | { status: 'loading' }
  | { status: 'empty'; timeline: ProjectTimeline }
  | { status: 'success'; timeline: ProjectTimeline }
  | { status: 'error'; message: string; retryable: boolean }
  | {
      status: 'conflict';
      message: string;
      staleSince?: string;
      retryable: boolean;
    }
  | { status: 'forbidden'; message: string };

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const REQUIRED_CAPABILITY: TimelineCapability = 'project.timeline.read';

const KIND_ORDER: TimelineEntryKind[] = [
  'objective',
  'task',
  'milestone',
  'decision',
  'review',
  'funding',
  'charter_change',
];

const KIND_LABELS: Record<TimelineEntryKind, string> = {
  objective: 'Objectives',
  task: 'Tasks',
  milestone: 'Milestones',
  decision: 'Decisions',
  review: 'Reviews',
  funding: 'Funding',
  charter_change: 'Charter changes',
};

const KIND_DESCRIPTIONS: Record<TimelineEntryKind, string> = {
  objective: 'Project objectives and their progress.',
  task: 'Work items tracked against the project plan.',
  milestone: 'Key delivery checkpoints.',
  decision: 'Recorded governance decisions.',
  review: 'Reviews and approvals.',
  funding: 'Funding events and allocations.',
  charter_change: 'Changes to the project charter.',
};

const STATUS_LABELS: Record<TimelineEntryStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  completed: 'Completed',
  blocked: 'Blocked',
  cancelled: 'Cancelled',
};

/* -------------------------------------------------------------------------- */
/* Analytics (privacy-safe)                                                   */
/* -------------------------------------------------------------------------- */

type AnalyticsEvent =
  | 'timeline_viewed'
  | 'timeline_retry'
  | 'timeline_conflict_refresh'
  | 'timeline_entry_opened';

interface AnalyticsPayload {
  projectId: string;
  entryKind?: TimelineEntryKind;
}

function emitAnalytics(event: AnalyticsEvent, payload: AnalyticsPayload): void {
  // Privacy boundary: only project id and entry kind are ever emitted.
  // No titles, summaries, actors, amounts, or free text leave the client.
  if (typeof window === 'undefined') return;
  try {
    const detail = {
      event,
      projectId: payload.projectId,
      ...(payload.entryKind ? { entryKind: payload.entryKind } : {}),
    };
    window.dispatchEvent(
      new CustomEvent('chainverse:analytics', { detail }),
    );
  } catch {
    // Analytics must never break the user journey.
  }
}

/* -------------------------------------------------------------------------- */
/* Service                                                                    */
/* -------------------------------------------------------------------------- */

export class TimelineServiceError extends Error {
  readonly kind: 'network' | 'conflict' | 'forbidden' | 'unknown';
  readonly retryable: boolean;
  readonly staleSince?: string;

  constructor(
    message: string,
    kind: TimelineServiceError['kind'],
    retryable: boolean,
    staleSince?: string,
  ) {
    super(message);
    this.name = 'TimelineServiceError';
    this.kind = kind;
    this.retryable = retryable;
    this.staleSince = staleSince;
  }
}

export interface TimelineService {
  fetchTimeline(
    projectId: string,
    signal?: AbortSignal,
  ): Promise<ProjectTimeline>;
  fetchViewer(signal?: AbortSignal): Promise<TimelineViewer>;
}

function isTimelineEntryKind(value: unknown): value is TimelineEntryKind {
  return (
    typeof value === 'string' &&
    (KIND_ORDER as string[]).includes(value)
  );
}

function isTimelineEntryStatus(value: unknown): value is TimelineEntryStatus {
  return (
    typeof value === 'string' &&
    ['planned', 'active', 'completed', 'blocked', 'cancelled'].includes(value)
  );
}

function parseTimelineEntry(raw: unknown): TimelineEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== 'string' || !record.id) return null;
  if (!isTimelineEntryKind(record.kind)) return null;
  if (typeof record.title !== 'string' || !record.title) return null;
  if (!isTimelineEntryStatus(record.status)) return null;
  if (typeof record.occurredAt !== 'string' || !record.occurredAt) return null;

  return {
    id: record.id,
    kind: record.kind,
    title: record.title,
    status: record.status,
    occurredAt: record.occurredAt,
    summary: typeof record.summary === 'string' ? record.summary : undefined,
    updatedAt:
      typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
    actorRole:
      typeof record.actorRole === 'string' ? record.actorRole : undefined,
    href: typeof record.href === 'string' ? record.href : undefined,
  };
}

function parseTimeline(raw: unknown): ProjectTimeline {
  if (!raw || typeof raw !== 'object') {
    throw new TimelineServiceError(
      'The timeline response was malformed.',
      'unknown',
      true,
    );
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.projectId !== 'string' || !record.projectId) {
    throw new TimelineServiceError(
      'The timeline response was missing a project id.',
      'unknown',
      true,
    );
  }
  const entriesRaw = Array.isArray(record.entries) ? record.entries : [];
  const entries = entriesRaw
    .map(parseTimelineEntry)
    .filter((entry): entry is TimelineEntry => entry !== null);

  return {
    projectId: record.projectId,
    projectName:
      typeof record.projectName === 'string' && record.projectName
        ? record.projectName
        : 'Project',
    generatedAt:
      typeof record.generatedAt === 'string'
        ? record.generatedAt
        : new Date().toISOString(),
    entries,
  };
}

function parseViewer(raw: unknown): TimelineViewer {
  if (!raw || typeof raw !== 'object') {
    throw new TimelineServiceError(
      'The viewer response was malformed.',
      'unknown',
      true,
    );
  }
  const record = raw as Record<string, unknown>;
  return {
    userId: typeof record.userId === 'string' ? record.userId : '',
    roles: Array.isArray(record.roles)
      ? record.roles.filter((role): role is string => typeof role === 'string')
      : [],
    capabilities: Array.isArray(record.capabilities)
      ? record.capabilities.filter(
          (cap): cap is string => typeof cap === 'string',
        )
      : [],
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function createTimelineService(
  baseUrl = '/api/v2',
  fetchImpl: typeof fetch = fetch,
): TimelineService {
  return {
    async fetchTimeline(projectId, signal) {
      let response: Response;
      try {
        response = await fetchImpl(
          `${baseUrl}/projects/${encodeURIComponent(projectId)}/timeline`,
          {
            method: 'GET',
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
            signal,
          },
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error;
        }
        throw new TimelineServiceError(
          'We could not reach the timeline service. Check your connection and try again.',
          'network',
          true,
        );
      }

      if (response.status === 401 || response.status === 403) {
        throw new TimelineServiceError(
          'You do not have permission to view this project timeline.',
          'forbidden',
          false,
        );
      }

      if (response.status === 409) {
        const body = (await readJson(response)) as
          | { message?: string; staleSince?: string }
          | null;
        throw new TimelineServiceError(
          body?.message ??
            'This timeline changed while you were viewing it. Refresh to load the latest state.',
          'conflict',
          true,
          body?.staleSince,
        );
      }

      if (!response.ok) {
        throw new TimelineServiceError(
          'The timeline could not be loaded right now. Please try again.',
          'unknown',
          response.status >= 500,
        );
      }

      return parseTimeline(await readJson(response));
    },

    async fetchViewer(signal) {
      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/me`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
          signal,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error;
        }
        throw new TimelineServiceError(
          'We could not verify your access. Check your connection and try again.',
          'network',
          true,
        );
      }

      if (response.status === 401 || response.status === 403) {
        throw new TimelineServiceError(
          'You do not have permission to view this project timeline.',
          'forbidden',
          false,
        );
      }

      if (!response.ok) {
        throw new TimelineServiceError(
          'We could not verify your access right now. Please try again.',
          'unknown',
          response.status >= 500,
        );
      }

      return parseViewer(await readJson(response));
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function hasCapability(
  viewer: TimelineViewer | null,
  capability: TimelineCapability,
): boolean {
  if (!viewer) return false;
  return viewer.capabilities.includes(capability);
}

function compareEntries(a: TimelineEntry, b: TimelineEntry): number {
  const aTime = Date.parse(a.occurredAt);
  const bTime = Date.parse(b.occurredAt);
  const aValid = Number.isFinite(aTime);
  const bValid = Number.isFinite(bTime);

  if (aValid && bValid && aTime !== bTime) {
    return bTime - aTime; // newest first
  }
  if (aValid !== bValid) {
    return aValid ? -1 : 1;
  }
  // Stable tie-breaker so ordering never depends on array position.
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

function groupEntries(
  entries: TimelineEntry[],
): Array<{ kind: TimelineEntryKind; entries: TimelineEntry[] }> {
  const buckets = new Map<TimelineEntryKind, TimelineEntry[]>();
  for (const entry of entries) {
    const bucket = buckets.get(entry.kind);
    if (bucket) {
      bucket.push(entry);
    } else {
      buckets.set(entry.kind, [entry]);
    }
  }

  return KIND_ORDER.filter((kind) => buckets.has(kind)).map((kind) => ({
    kind,
    entries: [...(buckets.get(kind) ?? [])].sort(compareEntries),
  }));
}

function formatDate(value: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return value;
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(time));
  } catch {
    return value;
  }
}

/* -------------------------------------------------------------------------- */
/* State boundary                                                             */
/* -------------------------------------------------------------------------- */

interface ProjectStateBoundaryProps {
  state: TimelineLoadState;
  onRetry: () => void;
  onRefresh: () => void;
  children: (timeline: ProjectTimeline) => React.ReactNode;
}

function ProjectStateBoundary({
  state,
  onRetry,
  onRefresh,
  children,
}: ProjectStateBoundaryProps): React.ReactElement {
  if (state.status === 'loading') {
    return (
      <div
        className="timeline-state timeline-state--loading"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="timeline-spinner" aria-hidden="true" />
        <p>Loading project timeline…</p>
      </div>
    );
  }

  if (state.status === 'forbidden') {
    return (
      <div
        className="timeline-state timeline-state--forbidden"
        role="alert"
        aria-live="assertive"
      >
        <h2>Access denied</h2>
        <p>{state.message}</p>
        <p>
          If you believe you should have access, contact your project
          administrator.
        </p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div
        className="timeline-state timeline-state--error"
        role="alert"
        aria-live="assertive"
      >
        <h2>Timeline unavailable</h2>
        <p>{state.message}</p>
        {state.retryable ? (
          <button
            type="button"
            className="timeline-action timeline-action--primary"
            onClick={onRetry}
          >
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  if (state.status === 'conflict') {
    return (
      <div
        className="timeline-state timeline-state--conflict"
        role="alert"
        aria-live="assertive"
      >
        <h2>This timeline is out of date</h2>
        <p>{state.message}</p>
        {state.staleSince ? (
          <p className="timeline-state__meta">
            Changes were detected since {formatDate(state.staleSince)}.
          </p>
        ) : null}
        <div className="timeline-state__actions">
          <button
            type="button"
            className="timeline-action timeline-action--primary"
            onClick={onRefresh}
          >
            Refresh timeline
          </button>
          {state.retryable ? (
            <button
              type="button"
              className="timeline-action"
              onClick={onRetry}
            >
              Retry
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (state.status === 'empty') {
    return (
      <div
        className="timeline-state timeline-state--empty"
        role="status"
        aria-live="polite"
      >
        <h2>No timeline activity yet</h2>
        <p>
          Objectives, tasks, milestones, decisions, reviews, funding, and
          charter changes will appear here as the project progresses.
        </p>
      </div>
    );
  }

  return (
    <div className="timeline-state timeline-state--success" role="region">
      {children(state.timeline)}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Entry rendering                                                            */
/* -------------------------------------------------------------------------- */

interface TimelineEntryItemProps {
  entry: TimelineEntry;
  onOpen: (entry: TimelineEntry) => void;
}

function TimelineEntryItem({
  entry,
  onOpen,
}: TimelineEntryItemProps): React.ReactElement {
  const content = (
    <>
      <div className="timeline-entry__header">
        <span className="timeline-entry__title">{entry.title}</span>
        <span
          className={`timeline-entry__status timeline-entry__status--${entry.status}`}
        >
          {STATUS_LABELS[entry.status]}
        </span>
      </div>
      {entry.summary ? (
        <p className="timeline-entry__summary">{entry.summary}</p>
      ) : null}
      <div className="timeline-entry__meta">
        <time dateTime={entry.occurredAt}>{formatDate(entry.occurredAt)}</time>
        {entry.actorRole ? (
          <span className="timeline-entry__role">{entry.actorRole}</span>
        ) : null}
      </div>
    </>
  );

  if (entry.href) {
    return (
      <li className="timeline-entry">
        <Link
          href={entry.href}
          className="timeline-entry__link"
          onClick={() => onOpen(entry)}
        >
          {content}
        </Link>
      </li>
    );
  }

  return (
    <li className="timeline-entry">
      <button
        type="button"
        className="timeline-entry__link timeline-entry__link--button"
        onClick={() => onOpen(entry)}
      >
        {content}
      </button>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function ProjectTimelinePage(): React.ReactElement {
  const params = useParams<{ projectId?: string | string[] }>();
  const projectId = useMemo(() => {
    const raw = params?.projectId;
    if (Array.isArray(raw)) return raw[0] ?? '';
    return raw ?? '';
  }, [params]);

  const service = useMemo(() => createTimelineService(), []);
  const [state, setState] = useState<TimelineLoadState>({ status: 'loading' });
  const [viewer, setViewer] = useState<TimelineViewer | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const viewedRef = useRef(false);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setState({ status: 'loading' });

      if (!projectId) {
        setState({
          status: 'error',
          message: 'No project was specified. Return to your projects and try again.',
          retryable: false,
        });
        return;
      }

      try {
        const currentViewer = await service.fetchViewer(signal);
        if (signal.aborted) return;
        setViewer(currentViewer);

        // Deny-by-default: missing capability means no timeline access.
        if (!hasCapability(currentViewer, REQUIRED_CAPABILITY)) {
          setState({
            status: 'forbidden',
            message:
              'You do not have permission to view this project timeline.',
          });
          return;
        }

        const timeline = await service.fetchTimeline(projectId, signal);
        if (signal.aborted) return;

        if (timeline.entries.length === 0) {
          setState({ status: 'empty', timeline });
        } else {
          setState({ status: 'success', timeline });
        }
      } catch (error) {
        if (signal.aborted) return;
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        if (error instanceof TimelineServiceError) {
          if (error.kind === 'forbidden') {
            setState({ status: 'forbidden', message: error.message });
            return;
          }
          if (error.kind === 'conflict') {
            setState({
              status: 'conflict',
              message: error.message,
              staleSince: error.staleSince,
              retryable: error.retryable,
            });
            return;
          }
          setState({
            status: 'error',
            message: error.message,
            retryable: error.retryable,
          });
          return;
        }
        setState({
          status: 'error',
          message: 'Something went wrong while loading the timeline.',
          retryable: true,
        });
      }
    },
    [projectId, service],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, reloadToken]);

  // Emit a single privacy-safe view event per successful load.
  useEffect(() => {
    if (state.status !== 'success' && state.status !== 'empty') return;
    if (viewedRef.current) return;
    viewedRef.current = true;
    emitAnalytics('timeline_viewed', { projectId });
  }, [state.status, projectId]);

  const handleRetry = useCallback(() => {
    emitAnalytics('timeline_retry', { projectId });
    setReloadToken((token) => token + 1);
  }, [projectId]);

  const handleRefresh = useCallback(() => {
    emitAnalytics('timeline_conflict_refresh', { projectId });
    setReloadToken((token) => token + 1);
  }, [projectId]);

  const handleOpenEntry = useCallback(
    (entry: TimelineEntry) => {
      emitAnalytics('timeline_entry_opened', {
        projectId,
        entryKind: entry.kind,
      });
    },
    [projectId],
  );

  const groups = useMemo(() => {
    if (state.status !== 'success') return [];
    return groupEntries(state.timeline.entries);
  }, [state]);

  const canManage = hasCapability(viewer, 'project.timeline.manage');

  return (
    <main className="timeline-page" aria-labelledby="timeline-heading">
      <header className="timeline-page__header">
        <nav aria-label="Breadcrumb" className="timeline-breadcrumb">
          <ol>
            <li>
              <Link href="/projects">Projects</Link>
            </li>
            <li>
              <Link href={`/projects/${encodeURIComponent(projectId)}`}>
                Project
              </Link>
            </li>
            <li aria-current="page">Timeline</li>
          </ol>
        </nav>

        <div className="timeline-page__title-row">
          <div>
            <h1 id="timeline-heading">Project timeline &amp; roadmap</h1>
            <p className="timeline-page__subtitle">
              Objectives, tasks, milestones, decisions, reviews, funding, and
              charter changes in one stable view.
            </p>
          </div>
          {canManage ? (
            <Link
              className="timeline-action timeline-action--primary"
              href={`/projects/${encodeURIComponent(projectId)}/timeline/manage`}
            >
              Manage timeline
            </Link>
          ) : null}
        </div>
      </header>

      <ProjectStateBoundary
        state={state}
        onRetry={handleRetry}
        onRefresh={handleRefresh}
      >
        {(timeline) => (
          <div className="timeline-groups">
            <p className="timeline-page__meta" aria-live="polite">
              {timeline.entries.length}{' '}
              {timeline.entries.length === 1 ? 'entry' : 'entries'} · last
              updated {formatDate(timeline.generatedAt)}
            </p>
            {groups.map((group) => {
              const headingId = `timeline-group-${group.kind}`;
              return (
                <section
                  key={group.kind}
                  className="timeline-group"
                  aria-labelledby={headingId}
                >
                  <h2 id={headingId} className="timeline-group__heading">
                    {KIND_LABELS[group.kind]}
                    <span className="timeline-group__count">
                      {group.entries.length}
                    </span>
                  </h2>
                  <p className="timeline-group__description">
                    {KIND_DESCRIPTIONS[group.kind]}
                  </p>
                  <ol className="timeline-group__list">
                    {group.entries.map((entry) => (
                      <TimelineEntryItem
                        key={entry.id}
                        entry={entry}
                        onOpen={handleOpenEntry}
                      />
                    ))}
                  </ol>
                </section>
              );
            })}
          </div>
        )}
      </ProjectStateBoundary>

      <style jsx>{`
        .timeline-page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding: 1.5rem;
          max-width: 72rem;
          margin: 0 auto;
          color: var(--color-text, #1f2933);
        }
        .timeline-breadcrumb ol {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          list-style: none;
          margin: 0;
          padding: 0;
          font-size: 0.875rem;
        }
        .timeline-breadcrumb li + li::before {
          content: '/';
          margin-right: 0.5rem;
          color: var(--color-muted, #616e7c);
        }
        .timeline-breadcrumb a {
          color: var(--color-link, #2563eb);
          text-decoration: underline;
        }
        .timeline-page__title-row {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          align-items: flex-start;
          justify-content: space-between;
          margin-top: 0.75rem;
        }
        .timeline-page__subtitle {
          margin: 0.25rem 0 0;
          color: var(--color-muted, #616e7c);
        }
        .timeline-page__meta {
          font-size: 0.875rem;
          color: var(--color-muted, #616e7c);
          margin: 0;
        }
        .timeline-groups {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .timeline-group {
          border: 1px solid var(--color-border, #d9e2ec);
          border-radius: 0.75rem;
          padding: 1rem;
          background: var(--color-surface, #ffffff);
        }
        .timeline-group__heading {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0;
          font-size: 1.125rem;
        }
        .timeline-group__count {
          font-size: 0.75rem;
          font-weight: 600;
          background: var(--color-chip, #e4e7eb);
          border-radius: 999px;
          padding: 0.125rem 0.5rem;
        }
        .timeline-group__description {
          margin: 0.25rem 0 0.75rem;
          font-size: 0.875rem;
          color: var(--color-muted, #616e7c);
        }
        .timeline-group__list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .timeline-entry__link {
          display: block;
          width: 100%;
          text-align: left;
          border: 1px solid var(--color-border, #d9e2ec);
          border-radius: 0.5rem;
          padding: 0.75rem;
          background: var(--color-surface, #ffffff);
          color: inherit;
          text-decoration: none;
          font: inherit;
          cursor: pointer;
        }
        .timeline-entry__link:hover {
          border-color: var(--color-link, #2563eb);
        }
        .timeline-entry__link:focus-visible {
          outline: 2px solid var(--color-focus, #2563eb);
          outline-offset: 2px;
        }
        .timeline-entry__header {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
          justify-content: space-between;
        }
        .timeline-entry__title {
          font-weight: 600;
        }
        .timeline-entry__status {
          font-size: 0.75rem;
          border-radius: 999px;
          padding: 0.125rem 0.5rem;
          background: var(--color-chip, #e4e7eb);
        }
        .timeline-entry__status--completed {
          background: #d1fae5;
          color: #065f46;
        }
        .timeline-entry__status--blocked {
          background: #fee2e2;
          color: #991b1b;
        }
        .timeline-entry__status--active {
          background: #dbeafe;
          color: #1e40af;
        }
        .timeline-entry__summary {
          margin: 0.375rem 0 0;
          font-size: 0.875rem;
        }
        .timeline-entry__meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: 0.375rem;
          font-size: 0.75rem;
          color: var(--color-muted, #616e7c);
        }
        .timeline-state {
          border: 1px solid var(--color-border, #d9e2ec);
          border-radius: 0.75rem;
          padding: 1.5rem;
          background: var(--color-surface, #ffffff);
        }
        .timeline-state--error,
        .timeline-state--conflict,
        .timeline-state--forbidden {
          border-color: #fca5a5;
          background: #fef2f2;
        }
        .timeline-state__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }
        .timeline-state__meta {
          font-size: 0.875rem;
          color: var(--color-muted, #616e7c);
        }
        .timeline-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--color-border, #d9e2ec);
          border-radius: 0.5rem;
          padding: 0.5rem 0.875rem;
          background: var(--color-surface, #ffffff);
          color: inherit;
          font: inherit;
          text-decoration: none;
          cursor: pointer;
        }
        .timeline-action--primary {
          background: var(--color-link, #2563eb);
          border-color: var(--color-link, #2563eb);
          color: #ffffff;
        }
        .timeline-action:focus-visible {
          outline: 2px solid var(--color-focus, #2563eb);
          outline-offset: 2px;
        }
        .timeline-spinner {
          display: inline-block;
          width: 1rem;
          height: 1rem;
          border: 2px solid var(--color-border, #d9e2ec);
          border-top-color: var(--color-link, #2563eb);
          border-radius: 50%;
          animation: timeline-spin 0.8s linear infinite;
        }
        @keyframes timeline-spin {
          to {
            transform: rotate(360deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .timeline-spinner {
            animation: none;
          }
        }
        @media (max-width: 640px) {
          .timeline-page {
            padding: 1rem;
          }
          .timeline-page__title-row {
            flex-direction: column;
          }
          .timeline-action {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}