/**
 * Scholarship feature flags and staged rollout (closes #1166).
 *
 * Every scholarship surface is gated by a flag definition rather than a build
 * flag, so a program can be released to an allowlist, then a percentage of the
 * cohort, then everyone — per environment. Rollout assignment is derived from a
 * deterministic hash of the user id and a cohort seed, never from a random
 * number, so a user stays in the same cohort across reloads, processes, and
 * machines. When the remote flag service cannot be reached the client fails
 * closed: the feature is treated as disabled rather than silently enabled.
 */

export type ScholarshipFlagKey =
  | 'discovery'
  | 'applications'
  | 'reviews'
  | 'awards'
  | 'payouts';

export type RolloutEnvironment = 'development' | 'staging' | 'production';

export type RolloutCohort =
  | { kind: 'percentage'; percent: number }
  | { kind: 'allowlist'; userIds: string[] }
  | { kind: 'all' };

export type FlagDefinition = {
  key: ScholarshipFlagKey;
  description: string;
  defaultEnabled: boolean;
  environments: Record<RolloutEnvironment, boolean>;
  cohort: RolloutCohort;
  owner: string;
  updatedAt: string;
  version: number;
};

export type FlagEvaluationContext = {
  environment: RolloutEnvironment;
  userId?: string;
  cohortSeed: string;
};

export type FlagEvaluation = {
  key: ScholarshipFlagKey;
  enabled: boolean;
  source: 'remote' | 'default';
  reason: string;
  evaluatedAt: string;
};

export type FlagExposureRecord = {
  key: ScholarshipFlagKey;
  userId: string;
  enabled: boolean;
  exposedAt: string;
  surface: string;
};
