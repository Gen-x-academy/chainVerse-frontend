import { describe, expect, it } from 'vitest';
import {
  SCHOLARSHIPS_STAGING_FLAG,
  isNonProductionHostname,
  isTruthyFlag,
  readApiHostname,
  resolveStagingToolingAvailability,
} from '../stagingEnvironment';

describe('isTruthyFlag', () => {
  it('accepts only the documented opt-in values', () => {
    for (const value of ['1', 'true', 'TRUE', ' yes ', 'on']) {
      expect(isTruthyFlag(value)).toBe(true);
    }
  });

  it('rejects anything else, including production-ish values', () => {
    for (const value of [undefined, null, '', '0', 'false', 'no', 'off', 'prod', 'production']) {
      expect(isTruthyFlag(value)).toBe(false);
    }
  });
});

describe('isNonProductionHostname', () => {
  it('accepts local, staging, preprod, sandbox, test, and testnet hosts', () => {
    for (const host of [
      'localhost',
      '127.0.0.1',
      '::1',
      '0.0.0.0',
      'staging.chainverse.example',
      'api.staging.example.com',
      'preprod.internal',
      'sandbox.chainverse.test',
      'api.test.example.com',
      'horizon-testnet.stellar.org',
    ]) {
      expect(isNonProductionHostname(host)).toBe(true);
    }
  });

  it('rejects production-looking hosts', () => {
    for (const host of [
      undefined,
      '',
      'api.chainverse.example',
      'chainverse.com',
      'api.production.example',
      'example.org',
    ]) {
      expect(isNonProductionHostname(host)).toBe(false);
    }
  });
});

describe('readApiHostname', () => {
  it('reads the hostname from an absolute URL', () => {
    expect(readApiHostname('https://staging.chainverse.example/api/v1')).toBe(
      'staging.chainverse.example',
    );
  });

  it('returns undefined when unset or unparseable', () => {
    expect(readApiHostname(undefined)).toBeUndefined();
    expect(readApiHostname('/api')).toBeUndefined();
  });
});

describe('resolveStagingToolingAvailability', () => {
  it('requires an explicit build-time opt-in', () => {
    const result = resolveStagingToolingAvailability({
      flag: undefined,
      apiBaseUrl: 'https://staging.chainverse.example/api',
    });

    expect(result.available).toBe(false);
    expect(result.reason).toContain(SCHOLARSHIPS_STAGING_FLAG);
  });

  it('enables the tooling when the flag is set against a non-production API', () => {
    expect(
      resolveStagingToolingAvailability({
        flag: '1',
        apiBaseUrl: 'https://staging.chainverse.example/api',
      }),
    ).toEqual({
      available: true,
      reason: 'Scholarship staging tooling is enabled for this build.',
    });
  });

  it('disables the tooling when the build points at a production API', () => {
    const result = resolveStagingToolingAvailability({
      flag: '1',
      apiBaseUrl: 'https://api.chainverse.example/v1',
    });

    expect(result.available).toBe(false);
    expect(result.reason).toContain('api.chainverse.example');
  });

  it('allows an unset API base URL so local stacks are not blocked', () => {
    expect(resolveStagingToolingAvailability({ flag: '1' }).available).toBe(true);
  });
});
