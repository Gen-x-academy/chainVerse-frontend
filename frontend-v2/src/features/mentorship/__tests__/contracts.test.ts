import { describe, expect, it } from 'vitest';
import { type EngagementState } from '../../glossary';
import {
  MENTORSHIP_CONTRACTS_VERSION,
  MENTORSHIP_CONTRACT_NAMES,
  type MentorshipContractEnvelope,
  findContractRegistration,
  isContractVersionDeprecated,
  isContractVersionSupported,
  validateContractEnvelope,
  validateMentorshipEvidenceRef,
  validateMentorshipMoney,
  validateMentorshipPagination,
  validateMentorshipWindow,
} from '../contracts';

const VALID_ENVELOPE: MentorshipContractEnvelope<{
  engagementId: string;
  from: EngagementState;
  to: EngagementState;
  reason: string;
}> = {
  contract: 'engagement.transition',
  version: '1.0.0',
  correlationId: 'corr_fixed',
  issuedAt: '2026-03-01T10:00:00.000Z',
  payload: {
    engagementId: 'eng_abc',
    from: 'proposed',
    to: 'accepted',
    reason: 'Mentee accepted on-chain.',
  },
};

describe('versioned mentorship contracts (MENTOR-006, #1253)', () => {
  it('is versioned and registers only known contracts', () => {
    expect(MENTORSHIP_CONTRACTS_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(MENTORSHIP_CONTRACT_NAMES.length).toBeGreaterThan(0);
    for (const contract of MENTORSHIP_CONTRACT_NAMES) {
      expect(findContractRegistration(contract)).toBeDefined();
    }
  });

  describe('primitives', () => {
    it('requires integer minor units and a supported currency for money', () => {
      expect(validateMentorshipMoney({ amountMinorUnits: 1000000, currency: 'XLM' })).toEqual([]);
      expect(validateMentorshipMoney({ amountMinorUnits: 10.5, currency: 'XLM' })).toHaveLength(1);
      expect(validateMentorshipMoney({ amountMinorUnits: -1, currency: 'USDC' })).toHaveLength(1);
      expect(validateMentorshipMoney({ amountMinorUnits: 1, currency: 'DOGE' })).toHaveLength(1);
    });

    it('keeps pagination queries within bounds', () => {
      expect(validateMentorshipPagination({ page: 1, pageSize: 20 })).toEqual([]);
      expect(validateMentorshipPagination({ page: 0, pageSize: 20 })).toHaveLength(1);
      expect(
        validateMentorshipPagination({ page: 2, pageSize: 101 }),
      ).toHaveLength(1);
      expect(
        validateMentorshipPagination({ page: 2, pageSize: 100 }),
      ).toEqual([]);
    });

    it('enforces ISO windows with endsAt strictly after startsAt', () => {
      expect(validateMentorshipWindow({ startsAt: '2026-03-01T00:00:00.000Z' })).toEqual([]);
      expect(
        validateMentorshipWindow({
          startsAt: '2026-03-01T00:00:00.000Z',
          endsAt: '2026-04-01T00:00:00.000Z',
        }),
      ).toEqual([]);
      expect(
        validateMentorshipWindow({
          startsAt: '2026-04-01T00:00:00.000Z',
          endsAt: '2026-03-01T00:00:00.000Z',
        }),
      ).toHaveLength(1);
      expect(validateMentorshipWindow({ startsAt: 'soon' })).toHaveLength(1);
    });

    it('validates evidence references (hash shape, ISO captures)', () => {
      expect(
        validateMentorshipEvidenceRef({
          id: 'evd_1',
          uri: 'ipfs://bafy...',
          sha256: 'a'.repeat(64),
          capturedAt: '2026-03-01T00:00:00.000Z',
        }),
      ).toEqual([]);
      expect(validateMentorshipEvidenceRef({ id: 'evd_1', uri: 'ipfs://bafy...', sha256: 'zz' })).toHaveLength(1);
      expect(validateMentorshipEvidenceRef({ id: '', uri: '' })).toHaveLength(2);
    });
  });

  describe('envelopes', () => {
    it('accepts a fully valid envelope', () => {
      expect(validateContractEnvelope(VALID_ENVELOPE)).toEqual([]);
    });

    it('rejects unknown contracts', () => {
      const outcome = validateContractEnvelope({ ...VALID_ENVELOPE, contract: 'wallet.send' });
      expect(outcome).toHaveLength(1);
      expect(outcome[0].code).toBe('UNKNOWN_CONTRACT');
    });

    it('rejects missing correlation ids so retries can be deduplicated', () => {
      const outcome = validateContractEnvelope({
        ...VALID_ENVELOPE,
        correlationId: '  ',
      });
      expect(outcome.map((violation) => violation.code)).toContain('MISSING_CORRELATION_ID');
    });

    it('rejects unsupported versions', () => {
      const outcome = validateContractEnvelope({ ...VALID_ENVELOPE, version: '9.9.9' });
      expect(outcome.map((violation) => violation.code)).toContain('UNSUPPORTED_CONTRACT_VERSION');
      expect(isContractVersionSupported('engagement.transition', '9.9.9')).toBe(false);
    });

    it('flags deprecated versions explicitly', () => {
      const registry = findContractRegistration('engagement.transition');
      expect(registry).toBeDefined();
      // Nothing is deprecated today; the flag must still be honored.
      expect(isContractVersionDeprecated('engagement.transition', '1.0.0')).toBe(false);
    });

    it('rejects payloads that fail the registered validator', () => {
      const outcome = validateContractEnvelope({
        ...VALID_ENVELOPE,
        payload: { engagementId: '', from: 'proposed', to: 'accepted', reason: '' },
      });
      const fields = outcome.map((violation) => violation.field);
      expect(fields).toContain('engagementId');
      expect(fields).toContain('reason');
    });

    it('validates money payloads on payment quotes', () => {
      const outcome = validateContractEnvelope({
        contract: 'payment.quote',
        version: '1.0.0',
        correlationId: 'corr_fixed',
        issuedAt: '2026-03-01T10:00:00.000Z',
        payload: {
          engagementId: 'eng_abc',
          money: { amountMinorUnits: 2500.5, currency: 'XLM' },
          window: { startsAt: '2026-03-01T00:00:00.000Z' },
        },
      });
      const fields = outcome.map((violation) => violation.field);
      expect(fields).toContain('amountMinorUnits');
    });
  });
});
