import { describe, expect, it } from 'vitest';
import { resolveAvailabilityStatus } from './logic';
import type { MentorAvailability } from './types';

function availability(
  overrides: Partial<MentorAvailability> & { internalId: string }
): MentorAvailability {
  return {
    publicId: `ment-${overrides.internalId}`,
    correlationId: `corr-${overrides.internalId}`,
    status: 'accepting_requests',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    updatedBy: 'staff',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('resolveAvailabilityStatus', () => {
  it('returns the status of the window that covers now', () => {
    const list = [
      availability({ internalId: 'a', effectiveFrom: '2026-01-01T00:00:00.000Z' }),
      availability({
        internalId: 'b',
        status: 'waitlist_only',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        effectiveUntil: '2026-08-01T00:00:00.000Z',
      }),
    ];
    const now = new Date('2026-07-01T00:00:00.000Z');
    expect(resolveAvailabilityStatus(list, now)).toBe('waitlist_only');
  });

  it('prefers the latest started window when windows overlap', () => {
    const list = [
      availability({ internalId: 'a', effectiveFrom: '2026-01-01T00:00:00.000Z' }),
      availability({
        internalId: 'b',
        status: 'limited_availability',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
      }),
    ];
    const now = new Date('2026-07-01T00:00:00.000Z');
    expect(resolveAvailabilityStatus(list, now)).toBe('limited_availability');
  });

  it('is not affected by out-of-order input', () => {
    const list = [
      availability({
        internalId: 'b',
        status: 'temporarily_unavailable',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
      }),
      availability({ internalId: 'a', effectiveFrom: '2026-01-01T00:00:00.000Z' }),
    ];
    const now = new Date('2026-07-01T00:00:00.000Z');
    expect(resolveAvailabilityStatus(list, now)).toBe('temporarily_unavailable');
  });

  it('reports inactive when no window covers now', () => {
    const list = [
      availability({
        internalId: 'a',
        effectiveUntil: '2026-02-01T00:00:00.000Z',
      }),
    ];
    const now = new Date('2026-07-01T00:00:00.000Z');
    expect(resolveAvailabilityStatus(list, now)).toBe('inactive');
  });

  it('reports inactive for an empty list', () => {
    expect(resolveAvailabilityStatus([], new Date('2026-07-01T00:00:00.000Z'))).toBe(
      'inactive'
    );
  });

  it('ignores windows that have not started yet', () => {
    const list = [
      availability({
        internalId: 'a',
        status: 'waitlist_only',
        effectiveFrom: '2026-12-01T00:00:00.000Z',
      }),
    ];
    const now = new Date('2026-07-01T00:00:00.000Z');
    expect(resolveAvailabilityStatus(list, now)).toBe('inactive');
  });
});
