/**
 * Coordinator operations dashboard domain (closes #1363, MENTOR-116).
 *
 * The dashboard aggregates the queues a mentorship coordinator works through
 * every day: mentor capacity, review queues, unmatched participants, expiring
 * proposals, schedule risks, overdue milestones, and open disputes. Every
 * aggregate is tenant-scoped and links back to the matching records.
 *
 * Authorization is deny-by-default via `canPerformMentorshipAction`; the
 * frontend guard is a UX boundary only and the API must enforce the same
 * grants (see `docs/mentorship/MENTOR-003-role-permission-matrix.md`).
 */

export type DashboardCardId =
  | 'capacity'
  | 'review-queue'
  | 'unmatched'
  | 'expiring-proposals'
  | 'schedule-risks'
  | 'overdue-milestones'
  | 'disputes';

export type DashboardFilterStatus = 'all' | 'attention' | 'ok';

export interface DashboardFilters {
  status: DashboardFilterStatus;
  programId?: string;
}

export const DEFAULT_DASHBOARD_FILTERS: DashboardFilters = { status: 'all' };

/** Data older than this must be labeled stale in the UI. */
export const STALE_AFTER_MS = 5 * 60 * 1000;

export interface DashboardRecordLink {
  label: string;
  href: string;
}

export interface DashboardCardData {
  id: DashboardCardId;
  title: string;
  /** Headline count for the card. */
  count: number;
  status: DashboardFilterStatus;
  /** Deep link into the matching records; empty when there are none. */
  links: DashboardRecordLink[];
  /** Permission required to act on this card. */
  resource: 'program' | 'engagement' | 'session' | 'deliverable' | 'dispute' | 'mentor-profile';
  action: 'read' | 'update' | 'approve';
  description: string;
}

export interface DashboardSnapshot {
  tenantId: string;
  generatedAt: string;
  cards: DashboardCardData[];
}

export type DashboardLoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; snapshot: DashboardSnapshot; stale: boolean };

export function isSnapshotStale(snapshot: DashboardSnapshot, now: Date = new Date()): boolean {
  const generated = Date.parse(snapshot.generatedAt);
  if (Number.isNaN(generated)) return true;
  return now.getTime() - generated > STALE_AFTER_MS;
}

/** Cards that survive the status filter. */
export function filterCards(
  cards: readonly DashboardCardData[],
  filters: DashboardFilters,
): DashboardCardData[] {
  if (filters.status === 'all') return [...cards];
  return cards.filter((card) => card.status === filters.status);
}

/** Filter status is persisted so a coordinator keeps their view across loads. */
export function serializeFilters(filters: DashboardFilters): string {
  return JSON.stringify({ status: filters.status, programId: filters.programId ?? null });
}

export function parseFilters(raw: string | null): DashboardFilters {
  if (!raw) return DEFAULT_DASHBOARD_FILTERS;
  try {
    const parsed = JSON.parse(raw) as { status?: string; programId?: string | null };
    const status: DashboardFilterStatus =
      parsed.status === 'attention' || parsed.status === 'ok' ? parsed.status : 'all';
    return { status, programId: parsed.programId ?? undefined };
  } catch {
    return DEFAULT_DASHBOARD_FILTERS;
  }
}

/** A card is actionable only when the principal's role grants the action. */
export function canActOnCard(
  card: DashboardCardData,
  decision: { allowed: boolean },
): boolean {
  return decision.allowed && card.count > 0;
}
