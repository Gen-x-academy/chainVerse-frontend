import { describe, expect, it } from 'vitest';
import {
  normalizeScholarshipError,
  sanitizeServerDetail,
  scholarshipErrorCodeFrom,
  scholarshipErrorSupportLine,
  scholarshipFieldErrorMap,
} from '../error-adapter';
import { ScholarshipApiError } from '../../services/scholarship-api';

describe('scholarshipErrorCodeFrom', () => {
  it('maps backend codes case-insensitively', () => {
    expect(scholarshipErrorCodeFrom('duplicate_application')).toBe('DUPLICATE');
    expect(scholarshipErrorCodeFrom('VERSION_CONFLICT')).toBe('CONCURRENCY_CONFLICT');
    expect(scholarshipErrorCodeFrom('round_closed')).toBe('DEADLINE_PASSED');
    expect(scholarshipErrorCodeFrom('not-a-real-code')).toBeUndefined();
    expect(scholarshipErrorCodeFrom(undefined)).toBeUndefined();
  });
});

describe('sanitizeServerDetail', () => {
  it('strips HTML, stack frames, and paths', () => {
    const raw =
      '<html><body>Boom</body></html> at handler (/srv/app/server.js:10:2) C:\\secrets\\key.pem';
    const safe = sanitizeServerDetail(raw);
    expect(safe).toBeDefined();
    expect(safe).not.toMatch(/<html>/);
    expect(safe).not.toContain('/srv/app');
    expect(safe).not.toContain('C:\\secrets');
  });

  it('redacts secret-looking tokens', () => {
    const safe = sanitizeServerDetail('api_key: abc123 should not leak');
    expect(safe).toContain('[redacted]');
    expect(safe).not.toContain('abc123');
  });

  it('returns undefined for empty or whitespace-only input', () => {
    expect(sanitizeServerDetail('')).toBeUndefined();
    expect(sanitizeServerDetail('   ')).toBeUndefined();
    expect(sanitizeServerDetail(undefined)).toBeUndefined();
  });

  it('caps the result length', () => {
    const safe = sanitizeServerDetail('x'.repeat(500));
    expect(safe?.length).toBeLessThanOrEqual(200);
  });
});

describe('normalizeScholarshipError', () => {
  it('maps a backend code to a stable code and safe message', () => {
    const error = normalizeScholarshipError({
      code: 'DUPLICATE_APPLICATION',
      message: 'An application already exists for this round',
    });
    expect(error.code).toBe('DUPLICATE');
    expect(error.message).toMatch(/already exists/i);
    expect(error.retryable).toBe(false);
  });

  it('prefers a tenant-specific code over the HTTP status', () => {
    const error = normalizeScholarshipError(
      new ScholarshipApiError(JSON.stringify({ code: 'CROSS_TENANT_DENIED' }), 403),
    );
    expect(error.code).toBe('CROSS_TENANT');
    expect(error.httpStatus).toBe(403);
  });

  it('parses JSON embedded in a ScholarshipApiError message', () => {
    const body = JSON.stringify({
      code: 'VALIDATION_FAILED',
      requestId: 'req-123',
      errors: [
        { field: 'amountCents', code: 'AMOUNT_BELOW_MINIMUM', message: 'Award amount must be at least 1.' },
      ],
    });
    const error = normalizeScholarshipError(new ScholarshipApiError(body, 422));
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.requestId).toBe('req-123');
    expect(error.fieldErrors).toHaveLength(1);
    expect(error.fieldErrors[0].field).toBe('amountCents');
    expect(error.fieldErrors[0].code).toBe('AMOUNT_BELOW_MINIMUM');
  });

  it('maps plain HTTP statuses when no code is supplied', () => {
    expect(normalizeScholarshipError(new ScholarshipApiError('nope', 401)).code).toBe(
      'UNAUTHENTICATED',
    );
    expect(normalizeScholarshipError(new ScholarshipApiError('nope', 404)).code).toBe('NOT_FOUND');
    expect(normalizeScholarshipError(new ScholarshipApiError('nope', 429)).code).toBe('RATE_LIMITED');
    expect(normalizeScholarshipError(new ScholarshipApiError('nope', 500)).code).toBe('SERVER_ERROR');
  });

  it('treats a fetch rejection as a retryable network error', () => {
    const networkError = Object.assign(new Error('Failed to fetch'), { name: 'TypeError' });
    const error = normalizeScholarshipError(networkError);
    expect(error.code).toBe('NETWORK');
    expect(error.retryable).toBe(true);
  });

  it('degrades unknown values to one stable message', () => {
    expect(normalizeScholarshipError('a bare string').code).toBe('UNKNOWN');
    expect(normalizeScholarshipError(null).code).toBe('UNKNOWN');
    expect(normalizeScholarshipError(undefined).code).toBe('UNKNOWN');
    expect(normalizeScholarshipError(42).code).toBe('UNKNOWN');
    expect(normalizeScholarshipError(null).message).toBe(
      normalizeScholarshipError('something else').message,
    );
  });

  it('sanitises an unsafe field message', () => {
    const error = normalizeScholarshipError({
      code: 'VALIDATION_FAILED',
      errors: [{ field: 'evidence', message: '<script>alert(1)</script> at db.ts:1:1' }],
    });
    expect(error.fieldErrors[0].message).not.toContain('<script>');
    expect(error.fieldErrors[0].message).not.toContain('db.ts');
  });

  it('never invents a request id', () => {
    expect(normalizeScholarshipError(new Error('boom')).requestId).toBeUndefined();
  });
});

describe('helpers', () => {
  it('builds a field → message map, keeping the first message per field', () => {
    const error = normalizeScholarshipError({
      code: 'VALIDATION_FAILED',
      errors: [
        { field: 'title', message: 'Title is required.' },
        { field: 'title', message: 'Title is too long.' },
        { field: 'body', message: 'Body is required.' },
      ],
    });
    const map = scholarshipFieldErrorMap(error);
    expect(Object.keys(map)).toEqual(['title', 'body']);
    expect(map.title).toMatch(/required/i);
  });

  it('reports a support reference only when the server supplied one', () => {
    const withId = normalizeScholarshipError({ code: 'SERVER_ERROR', requestId: 'req-9' });
    const withoutId = normalizeScholarshipError({ code: 'SERVER_ERROR' });
    expect(scholarshipErrorSupportLine(withId)).toContain('req-9');
    expect(scholarshipErrorSupportLine(withoutId)).toMatch(/no reference/i);
  });
});
