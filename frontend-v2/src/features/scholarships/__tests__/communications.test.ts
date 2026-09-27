import { describe, expect, it, vi } from 'vitest';
import {
  changesTakeEffectFrom,
  effectivePreference,
  emptyPreferenceMatrix,
  isMandatoryEvent,
  recordOptInConsent,
  requiresConsent,
  togglePreference,
  communicationsService,
} from '@/src/features/scholarships/communications/service';
import type {
  ConsentEvidence,
  PreferenceChange,
  PreferenceMatrix,
} from '@/src/features/scholarships/communications/types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const NOW = new Date('2026-05-04T10:00:00.000Z');

function change(overrides: Partial<PreferenceChange> = {}): PreferenceChange {
  return {
    eventName: 'review.assigned',
    channel: 'email',
    enabled: true,
    effectiveFrom: NOW.toISOString(),
    changedAt: NOW.toISOString(),
    scope: 'user',
    scopeId: 'applicant-1',
    ...overrides,
  };
}

function consentedMatrix(): PreferenceMatrix {
  return recordOptInConsent(emptyPreferenceMatrix([{ scope: 'user', scopeId: 'applicant-1' }]), {
    eventName: 'review.assigned',
    channel: 'email',
    basis: 'opt-in',
    capturedAt: '2026-05-01T00:00:00.000Z',
    policyVersion: '2026-09-01',
  } satisfies ConsentEvidence);
}

describe('mandatory events', () => {
  it('classifies deadlines, decisions, and financial notices as mandatory', () => {
    expect(isMandatoryEvent('deadline.approaching')).toBe(true);
    expect(isMandatoryEvent('application.action-required')).toBe(true);
    expect(isMandatoryEvent('decision.recorded')).toBe(true);
    expect(isMandatoryEvent('award.acceptance-required')).toBe(true);
    expect(isMandatoryEvent('payment.processed')).toBe(true);
    expect(isMandatoryEvent('payout.setup-required')).toBe(true);
    expect(isMandatoryEvent('review.assigned')).toBe(false);
    expect(isMandatoryEvent('milestone.evidence-required')).toBe(false);
  });

  it('can never be disabled by any scope', () => {
    const matrix = emptyPreferenceMatrix([{ scope: 'user', scopeId: 'applicant-1' }]);
    const attempt = change({ eventName: 'decision.recorded', channel: 'email', enabled: false });
    expect(togglePreference(matrix, attempt, NOW)).toBe(matrix);

    const resolved = effectivePreference(matrix, 'decision.recorded', 'email', NOW);
    expect(resolved.enabled).toBe(true);
    expect(resolved.mandatory).toBe(true);
    expect(resolved.reason).toMatch(/cannot be switched off/i);
  });
});

describe('opt-in consent', () => {
  it('refuses to enable an opt-in channel without consent evidence', () => {
    const matrix = emptyPreferenceMatrix([{ scope: 'user', scopeId: 'applicant-1' }]);
    expect(requiresConsent(change())).toBe(true);
    expect(togglePreference(matrix, change(), NOW)).toBe(matrix);
    expect(effectivePreference(matrix, 'review.assigned', 'email', NOW).enabled).toBe(false);
    expect(effectivePreference(matrix, 'review.assigned', 'email', NOW).reason).toMatch(
      /No opt-in consent recorded/
    );
  });

  it('allows enabling once consent evidence exists', () => {
    const matrix = consentedMatrix();
    const next = togglePreference(matrix, change(), NOW);
    expect(next).not.toBe(matrix);
    const resolved = effectivePreference(next, 'review.assigned', 'email', NOW);
    expect(resolved.enabled).toBe(true);
    expect(resolved.reason).toMatch(/Your own choice applies/);
    expect(next.consents.some((evidence) => evidence.basis === 'opt-in')).toBe(true);
    expect(next.entries.find((entry) => entry.scope === 'user')?.consentBasis).toBe('opt-in');
  });

  it('does not require consent for the in-app channel', () => {
    const matrix = emptyPreferenceMatrix();
    const attempt = change({ channel: 'in-app' });
    expect(requiresConsent(attempt)).toBe(false);
    expect(togglePreference(matrix, attempt, NOW)).not.toBe(matrix);
  });
});

describe('scope precedence', () => {
  it('prefers user over program over role', () => {
    const base = consentedMatrix();
    const layered: PreferenceMatrix = {
      ...base,
      scopes: [
        { scope: 'role', scopeId: 'reviewer' },
        { scope: 'program', scopeId: 'chainverse-scholarship' },
        { scope: 'user', scopeId: 'applicant-1' },
      ],
      entries: [
        {
          eventName: 'review.assigned',
          channel: 'email',
          enabled: true,
          mandatory: false,
          updatedAt: '2026-05-01T00:00:00.000Z',
          scope: 'role',
          scopeId: 'reviewer',
          consentBasis: 'service-delivery',
        },
        {
          eventName: 'review.assigned',
          channel: 'email',
          enabled: false,
          mandatory: false,
          updatedAt: '2026-05-02T00:00:00.000Z',
          scope: 'program',
          scopeId: 'chainverse-scholarship',
          consentBasis: 'service-delivery',
        },
      ],
    };

    expect(effectivePreference(layered, 'review.assigned', 'email', NOW).enabled).toBe(false);
    expect(effectivePreference(layered, 'review.assigned', 'email', NOW).reason).toMatch(
      /program default applies/
    );

    const withUser = togglePreference(
      layered,
      change({ enabled: true, scope: 'user', scopeId: 'applicant-1' }),
      NOW
    );
    expect(effectivePreference(withUser, 'review.assigned', 'email', NOW).enabled).toBe(true);
    expect(effectivePreference(withUser, 'review.assigned', 'email', NOW).reason).toMatch(
      /Your own choice applies/
    );

    const roleOnly: PreferenceMatrix = {
      ...layered,
      entries: layered.entries.filter((entry) => entry.scope === 'role'),
    };
    expect(effectivePreference(roleOnly, 'review.assigned', 'email', NOW).reason).toMatch(
      /role default applies/
    );
  });
});

describe('effective time', () => {
  it('takes effect at the next scheduled send, never mid-send', () => {
    const effectiveFrom = changesTakeEffectFrom(change(), NOW);
    expect(effectiveFrom).toBe('2026-05-05T10:00:00.000Z');
    expect(Date.parse(effectiveFrom)).toBeGreaterThan(Date.parse(change().changedAt));
  });

  it('never applies a change before it was made', () => {
    const future = change({ effectiveFrom: '2026-05-10T00:00:00.000Z' });
    expect(changesTakeEffectFrom(future, NOW)).toBe('2026-05-11T00:00:00.000Z');
  });

  it('records the pending change on the new matrix entry', () => {
    const next = togglePreference(consentedMatrix(), change(), NOW);
    const entry = next.entries.find(
      (item) => item.scope === 'user' && item.eventName === 'review.assigned' && item.channel === 'email'
    );
    expect(entry?.updatedAt).toBe('2026-05-05T10:00:00.000Z');
  });
});

describe('communicationsService', () => {
  it('saves the matrix with an idempotency key', async () => {
    const { apiClient } = await import('@/src/lib/api-client');
    const mocked = apiClient as unknown as { get: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> };
    mocked.get.mockResolvedValue(emptyPreferenceMatrix());
    mocked.put.mockResolvedValue(emptyPreferenceMatrix());

    await communicationsService.get();
    expect(mocked.get).toHaveBeenCalledWith('/scholarships/communications/preferences');

    await communicationsService.save({
      matrix: emptyPreferenceMatrix(),
      idempotencyKey: 'comms-1',
      expectedVersion: 0,
    });
    expect(mocked.put).toHaveBeenCalledWith(
      '/scholarships/communications/preferences',
      expect.objectContaining({ idempotencyKey: 'comms-1' })
    );
  });
});
