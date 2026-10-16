/**
 * Mentorship capability configuration types (closes #1249, MENTOR-002).
 *
 * Configuration is data, not code: feature flags, limits, supported
 * currencies, session durations, cancellation windows, and evidence rules are
 * all resolved at runtime per environment. Invalid configuration never reaches
 * a surface — the resolver falls back to the safe defaults in `./service`.
 */

export type MentorshipFeatureFlagKey =
  | 'discovery'
  | 'engagements'
  | 'sessions'
  | 'payments'
  | 'disputes';

export const MENTORSHIP_FEATURE_FLAG_KEYS: readonly MentorshipFeatureFlagKey[] = [
  'discovery',
  'engagements',
  'sessions',
  'payments',
  'disputes',
];

export type MentorshipEnvironment = 'development' | 'staging' | 'production';

export const MENTORSHIP_ENVIRONMENTS: readonly MentorshipEnvironment[] = [
  'development',
  'staging',
  'production',
];

export type SupportedCurrency = 'USD' | 'EUR' | 'GBP' | 'NGN' | 'KES';

export const SUPPORTED_CURRENCIES: readonly SupportedCurrency[] = [
  'USD',
  'EUR',
  'GBP',
  'NGN',
  'KES',
];

export type SessionDurationMinutes = 30 | 45 | 60 | 90;

export const SESSION_DURATIONS_MINUTES: readonly SessionDurationMinutes[] = [30, 45, 60, 90];

export type MentorshipLimits = {
  maxActiveEngagementsPerMentor: number;
  maxActiveEngagementsPerMentee: number;
  maxSessionsPerEngagement: number;
  maxSessionDurationMinutes: number;
  minCancellationNoticeHours: number;
};

/** Evidence a mentee must supply before an engagement can complete. */
export type EvidenceRule = {
  /** A written summary is required for every session. */
  requireSessionSummary: boolean;
  /** At least one deliverable must be accepted. */
  requireAcceptedDeliverable: boolean;
  /** A signed completion acknowledgement is required. */
  requireCompletionAcknowledgement: boolean;
  /** Maximum size, in bytes, of a single evidence file. */
  maxEvidenceBytes: number;
};

export type MentorshipCapabilityConfig = {
  version: number;
  environment: MentorshipEnvironment;
  featureFlags: Record<MentorshipFeatureFlagKey, boolean>;
  limits: MentorshipLimits;
  supportedCurrencies: SupportedCurrency[];
  defaultCurrency: SupportedCurrency;
  sessionDurationsMinutes: SessionDurationMinutes[];
  /** Hours before a session during which cancellation is allowed. */
  cancellationWindowHours: number;
  evidenceRules: EvidenceRule;
  updatedAt: string;
};

export type MentorshipConfigErrorCode =
  | 'UNKNOWN_ENVIRONMENT'
  | 'UNSUPPORTED_CURRENCY'
  | 'EMPTY_CURRENCIES'
  | 'DEFAULT_CURRENCY_NOT_SUPPORTED'
  | 'EMPTY_SESSION_DURATIONS'
  | 'UNSUPPORTED_SESSION_DURATION'
  | 'DURATION_EXCEEDS_MAX'
  | 'NON_POSITIVE_LIMIT'
  | 'NOTICE_EXCEEDS_WINDOW'
  | 'NEGATIVE_WINDOW'
  | 'INVALID_EVIDENCE_SIZE';

export type MentorshipConfigError = {
  code: MentorshipConfigErrorCode;
  path: string;
  message: string;
};
