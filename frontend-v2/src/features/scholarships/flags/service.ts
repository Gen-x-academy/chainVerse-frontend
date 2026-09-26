/**
 * Flag evaluation and rollout arithmetic (closes #1166).
 *
 * All cohort maths is deterministic — `cohortBucket` is a pure function of
 * `userId + cohortSeed` — so the same user always resolves to the same bucket
 * and the rollout can be unit-tested without a clock or a random source.
 */

import { apiClient } from '@/src/lib/api-client';
import type {
  FlagDefinition,
  FlagEvaluation,
  FlagEvaluationContext,
  FlagExposureRecord,
  RolloutCohort,
  RolloutEnvironment,
  ScholarshipFlagKey,
} from './types';

export const SCHOLARSHIP_FLAG_KEYS: ScholarshipFlagKey[] = [
  'discovery',
  'applications',
  'reviews',
  'awards',
  'payouts',
];

export const ROLLOUT_ENVIRONMENTS: RolloutEnvironment[] = [
  'development',
  'staging',
  'production',
];

const BUCKET_RESOLUTION = 10000;

/**
 * FNV-1a, 32 bit. Chosen because it is short, stable across engines, and has
 * no dependency on `Math.random` or the platform clock.
 */
export function cohortHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Deterministic position in `[0, 1)` for a cohort input string. */
export function cohortBucket(input: string): number {
  return (cohortHash(input) % BUCKET_RESOLUTION) / BUCKET_RESOLUTION;
}

function clampPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, percent));
}

/**
 * The share of users the cohort reaches, or `null` when membership is decided
 * by an allowlist rather than a percentage.
 */
export function rolloutPercentageOf(definition: FlagDefinition): number | null {
  return definition.cohort.kind === 'percentage'
    ? clampPercent(definition.cohort.percent)
    : null;
}

export function describeCohort(cohort: RolloutCohort): string {
  if (cohort.kind === 'percentage') {
    return `Percentage rollout — ${clampPercent(cohort.percent)}% of the cohort seed`;
  }
  if (cohort.kind === 'allowlist') {
    return `Allowlist — ${cohort.userIds.length} user id(s) on the list`;
  }
  return 'Everyone — no cohort restriction';
}

/**
 * Resolves one flag for one context.
 *
 * Precedence is fixed: the owner's global switch, then the environment toggle,
 * then the cohort. An allowlist is a cohort, not a hint, so a listed user is
 * always in and an unlisted user is always out; a percentage cohort falls back
 * to the owner default when no user id is available to hash.
 */
export function evaluateFlag(
  definition: FlagDefinition,
  context: FlagEvaluationContext,
  now: Date = new Date()
): FlagEvaluation {
  const evaluatedAt = now.toISOString();
  const base = { key: definition.key, evaluatedAt, source: 'remote' as const };

  if (!definition.defaultEnabled) {
    return {
      ...base,
      enabled: false,
      reason: 'Flag is globally switched off by its owner.',
    };
  }

  if (!definition.environments[context.environment]) {
    return {
      ...base,
      enabled: false,
      reason: `Flag is switched off for the ${context.environment} environment.`,
    };
  }

  if (definition.cohort.kind === 'all') {
    return {
      ...base,
      enabled: true,
      reason: 'Enabled for everyone in an enabled environment.',
    };
  }

  if (definition.cohort.kind === 'allowlist') {
    const userId = context.userId?.trim();
    if (!userId) {
      return {
        ...base,
        enabled: false,
        reason: 'Allowlist cohort requires a signed-in user id.',
      };
    }
    if (definition.cohort.userIds.includes(userId)) {
      return {
        ...base,
        enabled: true,
        reason: 'User is on the rollout allowlist.',
      };
    }
    return {
      ...base,
      enabled: false,
      reason: 'User is not on the rollout allowlist.',
    };
  }

  const percent = clampPercent(definition.cohort.percent);
  if (!context.userId) {
    return {
      ...base,
      enabled: definition.defaultEnabled,
      reason: `Anonymous user in a ${percent}% rollout: the owner default applies because there is no user id to hash.`,
    };
  }

  const bucket = cohortBucket(`${context.userId}:${context.cohortSeed}`);
  const inCohort = bucket * 100 < percent;
  return {
    ...base,
    enabled: inCohort,
    reason: inCohort
      ? `User bucket ${bucket.toFixed(4)} is inside the ${percent}% rollout.`
      : `User bucket ${bucket.toFixed(4)} is outside the ${percent}% rollout.`,
  };
}

export function isFlagEnabled(
  definition: FlagDefinition,
  context: FlagEvaluationContext,
  now: Date = new Date()
): boolean {
  return evaluateFlag(definition, context, now).enabled;
}

/**
 * The evaluation used when the remote flag service cannot be reached. It is
 * always disabled: an unreachable config must never quietly switch a surface
 * on.
 */
export function failClosedEvaluation(
  key: ScholarshipFlagKey,
  message: string,
  now: Date = new Date()
): FlagEvaluation {
  return {
    key,
    enabled: false,
    source: 'default',
    reason: `Remote flag configuration is unavailable (${message}). Failing closed: the surface stays disabled until the flag service responds.`,
    evaluatedAt: now.toISOString(),
  };
}

/**
 * True when the client is running on a client-side default rather than a
 * fetched definition, which is the only state in which the surface may differ
 * from the operator's intent.
 */
export function isSafeFallback(evaluation: FlagEvaluation): boolean {
  return evaluation.source === 'default' && !evaluation.enabled;
}

export function recordExposure(input: {
  key: ScholarshipFlagKey;
  userId: string;
  enabled: boolean;
  surface: string;
  now?: Date;
}): FlagExposureRecord {
  return {
    key: input.key,
    userId: input.userId,
    enabled: input.enabled,
    surface: input.surface,
    exposedAt: (input.now ?? new Date()).toISOString(),
  };
}

export function recordExposureFromEvaluation(
  evaluation: FlagEvaluation,
  userId: string,
  surface: string,
  now: Date = new Date()
): FlagExposureRecord {
  return recordExposure({
    key: evaluation.key,
    userId,
    enabled: evaluation.enabled,
    surface,
    now,
  });
}

const FLAGS_PATH = '/scholarships/flags';

export const scholarshipFlagService = {
  list: (): Promise<FlagDefinition[]> =>
    apiClient.get<FlagDefinition[]>(FLAGS_PATH),

  get: (key: ScholarshipFlagKey): Promise<FlagDefinition> =>
    apiClient.get<FlagDefinition>(`${FLAGS_PATH}/${encodeURIComponent(key)}`),

  upsert: (definition: FlagDefinition): Promise<FlagDefinition> =>
    apiClient.put<FlagDefinition>(
      `${FLAGS_PATH}/${encodeURIComponent(definition.key)}`,
      definition
    ),

  /**
   * Resolves every flag for one context. A failed fetch returns fail-closed
   * evaluations for `definitions` (or for every known key when no definitions
   * were supplied) instead of throwing, so a rollout can never fail open.
   */
  evaluateAll: async (
    context: FlagEvaluationContext,
    definitions: FlagDefinition[] = [],
    now: Date = new Date()
  ): Promise<FlagEvaluation[]> => {
    const query = new URLSearchParams({ environment: context.environment });
    if (context.userId) query.set('userId', context.userId);
    query.set('cohortSeed', context.cohortSeed);

    try {
      const remote = await apiClient.get<FlagEvaluation[]>(
        `${FLAGS_PATH}/evaluate?${query.toString()}`
      );
      if (Array.isArray(remote)) return remote;
      throw new Error('the flag service returned an unexpected payload');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      const keys = definitions.length
        ? definitions.map((definition) => definition.key)
        : SCHOLARSHIP_FLAG_KEYS;
      return keys.map((key) => failClosedEvaluation(key, message, now));
    }
  },

  exposures: (): Promise<FlagExposureRecord[]> =>
    apiClient.get<FlagExposureRecord[]>(`${FLAGS_PATH}/exposures`),
};
