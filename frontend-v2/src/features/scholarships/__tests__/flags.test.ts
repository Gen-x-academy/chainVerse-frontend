import { describe, expect, it } from 'vitest';
import {
  SCHOLARSHIP_FLAG_KEYS,
  cohortBucket,
  cohortHash,
  describeCohort,
  evaluateFlag,
  failClosedEvaluation,
  isFlagEnabled,
  isSafeFallback,
  recordExposure,
  recordExposureFromEvaluation,
  rolloutPercentageOf,
  scholarshipFlagService,
} from '../flags/service';
import type { FlagDefinition, FlagEvaluationContext } from '../flags/types';

const NOW = new Date('2025-03-01T00:00:00.000Z');

function definition(overrides: Partial<FlagDefinition> = {}): FlagDefinition {
  return {
    key: 'applications',
    description: 'Student application flow.',
    defaultEnabled: true,
    environments: { development: true, staging: true, production: true },
    cohort: { kind: 'all' },
    owner: 'platform-frontend',
    updatedAt: '2025-02-01T00:00:00.000Z',
    version: 3,
    ...overrides,
  };
}

function context(overrides: Partial<FlagEvaluationContext> = {}): FlagEvaluationContext {
  return { environment: 'production', userId: 'user-1', cohortSeed: 'seed-a', ...overrides };
}

describe('cohort hashing is deterministic', () => {
  it('returns the same hash for the same input', () => {
    expect(cohortHash('user-1:seed-a')).toBe(cohortHash('user-1:seed-a'));
    expect(cohortBucket('user-1:seed-a')).toBe(cohortBucket('user-1:seed-a'));
  });

  it('produces different buckets for different seeds', () => {
    const first = cohortBucket('user-1:seed-a');
    const second = cohortBucket('user-1:seed-b');
    expect(first).not.toBe(second);
  });

  it('produces different buckets for different users', () => {
    expect(cohortBucket('user-1:seed-a')).not.toBe(cohortBucket('user-2:seed-a'));
  });

  it('keeps every bucket inside [0, 1)', () => {
    for (let index = 0; index < 200; index += 1) {
      const bucket = cohortBucket(`user-${index}:seed-a`);
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(1);
    }
  });

  it('keeps a 0% rollout empty and a 100% rollout complete', () => {
    const none = definition({ cohort: { kind: 'percentage', percent: 0 } });
    const everyone = definition({ cohort: { kind: 'percentage', percent: 100 } });
    for (let index = 0; index < 50; index += 1) {
      expect(isFlagEnabled(none, context({ userId: `user-${index}` }), NOW)).toBe(false);
      expect(isFlagEnabled(everyone, context({ userId: `user-${index}` }), NOW)).toBe(true);
    }
  });
});

describe('evaluateFlag precedence', () => {
  it('lets an allowlisted user in regardless of the seed', () => {
    const allowlist = definition({
      cohort: { kind: 'allowlist', userIds: ['user-1', 'user-9'] },
    });
    const evaluation = evaluateFlag(allowlist, context({ userId: 'user-9' }), NOW);
    expect(evaluation.enabled).toBe(true);
    expect(evaluation.reason).toContain('allowlist');
  });

  it('keeps an unlisted user out of an allowlist cohort', () => {
    const allowlist = definition({ cohort: { kind: 'allowlist', userIds: ['user-1'] } });
    expect(isFlagEnabled(allowlist, context({ userId: 'user-2' }), NOW)).toBe(false);
  });

  it('refuses an allowlist cohort when no user id is available', () => {
    const allowlist = definition({ cohort: { kind: 'allowlist', userIds: ['user-1'] } });
    const evaluation = evaluateFlag(allowlist, context({ userId: undefined }), NOW);
    expect(evaluation.enabled).toBe(false);
    expect(evaluation.reason).toContain('user id');
  });

  it('lets the owner global switch win over the cohort', () => {
    const off = definition({ defaultEnabled: false });
    expect(isFlagEnabled(off, context(), NOW)).toBe(false);
  });

  it('lets the environment toggle win over the cohort', () => {
    const flag = definition({
      environments: { development: true, staging: false, production: true },
    });
    const evaluation = evaluateFlag(flag, context({ environment: 'staging' }), NOW);
    expect(evaluation.enabled).toBe(false);
    expect(evaluation.reason).toContain('staging');
  });

  it('falls back to the owner default for a percentage cohort with no user id', () => {
    const flag = definition({
      defaultEnabled: true,
      cohort: { kind: 'percentage', percent: 0 },
    });
    const evaluation = evaluateFlag(flag, context({ userId: undefined }), NOW);
    expect(evaluation.enabled).toBe(true);
    expect(evaluation.reason).toContain('owner default');
  });

  it('marks every decision as sourced from the remote definition', () => {
    expect(evaluateFlag(definition(), context(), NOW).source).toBe('remote');
  });
});

describe('rollout reporting', () => {
  it('reports the percentage for a percentage cohort and null for an allowlist', () => {
    expect(rolloutPercentageOf(definition({ cohort: { kind: 'percentage', percent: 25 } }))).toBe(25);
    expect(rolloutPercentageOf(definition({ cohort: { kind: 'allowlist', userIds: [] } }))).toBeNull();
    expect(rolloutPercentageOf(definition())).toBeNull();
  });

  it('describes each cohort kind in words', () => {
    expect(describeCohort({ kind: 'all' })).toContain('Everyone');
    expect(describeCohort({ kind: 'percentage', percent: 10 })).toContain('10%');
    expect(describeCohort({ kind: 'allowlist', userIds: ['a'] })).toContain('1 user');
  });
});

describe('fail-closed fallback', () => {
  it('disables a flag when the remote configuration is unavailable', () => {
    const fallback = failClosedEvaluation('payouts', 'network down', NOW);
    expect(fallback.enabled).toBe(false);
    expect(fallback.source).toBe('default');
    expect(fallback.reason).toContain('Failing closed');
  });

  it('treats a default-sourced disabled evaluation as a safe fallback', () => {
    expect(isSafeFallback(failClosedEvaluation('reviews', 'timeout', NOW))).toBe(true);
  });

  it('does not treat a remote evaluation as a fallback', () => {
    expect(isSafeFallback(evaluateFlag(definition(), context(), NOW))).toBe(false);
    expect(isSafeFallback(evaluateFlag(definition({ defaultEnabled: false }), context(), NOW))).toBe(
      false
    );
  });
});

describe('exposure records', () => {
  it('records the surface, the user, and the time it was shown', () => {
    const record = recordExposure({
      key: 'discovery',
      userId: 'user-1',
      enabled: true,
      surface: 'hub',
      now: NOW,
    });
    expect(record).toEqual({
      key: 'discovery',
      userId: 'user-1',
      enabled: true,
      surface: 'hub',
      exposedAt: '2025-03-01T00:00:00.000Z',
    });
  });

  it('derives an exposure from an evaluation', () => {
    const evaluation = evaluateFlag(definition(), context(), NOW);
    const record = recordExposureFromEvaluation(evaluation, 'user-1', 'apply', NOW);
    expect(record.key).toBe(evaluation.key);
    expect(record.enabled).toBe(evaluation.enabled);
    expect(record.exposedAt).toBe('2025-03-01T00:00:00.000Z');
  });
});

describe('scholarshipFlagService', () => {
  it('knows every flag key it guards', () => {
    expect(SCHOLARSHIP_FLAG_KEYS).toEqual([
      'discovery',
      'applications',
      'reviews',
      'awards',
      'payouts',
    ]);
  });
});
