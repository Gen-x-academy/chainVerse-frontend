import { describe, expect, it } from 'vitest';
import {
  normalizeScholarshipError,
  isScholarshipError,
  isScholarshipErrorCode,
  isAuthError,
  isTenancyError,
  isConcurrencyError,
  isValidationError,
  isRetryableError,
  ScholarshipErrorCode,
} from '@/src/features/scholarships/errors';
import { ScholarshipApiError } from '@/src/features/scholarships/services/scholarship-api';

describe('Scholarship Error Adapter (Issue #1226)', () => {
  describe('Stable Error Codes & Message Mapping', () => {
    it('normalizes known application error codes into safe messages without english string dependency', () => {
      const apiError = new ScholarshipApiError(
        JSON.stringify({ code: 'APPLICATION_DEADLINE_EXPIRED' }),
        409,
      );
      const normalized = normalizeScholarshipError(apiError);

      expect(normalized.code).toBe('APPLICATION_DEADLINE_EXPIRED');
      expect(normalized.status).toBe(409);
      expect(normalized.category).toBe('conflict');
      expect(normalized.userMessage).toContain('deadline');
      expect(isScholarshipErrorCode(normalized, 'APPLICATION_DEADLINE_EXPIRED')).toBe(true);
      // Predicate checks must never rely on English messages
      expect(isConcurrencyError(normalized)).toBe(true);
    });

    it('normalizes duplicate application submissions to DUPLICATE code', () => {
      const apiError = new ScholarshipApiError(
        JSON.stringify({ code: 'DUPLICATE_APPLICATION' }),
        409,
      );
      const normalized = normalizeScholarshipError(apiError);

      expect(normalized.code).toBe('APPLICATION_DUPLICATE');
      expect(normalized.userMessage).toContain('already submitted');
      expect(isScholarshipErrorCode(normalized, 'APPLICATION_DUPLICATE')).toBe(true);
    });

    it('normalizes award and agreement error codes', () => {
      const apiError = new ScholarshipApiError(
        JSON.stringify({ code: 'ACCEPTANCE_DEADLINE_PASSED' }),
        409,
      );
      const normalized = normalizeScholarshipError(apiError);

      expect(normalized.code).toBe('AWARD_ACCEPTANCE_DEADLINE_EXPIRED');
      expect(normalized.category).toBe('conflict');
      expect(isScholarshipErrorCode(normalized, 'AWARD_ACCEPTANCE_DEADLINE_EXPIRED')).toBe(true);
    });

    it('normalizes milestone ordering violation', () => {
      const apiError = new ScholarshipApiError(
        JSON.stringify({ code: 'MILESTONE_ORDER_VIOLATION' }),
        400,
      );
      const normalized = normalizeScholarshipError(apiError);

      expect(normalized.code).toBe('MILESTONE_ORDER_VIOLATION');
      expect(normalized.category).toBe('conflict');
      expect(isScholarshipErrorCode(normalized, 'MILESTONE_ORDER_VIOLATION')).toBe(true);
    });

    it('normalizes funding pool exhaustion and amount boundaries', () => {
      const underflow = normalizeScholarshipError(
        new ScholarshipApiError(JSON.stringify({ code: 'AMOUNT_BELOW_MINIMUM' }), 422),
      );
      expect(underflow.code).toBe('AMOUNT_BELOW_MINIMUM');
      expect(underflow.category).toBe('validation');

      const overflow = normalizeScholarshipError(
        new ScholarshipApiError(JSON.stringify({ code: 'AMOUNT_ABOVE_MAXIMUM' }), 422),
      );
      expect(overflow.code).toBe('AMOUNT_ABOVE_MAXIMUM');
      expect(overflow.category).toBe('validation');

      const shortfall = normalizeScholarshipError(
        new ScholarshipApiError(JSON.stringify({ code: 'FUNDING_SHORTFALL' }), 422),
      );
      expect(shortfall.code).toBe('FUNDING_POOL_EXHAUSTED');
      expect(shortfall.category).toBe('conflict');
    });
  });

  describe('Authorization & Tenancy Boundary', () => {
    it('identifies unauthenticated sessions (401)', () => {
      const error = new ScholarshipApiError('Session expired', 401);
      const normalized = normalizeScholarshipError(error);

      expect(normalized.code).toBe('UNAUTHENTICATED');
      expect(normalized.category).toBe('authentication');
      expect(isAuthError(normalized)).toBe(true);
      expect(isTenancyError(normalized)).toBe(false);
    });

    it('identifies unauthorized permission denials (403)', () => {
      const error = new ScholarshipApiError('Forbidden', 403);
      const normalized = normalizeScholarshipError(error);

      expect(normalized.code).toBe('UNAUTHORIZED');
      expect(normalized.category).toBe('authorization');
      expect(isAuthError(normalized)).toBe(true);
    });

    it('identifies tenant mismatches and isolates organization boundaries', () => {
      const error = new ScholarshipApiError(
        JSON.stringify({ code: 'TENANT_MISMATCH' }),
        403,
      );
      const normalized = normalizeScholarshipError(error);

      expect(normalized.code).toBe('TENANT_MISMATCH');
      expect(normalized.category).toBe('tenancy');
      expect(isTenancyError(normalized)).toBe(true);
      expect(normalized.userMessage).toContain('organization');
    });

    it('identifies reviewer conflicts of interest', () => {
      const error = new ScholarshipApiError(
        JSON.stringify({ code: 'CONFLICT_OF_INTEREST' }),
        403,
      );
      const normalized = normalizeScholarshipError(error);

      expect(normalized.code).toBe('REVIEWER_CONFLICT');
      expect(normalized.category).toBe('authorization');
      expect(isAuthError(normalized)).toBe(true);
      expect(normalized.userMessage).toContain('participant');
    });
  });

  describe('Concurrency & Idempotency Collisions', () => {
    it('handles concurrent record modification (409) with reload guidance', () => {
      const error = new ScholarshipApiError('Conflict', 409);
      const normalized = normalizeScholarshipError(error);

      expect(normalized.code).toBe('CONCURRENT_MODIFICATION');
      expect(normalized.category).toBe('concurrency');
      expect(isConcurrencyError(normalized)).toBe(true);
      expect(normalized.userMessage).toContain('modified by another user');
    });

    it('handles idempotency conflicts on payment or submission replays', () => {
      const error = new ScholarshipApiError(
        JSON.stringify({ code: 'IDEMPOTENCY_CONFLICT' }),
        409,
      );
      const normalized = normalizeScholarshipError(error);

      expect(normalized.code).toBe('IDEMPOTENCY_CONFLICT');
      expect(isConcurrencyError(normalized)).toBe(true);
      expect(normalized.userMessage).toContain('transaction token');
    });
  });

  describe('Observability & Supportability (Request IDs)', () => {
    it('extracts and preserves requestId from backend payload for user support', () => {
      const error = new ScholarshipApiError(
        JSON.stringify({
          code: 'LEDGER_DESYNCHRONIZATION',
          requestId: 'req-stellar-tx-99482',
        }),
        502,
      );
      const normalized = normalizeScholarshipError(error);

      expect(normalized.code).toBe('LEDGER_DESYNCHRONIZATION');
      expect(normalized.requestId).toBe('req-stellar-tx-99482');
      expect(normalized.isRetryable).toBe(true);
      expect(isRetryableError(normalized)).toBe(true);
    });

    it('supports traceId and correlationId aliases', () => {
      const error = new ScholarshipApiError(
        JSON.stringify({
          code: 'INTERNAL_SERVER_ERROR',
          traceId: 'trace-abc-123',
        }),
        500,
      );
      const normalized = normalizeScholarshipError(error);
      expect(normalized.requestId).toBe('trace-abc-123');
    });
  });

  describe('Privacy & Sensitive Server Detail Sanitization', () => {
    it('never leaks SQL or stack trace details in userMessage', () => {
      const leakPayload = JSON.stringify({
        code: 'VALIDATION_ERROR',
        userMessage: 'Syntax error in SQL statement: SELECT * FROM private_accounts at line 4',
      });
      const error = new ScholarshipApiError(leakPayload, 500);
      const normalized = normalizeScholarshipError(error);

      // Must sanitize and fallback to safe constant message
      expect(normalized.userMessage).not.toContain('SQL');
      expect(normalized.userMessage).not.toContain('private_accounts');
      expect(normalized.userMessage).toBe(
        'One or more fields in your submission are invalid. Please check the form.',
      );
    });

    it('sanitizes internal file paths and stack lines', () => {
      const leakPayload = JSON.stringify({
        code: 'INTERNAL_SERVER_ERROR',
        userMessage: 'Error at /var/app/backend/src/secrets.ts:88:12',
      });
      const error = new ScholarshipApiError(leakPayload, 500);
      const normalized = normalizeScholarshipError(error);

      expect(normalized.userMessage).not.toContain('/var/app');
      expect(normalized.userMessage).toBe(
        'A temporary server error occurred. Our team has been notified.',
      );
    });
  });

  describe('Structured Field Validation Errors', () => {
    it('parses structured fieldErrors array from backend response', () => {
      const error = new ScholarshipApiError(
        JSON.stringify({
          code: 'VALIDATION_ERROR',
          fieldErrors: [
            { field: 'requestedAmountCents', code: 'MIN_LIMIT', message: 'Amount too low' },
            { field: 'statementSummary', code: 'REQUIRED', message: 'Statement is required' },
          ],
        }),
        422,
      );
      const normalized = normalizeScholarshipError(error);

      expect(normalized.code).toBe('VALIDATION_ERROR');
      expect(isValidationError(normalized)).toBe(true);
      expect(normalized.fieldErrors).toHaveLength(2);
      expect(normalized.fieldErrors[0]).toEqual({
        field: 'requestedAmountCents',
        code: 'MIN_LIMIT',
        message: 'Amount too low',
      });
      expect(normalized.fieldErrors[1].field).toBe('statementSummary');
    });

    it('normalizes NestJS class-validator string message array into field errors', () => {
      const error = new ScholarshipApiError(
        JSON.stringify({
          statusCode: 400,
          message: ['statementSummary should not be empty', 'requestedAmountCents must be positive'],
          error: 'Bad Request',
        }),
        400,
      );
      const normalized = normalizeScholarshipError(error);

      expect(normalized.code).toBe('VALIDATION_ERROR');
      expect(normalized.fieldErrors).toHaveLength(2);
      expect(normalized.fieldErrors[0].message).toBe('statementSummary should not be empty');
    });
  });

  describe('Degradation & Unknown Errors', () => {
    it('degrades unknown error types gracefully into UNKNOWN_ERROR', () => {
      const weirdError = new Error('Random third-party script crashed');
      const normalized = normalizeScholarshipError(weirdError);

      expect(normalized.code).toBe('UNKNOWN_ERROR');
      expect(normalized.status).toBe(0);
      expect(normalized.userMessage).toContain('unexpected error occurred');
      expect(normalized.category).toBe('unknown');
    });

    it('degrades network/fetch failures to NETWORK_ERROR with retryability', () => {
      const netError = new TypeError('Failed to fetch');
      const normalized = normalizeScholarshipError(netError);

      expect(normalized.code).toBe('NETWORK_ERROR');
      expect(normalized.category).toBe('network');
      expect(normalized.isRetryable).toBe(true);
      expect(isRetryableError(normalized)).toBe(true);
    });

    it('idempotently returns already normalized errors', () => {
      const first = normalizeScholarshipError(new ScholarshipApiError('Not found', 404));
      const second = normalizeScholarshipError(first);

      expect(first).toBe(second);
      expect(isScholarshipError(second)).toBe(true);
    });
  });
});
