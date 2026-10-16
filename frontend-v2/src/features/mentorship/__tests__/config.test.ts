import { describe, expect, it } from 'vitest';
import {
  MENTORSHIP_SAFE_DEFAULTS,
  SAFE_DEFAULT_MENTORSHIP_CONFIG,
  assertMentorshipConfigAtStartup,
  enabledMentorshipCapabilities,
  mergeMentorshipConfig,
  resolveMentorshipConfig,
  validateMentorshipConfig,
} from '../config/service';

describe('safe defaults', () => {
  it('ships every capability off', () => {
    expect(Object.values(SAFE_DEFAULT_MENTORSHIP_CONFIG.featureFlags).every((flag) => !flag)).toBe(
      true,
    );
    expect(enabledMentorshipCapabilities(SAFE_DEFAULT_MENTORSHIP_CONFIG)).toEqual([]);
  });

  it('is internally valid', () => {
    expect(validateMentorshipConfig(SAFE_DEFAULT_MENTORSHIP_CONFIG)).toEqual([]);
  });
});

describe('mergeMentorshipConfig', () => {
  it('merges section by section without erasing unrelated fields', () => {
    const merged = mergeMentorshipConfig(
      {
        featureFlags: { payments: true },
        limits: { maxSessionsPerEngagement: 20 },
        evidenceRules: { requireSessionSummary: false },
      },
      'staging',
    );
    expect(merged.environment).toBe('staging');
    expect(merged.featureFlags.payments).toBe(true);
    expect(merged.featureFlags.discovery).toBe(false);
    expect(merged.limits.maxSessionsPerEngagement).toBe(20);
    expect(merged.limits.maxActiveEngagementsPerMentor).toBe(
      MENTORSHIP_SAFE_DEFAULTS.maxActiveEngagementsPerMentor,
    );
    expect(merged.evidenceRules.requireSessionSummary).toBe(false);
    expect(merged.evidenceRules.requireAcceptedDeliverable).toBe(true);
  });
});

describe('validateMentorshipConfig', () => {
  it('flags an unsupported currency and a default that is not supported', () => {
    const config = mergeMentorshipConfig({
      supportedCurrencies: ['USD', 'XXX' as never],
      defaultCurrency: 'EUR',
    });
    const codes = validateMentorshipConfig(config).map((error) => error.code);
    expect(codes).toContain('UNSUPPORTED_CURRENCY');
    expect(codes).toContain('DEFAULT_CURRENCY_NOT_SUPPORTED');
  });

  it('flags a maximum duration that is not a configured duration', () => {
    const config = mergeMentorshipConfig({
      sessionDurationsMinutes: [30],
      limits: { maxSessionDurationMinutes: 60 },
    });
    expect(validateMentorshipConfig(config).map((error) => error.code)).toContain(
      'DURATION_EXCEEDS_MAX',
    );
  });

  it('flags a notice longer than the cancellation window', () => {
    const config = mergeMentorshipConfig({
      cancellationWindowHours: 12,
      limits: { minCancellationNoticeHours: 24 },
    });
    expect(validateMentorshipConfig(config).map((error) => error.code)).toContain(
      'NOTICE_EXCEEDS_WINDOW',
    );
  });

  it('flags a non-positive limit', () => {
    const config = mergeMentorshipConfig({ limits: { maxSessionsPerEngagement: 0 } });
    expect(validateMentorshipConfig(config).map((error) => error.code)).toContain(
      'NON_POSITIVE_LIMIT',
    );
  });
});

describe('resolveMentorshipConfig', () => {
  it('returns a remote-sourced configuration when the overrides are valid', () => {
    const resolution = resolveMentorshipConfig({ featureFlags: { sessions: true } }, 'development');
    expect(resolution.source).toBe('remote');
    expect(resolution.errors).toEqual([]);
    expect(resolution.config.featureFlags.sessions).toBe(true);
    expect(resolution.config.environment).toBe('development');
  });

  it('falls back to safe defaults when the overrides are invalid', () => {
    const resolution = resolveMentorshipConfig({ supportedCurrencies: [] }, 'production');
    expect(resolution.source).toBe('default');
    expect(resolution.errors.length).toBeGreaterThan(0);
    expect(resolution.config.supportedCurrencies).toEqual(
      SAFE_DEFAULT_MENTORSHIP_CONFIG.supportedCurrencies,
    );
    expect(enabledMentorshipCapabilities(resolution.config)).toEqual([]);
  });

  it('never enables a capability on an invalid document', () => {
    const resolution = resolveMentorshipConfig(
      { featureFlags: { payments: true }, supportedCurrencies: [] },
      'production',
    );
    expect(resolution.config.featureFlags.payments).toBe(false);
  });
});

describe('assertMentorshipConfigAtStartup', () => {
  it('returns the resolution without throwing', () => {
    const resolution = assertMentorshipConfigAtStartup({ supportedCurrencies: [] }, 'staging');
    expect(resolution.source).toBe('default');
  });
});
