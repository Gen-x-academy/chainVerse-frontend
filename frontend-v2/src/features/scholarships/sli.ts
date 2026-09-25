/**
 * Operational service-level indicators (issue #1160).
 *
 * Measures latency, errors, queue age, notification lag, payment finalization,
 * and reconciliation drift. Every indicator has an explicit target and
 * comparison direction, dashboards and alerts consume the same definitions, and
 * correlation ids are sanitized so a failure can be traced across services
 * without leaking a secret.
 */

import { apiClient } from '@/src/lib/api-client';

export type SliUnit = 'ms' | 'percent' | 'minutes' | 'count';

export type SliDefinition = {
  id: string;
  name: string;
  description: string;
  target: number;
  unit: SliUnit;
  /** `max` breaches above the target, `min` breaches below it. */
  comparison: 'max' | 'min';
};

export const SCHOLARSHIP_SLIS: SliDefinition[] = [
  {
    id: 'api.latency.p95',
    name: 'Scholarship API latency (p95)',
    description: '95th percentile response time for scholarship endpoints.',
    target: 500,
    unit: 'ms',
    comparison: 'max',
  },
  {
    id: 'api.error.rate',
    name: 'Scholarship API error rate',
    description: 'Share of scholarship requests returning 5xx.',
    target: 1,
    unit: 'percent',
    comparison: 'max',
  },
  {
    id: 'queue.age.p95',
    name: 'Review queue age (p95)',
    description: 'Time an application waits before a reviewer picks it up.',
    target: 10,
    unit: 'minutes',
    comparison: 'max',
  },
  {
    id: 'notification.lag.p95',
    name: 'Notification lag (p95)',
    description: 'Delay between a domain event and its notification.',
    target: 15,
    unit: 'minutes',
    comparison: 'max',
  },
  {
    id: 'payment.finalization.p95',
    name: 'Payment finalization (p95)',
    description: 'Time from payout intent to a final ledger transaction.',
    target: 5,
    unit: 'minutes',
    comparison: 'max',
  },
  {
    id: 'reconciliation.drift',
    name: 'Settlement reconciliation drift',
    description: 'Number of unreconciled payment intents.',
    target: 0,
    unit: 'count',
    comparison: 'max',
  },
];

export type ObservabilitySample = {
  sliId: string;
  value: number;
  observedAt: string;
  correlationId?: string;
};

export type SliEvaluation = {
  sliId: string;
  name: string;
  target: number;
  unit: SliUnit;
  current: number | null;
  status: 'ok' | 'breach' | 'no-data';
  /** current / target, capped at a readable precision. */
  burnRate: number | null;
};

const SECRET_PATTERN = /(token|secret|password|api[_-]?key|key)=/i;

/** Correlation ids are traceable but must never carry credentials. */
export function sanitizeCorrelationId(correlationId: string): string {
  const trimmed = correlationId.trim();
  if (!trimmed) return 'unknown';
  if (SECRET_PATTERN.test(trimmed)) return 'redacted';
  return trimmed.replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 64);
}

export function evaluateSli(definition: SliDefinition, samples: ObservabilitySample[]): SliEvaluation {
  const matching = samples.filter((sample) => sample.sliId === definition.id);

  if (matching.length === 0) {
    return {
      sliId: definition.id,
      name: definition.name,
      target: definition.target,
      unit: definition.unit,
      current: null,
      status: 'no-data',
      burnRate: null,
    };
  }

  const current = matching.reduce((worst, sample) => {
    if (definition.comparison === 'max') return Math.max(worst, sample.value);
    return Math.min(worst, sample.value);
  }, matching[0].value);

  const breached =
    definition.comparison === 'max' ? current > definition.target : current < definition.target;

  return {
    sliId: definition.id,
    name: definition.name,
    target: definition.target,
    unit: definition.unit,
    current,
    status: breached ? 'breach' : 'ok',
    burnRate: definition.target === 0 ? null : Number((current / definition.target).toFixed(2)),
  };
}

export function evaluateAllSlis(samples: ObservabilitySample[]): SliEvaluation[] {
  return SCHOLARSHIP_SLIS.map((definition) => evaluateSli(definition, samples));
}

export const scholarshipObservabilityService = {
  evaluate: (): Promise<SliEvaluation[]> =>
    apiClient.get<SliEvaluation[]>('/scholarships/observability/slis'),

  sample: (sample: ObservabilitySample): Promise<{ accepted: boolean }> =>
    apiClient.post<{ accepted: boolean }>('/scholarships/observability/samples', {
      ...sample,
      correlationId: sample.correlationId ? sanitizeCorrelationId(sample.correlationId) : undefined,
    }),
};
