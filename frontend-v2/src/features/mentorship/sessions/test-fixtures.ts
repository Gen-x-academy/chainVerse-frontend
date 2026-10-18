/**
 * Deterministic fixtures for the session scheduling tests. Fixed instants, fixed
 * identifiers, no randomness: the same fixture always yields the same result.
 * Test-only; never import this from production code.
 */

import { DEFAULT_BOOKING_POLICY, type BookSessionInput, type BookingPolicy } from './session-booking';
import type { SchedulingActor, SchedulingAgreement } from './session-core';

/** A Monday at 09:00 UTC. */
export const FIXTURE_NOW = new Date('2026-11-02T09:00:00.000Z');

/** Tuesday 14:00 UTC is 09:00 EST in New York and 15:00 CET in Berlin. */
export const FIXTURE_SLOT_START = '2026-11-03T14:00:00.000Z';
export const FIXTURE_SLOT_END = '2026-11-03T14:30:00.000Z';

export const MENTOR_ID = 'user-mentor-1';
export const MENTEE_ID = 'user-mentee-1';
export const TENANT_ID = 'tenant-a';

export const activeAgreement: SchedulingAgreement = {
  agreementId: 'agr-1',
  engagementId: 'eng-1',
  tenantId: TENANT_ID,
  status: 'active',
  mentorId: MENTOR_ID,
  menteeId: MENTEE_ID,
};

export const mentorActor: SchedulingActor = { userId: MENTOR_ID, role: 'mentor', tenantId: TENANT_ID };
export const menteeActor: SchedulingActor = { userId: MENTEE_ID, role: 'mentee', tenantId: TENANT_ID };
export const coordinatorActor: SchedulingActor = { userId: 'user-coord-1', role: 'coordinator', tenantId: TENANT_ID };

export const fixturePolicy: BookingPolicy = {
  ...DEFAULT_BOOKING_POLICY,
  leadTimeMinutes: 120,
  allowedDurationsMinutes: [30, 45, 60],
  bufferMinutes: 0,
};

export function bookingInput(overrides: Partial<BookSessionInput> = {}): BookSessionInput {
  return {
    actor: menteeActor,
    agreement: activeAgreement,
    participants: { mentorId: MENTOR_ID, menteeId: MENTEE_ID },
    startsAt: FIXTURE_SLOT_START,
    durationMinutes: 30,
    mode: 'virtual',
    idempotencyKey: 'book-key-0001',
    timeZone: 'America/New_York',
    policy: fixturePolicy,
    ...overrides,
  };
}
