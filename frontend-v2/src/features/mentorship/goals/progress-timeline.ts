/** MENTOR-075: ordered, permission-filtered progress timeline for a mentorship engagement. */
export type TimelineEventKind =
  | 'goal'
  | 'session'
  | 'milestone'
  | 'deliverable'
  | 'decision'
  | 'agreement-change';

/** Who is allowed to see an event. Anything unknown is treated as private. */
export type TimelineVisibility = 'participants' | 'mentor-only' | 'mentee-only' | 'private';

export interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  /** ISO timestamp of the event. */
  at: string;
  /** Monotonic sequence number; keeps ordering stable when timestamps collide. */
  sequence: number;
  visibility: TimelineVisibility;
  /** Route to the authorized detail view for this event. */
  detailHref: string;
  title: string;
}

export type TimelineViewerRole = 'mentor' | 'mentee' | 'coordinator' | 'observer';

export interface TimelineViewer {
  role: TimelineViewerRole;
}

export interface TimelinePage {
  entries: TimelineEvent[];
  /** Id of the last entry on this page; pass as `afterId` to fetch the next page. */
  nextCursor?: string;
}

export const TIMELINE_DEFAULT_LIMIT = 20;
export const TIMELINE_MAX_LIMIT = 100;

/**
 * Deny-by-default: an event is visible only when its visibility grants the viewer's role.
 * Private events are omitted entirely rather than redacted, so they never leak a title or link.
 */
export function canViewEvent(event: TimelineEvent, viewer: TimelineViewer): boolean {
  switch (event.visibility) {
    case 'participants':
      return viewer.role === 'mentor' || viewer.role === 'mentee' || viewer.role === 'coordinator';
    case 'mentor-only':
      return viewer.role === 'mentor' || viewer.role === 'coordinator';
    case 'mentee-only':
      return viewer.role === 'mentee' || viewer.role === 'coordinator';
    case 'private':
    default:
      return false;
  }
}

const byStableOrder = (a: TimelineEvent, b: TimelineEvent): number => {
  const time = Date.parse(a.at) - Date.parse(b.at);
  return time !== 0 ? time : a.sequence - b.sequence;
};

/** Filters to the events a viewer may see and returns them in stable chronological order. */
export function buildTimeline(events: TimelineEvent[], viewer: TimelineViewer): TimelineEvent[] {
  return events.filter((event) => canViewEvent(event, viewer)).sort(byStableOrder);
}

/**
 * Cursor-based pagination over an already-ordered timeline. The cursor is the id of the last
 * entry on the previous page, so pages never overlap and never leave gaps even if new events
 * are inserted between requests.
 */
export function paginateTimeline(
  ordered: TimelineEvent[],
  afterId?: string,
  limit: number = TIMELINE_DEFAULT_LIMIT,
): TimelinePage {
  if (!Number.isInteger(limit) || limit < 1 || limit > TIMELINE_MAX_LIMIT) {
    throw new Error(`Page size must be between 1 and ${TIMELINE_MAX_LIMIT}`);
  }
  let start = 0;
  if (afterId !== undefined) {
    const index = ordered.findIndex((event) => event.id === afterId);
    if (index === -1) throw new Error('Unknown pagination cursor');
    start = index + 1;
  }
  const entries = ordered.slice(start, start + limit);
  const last = entries[entries.length - 1];
  const hasMore = start + limit < ordered.length;
  return { entries, nextCursor: hasMore && last ? last.id : undefined };
}
