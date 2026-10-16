/**
 * Mentorship capability configuration resolver (closes #1249, MENTOR-002).
 *
 * The resolver is a pure function of `(defaults, overrides, environment)`:
 *
 * 1. It starts from `SAFE_DEFAULT_MENTORSHIP_CONFIG`, in which every feature
 *    flag is **off** and the limits are conservative.
 * 2. It shallow-merges the remote overrides, section by section.
 * 3. It validates the merged document. If anything is invalid the safe defaults
 *    win and the errors are returned — an invalid configuration can never
 *    switch a capability on or apply an unsafe limit.
 *
 * Nothing here reads `process.env` implicitly; the caller passes `environment`
 * so the same code runs in tests, the browser, and a startup check.
 */

import { apiClient } from '@/src/lib/api-client';
import {
  MENTORSHIP_ENVIRONMENTS,
  MENTORSHIP_FEATURE_FLAG_KEYS,
  SESSION_DURATIONS_MINUTES,
  SUPPORTED_CURRENCIES,
  type EvidenceRule,
  type MentorshipCapabilityConfig,
  type MentorshipConfigError,
  type MentorshipEnvironment,
  type MentorshipFeatureFlagKey,
  type MentorshipLimits,
  type SessionDurationMinutes,
  type SupportedCurrency,
} from './types';

export const MENTORSHIP_SAFE_DEFAULTS: MentorshipLimits = {
  maxActiveEngagementsPerMentor: 5,
  maxActiveEngagementsPerMentee: 3,
  maxSessionsPerEngagement: 12,
  maxSessionDurationMinutes: 60,
  minCancellationNoticeHours: 24,
};

export const MENTORSHIP_SAFE_EVIDENCE_RULES: EvidenceRule = {
  requireSessionSummary: true,
  requireAcceptedDeliverable: true,
  requireCompletionAcknowledgement: false,
  maxEvidenceBytes: 10 * 1024 * 1024,
};

/**
 * The configuration every surface starts from. Every flag is off, so shipping
 * this module changes no user-visible behaviour until an operator opts in.
 */
export const SAFE_DEFAULT_MENTORSHIP_CONFIG: MentorshipCapabilityConfig = {
  version: 1,
  environment: 'production',
  featureFlags: {
    discovery: false,
    engagements: false,
    sessions: false,
    payments: false,
    disputes: false,
  },
  limits: { ...MENTORSHIP_SAFE_DEFAULTS },
  supportedCurrencies: ['USD'],
  defaultCurrency: 'USD',
  sessionDurationsMinutes: [30, 60],
  cancellationWindowHours: 48,
  evidenceRules: { ...MENTORSHIP_SAFE_EVIDENCE_RULES },
  updatedAt: '1970-01-01T00:00:00.000Z',
};

export type MentorshipConfigOverrides = {
  version?: number;
  featureFlags?: Partial<Record<MentorshipFeatureFlagKey, boolean>>;
  limits?: Partial<MentorshipLimits>;
  supportedCurrencies?: SupportedCurrency[];
  defaultCurrency?: SupportedCurrency;
  sessionDurationsMinutes?: SessionDurationMinutes[];
  cancellationWindowHours?: number;
  evidenceRules?: Partial<EvidenceRule>;
  updatedAt?: string;
};

export type MentorshipConfigResolution = {
  config: MentorshipCapabilityConfig;
  errors: MentorshipConfigError[];
  /** `default` means the remote document was missing or invalid. */
  source: 'remote' | 'default';
  /** The environment the resolution was performed for. */
  environment: MentorshipEnvironment;
};

/**
 * Merges overrides onto the safe defaults. Deep-merges the three nested
 * sections so a partial remote document cannot erase an unrelated field.
 */
export function mergeMentorshipConfig(
  overrides: MentorshipConfigOverrides = {},
  environment: MentorshipEnvironment = SAFE_DEFAULT_MENTORSHIP_CONFIG.environment,
): MentorshipCapabilityConfig {
  const base = SAFE_DEFAULT_MENTORSHIP_CONFIG;
  return {
    version: overrides.version ?? base.version,
    environment,
    featureFlags: {
      ...base.featureFlags,
      ...(overrides.featureFlags ?? {}),
    },
    limits: {
      ...base.limits,
      ...(overrides.limits ?? {}),
    },
    supportedCurrencies: overrides.supportedCurrencies ?? [...base.supportedCurrencies],
    defaultCurrency: overrides.defaultCurrency ?? base.defaultCurrency,
    sessionDurationsMinutes:
      overrides.sessionDurationsMinutes ?? [...base.sessionDurationsMinutes],
    cancellationWindowHours: overrides.cancellationWindowHours ?? base.cancellationWindowHours,
    evidenceRules: {
      ...base.evidenceRules,
      ...(overrides.evidenceRules ?? {}),
    },
    updatedAt: overrides.updatedAt ?? base.updatedAt,
  };
}

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/**
 * Validates a fully-merged configuration. Returns every problem, each with a
 * stable code and the JSON path that failed, so a form can map errors to
 * fields without parsing English.
 */
export function validateMentorshipConfig(
  config: MentorshipCapabilityConfig,
): MentorshipConfigError[] {
  const errors: MentorshipConfigError[] = [];

  if (!MENTORSHIP_ENVIRONMENTS.includes(config.environment)) {
    errors.push({
      code: 'UNKNOWN_ENVIRONMENT',
      path: 'environment',
      message: `Unknown environment "${String(config.environment)}".`,
    });
  }

  if (config.supportedCurrencies.length === 0) {
    errors.push({
      code: 'EMPTY_CURRENCIES',
      path: 'supportedCurrencies',
      message: 'At least one supported currency is required.',
    });
  }
  for (const [index, currency] of config.supportedCurrencies.entries()) {
    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      errors.push({
        code: 'UNSUPPORTED_CURRENCY',
        path: `supportedCurrencies[${index}]`,
        message: `Currency "${String(currency)}" is not supported.`,
      });
    }
  }
  if (!config.supportedCurrencies.includes(config.defaultCurrency)) {
    errors.push({
      code: 'DEFAULT_CURRENCY_NOT_SUPPORTED',
      path: 'defaultCurrency',
      message: 'The default currency must be one of the supported currencies.',
    });
  }

  if (config.sessionDurationsMinutes.length === 0) {
    errors.push({
      code: 'EMPTY_SESSION_DURATIONS',
      path: 'sessionDurationsMinutes',
      message: 'At least one session duration is required.',
    });
  }
  for (const [index, duration] of config.sessionDurationsMinutes.entries()) {
    if (!SESSION_DURATIONS_MINUTES.includes(duration)) {
      errors.push({
        code: 'UNSUPPORTED_SESSION_DURATION',
        path: `sessionDurationsMinutes[${index}]`,
        message: `Session duration ${String(duration)} is not supported.`,
      });
    }
  }
  if (
    Number.isFinite(config.limits.maxSessionDurationMinutes) &&
    !config.sessionDurationsMinutes.includes(
      config.limits.maxSessionDurationMinutes as SessionDurationMinutes,
    )
  ) {
    errors.push({
      code: 'DURATION_EXCEEDS_MAX',
      path: 'limits.maxSessionDurationMinutes',
      message: 'The maximum session duration must be one of the configured durations.',
    });
  }

  const limitFields: (keyof MentorshipLimits)[] = [
    'maxActiveEngagementsPerMentor',
    'maxActiveEngagementsPerMentee',
    'maxSessionsPerEngagement',
    'maxSessionDurationMinutes',
  ];
  for (const field of limitFields) {
    if (!isFinitePositive(config.limits[field])) {
      errors.push({
        code: 'NON_POSITIVE_LIMIT',
        path: `limits.${field}`,
        message: `${field} must be a positive number.`,
      });
    }
  }
  if (config.limits.minCancellationNoticeHours < 0) {
    errors.push({
      code: 'NON_POSITIVE_LIMIT',
      path: 'limits.minCancellationNoticeHours',
      message: 'The minimum notice cannot be negative.',
    });
  }

  if (config.cancellationWindowHours < 0) {
    errors.push({
      code: 'NEGATIVE_WINDOW',
      path: 'cancellationWindowHours',
      message: 'The cancellation window cannot be negative.',
    });
  } else if (config.limits.minCancellationNoticeHours > config.cancellationWindowHours) {
    errors.push({
      code: 'NOTICE_EXCEEDS_WINDOW',
      path: 'limits.minCancellationNoticeHours',
      message: 'The minimum notice cannot exceed the cancellation window.',
    });
  }

  if (!isFinitePositive(config.evidenceRules.maxEvidenceBytes)) {
    errors.push({
      code: 'INVALID_EVIDENCE_SIZE',
      path: 'evidenceRules.maxEvidenceBytes',
      message: 'The maximum evidence size must be a positive number of bytes.',
    });
  }

  return errors;
}

/**
 * Resolves a config for one environment. An invalid remote document is
 * discarded wholesale: the returned `config` is always safe to render.
 */
export function resolveMentorshipConfig(
  overrides: MentorshipConfigOverrides = {},
  environment: MentorshipEnvironment = 'production',
): MentorshipConfigResolution {
  const candidate = mergeMentorshipConfig(overrides, environment);
  const errors = validateMentorshipConfig(candidate);

  if (errors.length > 0) {
    return {
      config: { ...SAFE_DEFAULT_MENTORSHIP_CONFIG, environment },
      errors,
      source: 'default',
      environment,
    };
  }

  return { config: candidate, errors: [], source: 'remote', environment };
}

/**
 * Startup check. Call once when the app boots (or when a config panel loads)
 * so an invalid document is surfaced immediately instead of at first use.
 */
export function assertMentorshipConfigAtStartup(
  overrides: MentorshipConfigOverrides,
  environment: MentorshipEnvironment,
): MentorshipConfigResolution {
  const resolution = resolveMentorshipConfig(overrides, environment);
  if (resolution.errors.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `[mentorship] rejected invalid ${environment} capability configuration; using safe defaults.`,
      resolution.errors,
    );
  }
  return resolution;
}

/** The capabilities that are live for a given config, as display data. */
export function enabledMentorshipCapabilities(
  config: MentorshipCapabilityConfig,
): MentorshipFeatureFlagKey[] {
  return MENTORSHIP_FEATURE_FLAG_KEYS.filter((key) => config.featureFlags[key]);
}

export const mentorshipConfigService = {
  get: (environment: MentorshipEnvironment): Promise<MentorshipConfigOverrides> =>
    apiClient.get<MentorshipConfigOverrides>(
      `/mentorship/config?environment=${encodeURIComponent(environment)}`,
    ),

  /** Fetches and resolves in one step, degrading to safe defaults on failure. */
  resolve: async (
    environment: MentorshipEnvironment,
  ): Promise<MentorshipConfigResolution> => {
    try {
      const remote = await mentorshipConfigService.get(environment);
      return resolveMentorshipConfig(remote, environment);
    } catch {
      return {
        config: { ...SAFE_DEFAULT_MENTORSHIP_CONFIG, environment },
        errors: [],
        source: 'default',
        environment,
      };
    }
  },

  put: (
    environment: MentorshipEnvironment,
    config: MentorshipCapabilityConfig,
  ): Promise<MentorshipCapabilityConfig> =>
    apiClient.put<MentorshipCapabilityConfig>(
      `/mentorship/config?environment=${encodeURIComponent(environment)}`,
      config,
    ),
};
