/**
 * Scholarship funnel metrics (issue #1158).
 *
 * Measures program views, application starts, submissions, review duration,
 * decisions, acceptance, milestones, and payment completion. Funnel definitions
 * are versioned, events carry an opaque dedupe key so retries never double
 * count, the snapshot exposes its data freshness (`dataThrough`), and private
 * fields are rejected before an event is accepted.
 */

import { apiClient } from '@/src/lib/api-client';

export const FUNNEL_DEFINITIONS_VERSION = '2026-09-01';

export type FunnelStage =
  | 'program_view'
  | 'application_start'
  | 'application_submit'
  | 'review_complete'
  | 'decision'
  | 'acceptance'
  | 'milestone'
  | 'payment_complete';

export const FUNNEL_STAGES: FunnelStage[] = [
  'program_view',
  'application_start',
  'application_submit',
  'review_complete',
  'decision',
  'acceptance',
  'milestone',
  'payment_complete',
];

export type FunnelEvent = {
  id: string;
  stage: FunnelStage;
  programId: string;
  occurredAt: string;
  /** Opaque actor key — never a user id, email, or name. */
  actorKey: string;
  /** Same fact => same key, so retries are counted once. */
  dedupeKey: string;
};

export type FunnelWindow = { from: string; to: string };

export type FunnelSnapshot = {
  definitionsVersion: string;
  from: string;
  to: string;
  dataThrough: string;
  counts: Record<FunnelStage, number>;
  /** Stage-to-stage conversion, keyed by the later stage. */
  conversionRates: Partial<Record<FunnelStage, number>>;
};

const PRIVATE_FIELD_PATTERN = /email|phone|fullname|name|address|notes|token|secret|password/i;

/** Returns the payload keys that must not be sent with an analytics event. */
export function assertNoPrivateFields(payload: Record<string, unknown>): string[] {
  return Object.keys(payload).filter((key) => PRIVATE_FIELD_PATTERN.test(key));
}

export function dedupeFunnelEvents(events: FunnelEvent[]): FunnelEvent[] {
  const seen = new Set<string>();
  const unique: FunnelEvent[] = [];
  for (const event of events) {
    if (seen.has(event.dedupeKey)) continue;
    seen.add(event.dedupeKey);
    unique.push(event);
  }
  return unique;
}

function emptyCounts(): Record<FunnelStage, number> {
  return FUNNEL_STAGES.reduce((counts, stage) => {
    counts[stage] = 0;
    return counts;
  }, {} as Record<FunnelStage, number>);
}

export function computeFunnel(
  events: FunnelEvent[],
  window: FunnelWindow,
  now: Date = new Date()
): FunnelSnapshot {
  const from = Date.parse(window.from);
  const to = Date.parse(window.to);

  const inWindow = dedupeFunnelEvents(events).filter((event) => {
    const occurredAt = Date.parse(event.occurredAt);
    return !Number.isNaN(occurredAt) && occurredAt >= from && occurredAt <= to;
  });

  const counts = emptyCounts();
  for (const event of inWindow) {
    counts[event.stage] += 1;
  }

  const conversionRates: Partial<Record<FunnelStage, number>> = {};
  for (let index = 1; index < FUNNEL_STAGES.length; index += 1) {
    const previousStage = FUNNEL_STAGES[index - 1];
    const stage = FUNNEL_STAGES[index];
    const previousCount = counts[previousStage];
    conversionRates[stage] = previousCount === 0 ? 0 : Number((counts[stage] / previousCount).toFixed(4));
  }

  const newest = inWindow
    .map((event) => Date.parse(event.occurredAt))
    .reduce<number | null>((latest, value) => (latest === null || value > latest ? value : latest), null);

  return {
    definitionsVersion: FUNNEL_DEFINITIONS_VERSION,
    from: window.from,
    to: window.to,
    dataThrough: new Date(newest ?? now.getTime()).toISOString(),
    counts,
    conversionRates,
  };
}

export const scholarshipAnalyticsService = {
  track: (event: FunnelEvent): Promise<{ accepted: boolean }> =>
    apiClient.post<{ accepted: boolean }>('/scholarships/analytics/events', event),

  funnel: (window: FunnelWindow): Promise<FunnelSnapshot> => {
    const query = new URLSearchParams({ from: window.from, to: window.to });
    return apiClient.get<FunnelSnapshot>(`/scholarships/analytics/funnel?${query.toString()}`);
  },
};
