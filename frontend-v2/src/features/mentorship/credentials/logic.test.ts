import { describe, expect, it } from 'vitest';
import { resolveCredentialStatuses } from './logic';
import type { CredentialClaim } from './types';

function claim(overrides: Partial<CredentialClaim> & { internalId: string }): CredentialClaim {
  return {
    publicId: `ment-${overrides.internalId}`,
    correlationId: `corr-${overrides.internalId}`,
    mentorId: 'mentor-1',
    credentialType: 'certificate',
    credentialRef: 'CERT-001',
    status: 'pending',
    submittedBy: 'mentor-1',
    submittedAt: '2026-01-01T00:00:00.000Z',
    evidence: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('resolveCredentialStatuses', () => {
  it('expires approved claims once the expiry date has passed', () => {
    const list = [
      claim({
        internalId: 'a',
        status: 'approved',
        expiresAt: '2026-01-15T00:00:00.000Z',
      }),
    ];
    expect(resolveCredentialStatuses(list, new Date('2026-02-01T00:00:00.000Z'))).toEqual({
      a: 'expired',
    });
  });

  it('keeps approved claims that have not expired', () => {
    const list = [
      claim({
        internalId: 'a',
        status: 'approved',
        expiresAt: '2026-06-15T00:00:00.000Z',
      }),
    ];
    expect(resolveCredentialStatuses(list, new Date('2026-02-01T00:00:00.000Z'))).toEqual({
      a: 'approved',
    });
  });

  it('keeps revocation terminal even before the expiry date', () => {
    const list = [
      claim({
        internalId: 'a',
        status: 'revoked',
        expiresAt: '2099-01-01T00:00:00.000Z',
      }),
    ];
    expect(resolveCredentialStatuses(list, new Date('2026-02-01T00:00:00.000Z'))).toEqual({
      a: 'revoked',
    });
  });

  it('resolves each claim individually', () => {
    const list = [
      claim({ internalId: 'a', status: 'pending' }),
      claim({ internalId: 'b', status: 'rejected' }),
      claim({ internalId: 'c', status: 'approved' }),
    ];
    const resolved = resolveCredentialStatuses(list, new Date('2026-02-01T00:00:00.000Z'));
    expect(resolved).toEqual({
      a: 'pending',
      b: 'rejected',
      c: 'approved',
    });
  });

  it('treats an unparseable expiry as still valid', () => {
    const list = [
      claim({
        internalId: 'a',
        status: 'approved',
        expiresAt: 'not-a-date',
      }),
    ];
    expect(resolveCredentialStatuses(list, new Date('2026-02-01T00:00:00.000Z'))).toEqual({
      a: 'approved',
    });
  });
});
