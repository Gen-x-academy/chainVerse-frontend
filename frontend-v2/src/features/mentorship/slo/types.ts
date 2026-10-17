/**
 * Mentorship service-level objectives (issue #1364).
 *
 * Define and instrument latency, availability, job delay, notification success,
 * calendar sync, search freshness, settlement, and error-budget indicators.
 * Metrics exclude high-cardinality personal fields.
 */

export type MentorshipSliKey =
  | 'latency.p95'
  | 'availability'
  | 'job.delay.p95'
  | 'notification.success'
  | 'calendar.sync.success'
  | 'search.freshness'
  | 'settlement.latency.p95'
  | 'error.rate';

export type MentorshipSloDefinition = {
  id: MentorshipSliKey;
  name: string;
  target: number;
  unit: 'ms' | 'percent' | 'minutes' | 'count';
  comparison: 'max' | 'min';
  owner: string;
  alertThreshold: number;
};

export const MENTORSHIP_SLOS: MentorshipSloDefinition[] = [
  {
    id: 'latency.p95',
    name: 'Mentorship API latency p95',
    target: 400,
    unit: 'ms',
    comparison: 'max',
    owner: 'platform-eng',
    alertThreshold: 0.8,
  },
  {
    id: 'availability',
    name: 'Mentorship API availability',
    target: 99.9,
    unit: 'percent',
    comparison: 'min',
    owner: 'platform-eng',
    alertThreshold: 0.9,
  },
  {
    id: 'job.delay.p95',
    name: 'Background job delay p95',
    target: 10,
    unit: 'minutes',
    comparison: 'max',
    owner: 'data-eng',
    alertThreshold: 0.8,
  },
  {
    id: 'notification.success',
    name: 'Notification success rate',
    target: 99.5,
    unit: 'percent',
    comparison: 'min',
    owner: 'messaging-eng',
    alertThreshold: 0.9,
  },
  {
    id: 'calendar.sync.success',
    name: 'Calendar sync success rate',
    target: 99.0,
    unit: 'percent',
    comparison: 'min',
    owner: 'integrations-eng',
    alertThreshold: 0.8,
  },
  {
    id: 'search.freshness',
    name: 'Search index freshness (max lag)',
    target: 5,
    unit: 'minutes',
    comparison: 'max',
    owner: 'search-eng',
    alertThreshold: 0.8,
  },
  {
    id: 'settlement.latency.p95',
    name: 'Settlement latency p95',
    target: 30,
    unit: 'minutes',
    comparison: 'max',
    owner: 'finance-eng',
    alertThreshold: 0.8,
  },
  {
    id: 'error.rate',
    name: 'Error rate',
    target: 1.0,
    unit: 'percent',
    comparison: 'max',
    owner: 'platform-eng',
    alertThreshold: 0.9,
  },
];

export type MentorshipSloSample = {
  sloId: MentorshipSliKey;
  value: number;
  observedAt: string;
  correlationId?: string;
};

export type MentorshipSloEvaluation = {
  sloId: MentorshipSliKey;
  name: string;
  target: number;
  unit: 'ms' | 'percent' | 'minutes' | 'count';
  current: number | null;
  status: 'ok' | 'breach' | 'no-data';
  burnRate: number | null;
  owner: string;
};
