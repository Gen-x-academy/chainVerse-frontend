import { describe, expect, it } from 'vitest';
import {
  canSearchSessionSlots,
  findMutualSessionSlots,
  localWallClockToUtc,
  revalidateSessionSlot,
  type ParticipantAvailability,
  type ProgramSlotRules,
  type SlotSearchActor,
  type SlotSearchInput,
} from './slot-finder';

const NOW = new Date('2026-01-01T00:00:00.000Z');
const MONDAY = '2026-01-05';
const RANGE_START = new Date('2026-01-05T00:00:00.000Z');
const RANGE_END = new Date('2026-01-05T23:59:59.000Z');

const MENTOR: SlotSearchActor = {
  userId: 'mentor-1',
  role: 'mentor',
  tenantId: 'tenant-a',
};
const MENTEE: SlotSearchActor = {
  userId: 'mentee-1',
  role: 'mentee',
  tenantId: 'tenant-a',
};
const COORDINATOR: SlotSearchActor = {
  userId: 'coordinator-1',
  role: 'coordinator',
  tenantId: 'tenant-a',
};

function program(overrides: Partial<ProgramSlotRules> = {}): ProgramSlotRules {
  return {
    programId: 'program-1',
    tenantId: 'tenant-a',
    mentorId: 'mentor-1',
    menteeId: 'mentee-1',
    participantIds: ['mentor-1', 'mentee-1'],
    durationMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    capacity: 1,
    slotGranularityMinutes: 30,
    ...overrides,
  };
}

function participant(
  participantId: string,
  windows: ParticipantAvailability['windows'],
  overrides: Partial<ParticipantAvailability> = {},
): ParticipantAvailability {
  return {
    participantId,
    timeZone: 'UTC',
    windows,
    ...overrides,
  };
}

function searchInput(overrides: Partial<SlotSearchInput> = {}): SlotSearchInput {
  return {
    program: program(),
    participants: [
      participant('mentor-1', [{ dayOfWeek: 1, start: '09:00', end: '12:00' }]),
      participant('mentee-1', [{ dayOfWeek: 1, start: '10:00', end: '11:00' }]),
    ],
    actor: MENTOR,
    rangeStart: RANGE_START,
    rangeEnd: RANGE_END,
    now: NOW,
    ...overrides,
  };
}

describe('mutual slot discovery', () => {
  it('intersects participant windows and respects the program duration', () => {
    const result = findMutualSessionSlots(searchInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.page.slots).toEqual([
      {
        startsAt: '2026-01-05T10:00:00.000Z',
        endsAt: '2026-01-05T10:30:00.000Z',
        availableCapacity: 1,
      },
      {
        startsAt: '2026-01-05T10:30:00.000Z',
        endsAt: '2026-01-05T11:00:00.000Z',
        availableCapacity: 1,
      },
    ]);
    expect(result.page.total).toBe(2);
    expect(result.page.nextCursor).toBeUndefined();
  });

  it('is independent of participant input order', () => {
    const forward = findMutualSessionSlots(searchInput());
    const reversed = findMutualSessionSlots(
      searchInput({ participants: [...searchInput().participants].reverse() }),
    );
    expect(reversed).toEqual(forward);
  });

  it('supports participants in different time zones', () => {
    const result = findMutualSessionSlots(
      searchInput({
        program: program({ durationMinutes: 60, slotGranularityMinutes: 60 }),
        participants: [
          participant('mentor-1', [{ dayOfWeek: 1, start: '14:00', end: '16:00' }]),
          participant(
            'mentee-1',
            [{ dayOfWeek: 1, start: '09:00', end: '11:00' }],
            { timeZone: 'America/New_York' },
          ),
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.page.slots).toEqual([
      {
        startsAt: '2026-01-05T14:00:00.000Z',
        endsAt: '2026-01-05T15:00:00.000Z',
        availableCapacity: 1,
      },
      {
        startsAt: '2026-01-05T15:00:00.000Z',
        endsAt: '2026-01-05T16:00:00.000Z',
        availableCapacity: 1,
      },
    ]);
  });

  it('keeps local times stable across DST transitions', () => {
    const participants = [
      participant(
        'mentor-1',
        [{ dayOfWeek: 1, start: '09:00', end: '10:00' }],
        { timeZone: 'America/New_York' },
      ),
      participant(
        'mentee-1',
        [{ dayOfWeek: 1, start: '09:00', end: '10:00' }],
        { timeZone: 'America/New_York' },
      ),
    ];

    const before = findMutualSessionSlots(
      searchInput({
        program: program({ durationMinutes: 60, slotGranularityMinutes: 15 }),
        participants,
        rangeStart: new Date('2026-03-02T00:00:00.000Z'),
        rangeEnd: new Date('2026-03-02T23:59:59.000Z'),
      }),
    );
    const after = findMutualSessionSlots(
      searchInput({
        program: program({ durationMinutes: 60, slotGranularityMinutes: 15 }),
        participants,
        rangeStart: new Date('2026-03-09T00:00:00.000Z'),
        rangeEnd: new Date('2026-03-09T23:59:59.000Z'),
      }),
    );

    expect(before.ok && before.page.slots.map((slot) => slot.startsAt)).toEqual([
      '2026-03-02T14:00:00.000Z',
    ]);
    expect(after.ok && after.page.slots.map((slot) => slot.startsAt)).toEqual([
      '2026-03-09T13:00:00.000Z',
    ]);
  });

  it('skips a local window that does not exist during spring-forward', () => {
    const result = findMutualSessionSlots(
      searchInput({
        participants: [
          participant(
            'mentor-1',
            [{ dayOfWeek: 0, start: '02:30', end: '03:30' }],
            { timeZone: 'America/New_York' },
          ),
          participant(
            'mentee-1',
            [{ dayOfWeek: 0, start: '02:30', end: '03:30' }],
            { timeZone: 'America/New_York' },
          ),
        ],
        rangeStart: new Date('2026-03-08T00:00:00.000Z'),
        rangeEnd: new Date('2026-03-08T23:59:59.000Z'),
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.page.slots).toEqual([]);
  });

  it('removes program and participant blackout periods', () => {
    const result = findMutualSessionSlots(
      searchInput({
        participants: [
          participant('mentor-1', [{ dayOfWeek: 1, start: '09:00', end: '12:00' }]),
          participant('mentee-1', [{ dayOfWeek: 1, start: '09:00', end: '12:00' }]),
        ],
        program: program({ slotGranularityMinutes: 60 }),
        blackouts: [
          { startsAt: '2026-01-05T10:00:00.000Z', endsAt: '2026-01-05T11:00:00.000Z' },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.page.slots.map((slot) => slot.startsAt)).toEqual([
      '2026-01-05T09:00:00.000Z',
      '2026-01-05T11:00:00.000Z',
    ]);
  });
});

describe('buffers, capacity and existing bookings', () => {
  it('respects pre/post-session buffers around existing bookings', () => {
    const result = findMutualSessionSlots(
      searchInput({
        participants: [
          participant('mentor-1', [{ dayOfWeek: 1, start: '09:00', end: '13:00' }]),
          participant('mentee-1', [{ dayOfWeek: 1, start: '09:00', end: '13:00' }]),
        ],
        program: program({
          durationMinutes: 60,
          bufferBeforeMinutes: 15,
          bufferAfterMinutes: 15,
          slotGranularityMinutes: 30,
        }),
        bookings: [
          { startsAt: '2026-01-05T10:00:00.000Z', endsAt: '2026-01-05T11:00:00.000Z' },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.page.slots.map((slot) => slot.startsAt)).toEqual([
      '2026-01-05T11:30:00.000Z',
      '2026-01-05T12:00:00.000Z',
    ]);
  });

  it('counts overlapping bookings against capacity', () => {
    const withOneBooking = findMutualSessionSlots(
      searchInput({
        participants: [
          participant('mentor-1', [{ dayOfWeek: 1, start: '09:00', end: '12:00' }]),
          participant('mentee-1', [{ dayOfWeek: 1, start: '09:00', end: '12:00' }]),
        ],
        program: program({ durationMinutes: 60, slotGranularityMinutes: 60, capacity: 2 }),
        bookings: [
          { startsAt: '2026-01-05T10:00:00.000Z', endsAt: '2026-01-05T11:00:00.000Z' },
        ],
      }),
    );
    expect(withOneBooking.ok).toBe(true);
    if (!withOneBooking.ok) return;
    expect(withOneBooking.page.slots).toEqual([
      { startsAt: '2026-01-05T09:00:00.000Z', endsAt: '2026-01-05T10:00:00.000Z', availableCapacity: 2 },
      { startsAt: '2026-01-05T10:00:00.000Z', endsAt: '2026-01-05T11:00:00.000Z', availableCapacity: 1 },
      { startsAt: '2026-01-05T11:00:00.000Z', endsAt: '2026-01-05T12:00:00.000Z', availableCapacity: 2 },
    ]);

    const full = findMutualSessionSlots(
      searchInput({
        participants: [
          participant('mentor-1', [{ dayOfWeek: 1, start: '09:00', end: '12:00' }]),
          participant('mentee-1', [{ dayOfWeek: 1, start: '09:00', end: '12:00' }]),
        ],
        program: program({ durationMinutes: 60, slotGranularityMinutes: 60, capacity: 2 }),
        bookings: [
          { startsAt: '2026-01-05T10:00:00.000Z', endsAt: '2026-01-05T11:00:00.000Z' },
          { startsAt: '2026-01-05T10:15:00.000Z', endsAt: '2026-01-05T10:45:00.000Z' },
        ],
      }),
    );
    expect(full.ok).toBe(true);
    if (!full.ok) return;
    expect(full.page.slots.map((slot) => slot.startsAt)).toEqual([
      '2026-01-05T09:00:00.000Z',
      '2026-01-05T11:00:00.000Z',
    ]);
  });

  it('excludes slots that start before now or inside the lead time', () => {
    const result = findMutualSessionSlots(
      searchInput({
        program: program({ durationMinutes: 60, slotGranularityMinutes: 60, leadTimeMinutes: 60 }),
        participants: [
          participant('mentor-1', [{ dayOfWeek: 1, start: '09:00', end: '12:00' }]),
          participant('mentee-1', [{ dayOfWeek: 1, start: '09:00', end: '12:00' }]),
        ],
        now: new Date('2026-01-05T09:00:00.000Z'),
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.page.slots.map((slot) => slot.startsAt)).toEqual([
      '2026-01-05T10:00:00.000Z',
      '2026-01-05T11:00:00.000Z',
    ]);
  });
});

describe('pagination', () => {
  it('paginates deterministically with a stable cursor', () => {
    const input = searchInput({
      participants: [
        participant('mentor-1', [{ dayOfWeek: 1, start: '09:00', end: '17:00' }]),
        participant('mentee-1', [{ dayOfWeek: 1, start: '09:00', end: '17:00' }]),
      ],
      program: program({ durationMinutes: 60, slotGranularityMinutes: 60 }),
      limit: 3,
    });

    const first = findMutualSessionSlots(input);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.page.slots.map((slot) => slot.startsAt)).toEqual([
      '2026-01-05T09:00:00.000Z',
      '2026-01-05T10:00:00.000Z',
      '2026-01-05T11:00:00.000Z',
    ]);
    expect(first.page.total).toBe(8);
    expect(first.page.nextCursor).toBe('2026-01-05T11:00:00.000Z');

    const second = findMutualSessionSlots({ ...input, cursor: first.page.nextCursor });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.page.slots.map((slot) => slot.startsAt)).toEqual([
      '2026-01-05T12:00:00.000Z',
      '2026-01-05T13:00:00.000Z',
      '2026-01-05T14:00:00.000Z',
    ]);
  });

  it('rejects an unknown cursor and an invalid page size', () => {
    const badCursor = findMutualSessionSlots(searchInput({ cursor: 'not-a-slot' }));
    expect(badCursor).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'INVALID_PAGE' }),
    });

    const badLimit = findMutualSessionSlots(searchInput({ limit: 101 }));
    expect(badLimit).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'INVALID_PAGE' }),
    });
  });
});

describe('authorization and validation', () => {
  it('allows participants, coordinators and administrators in the program tenant', () => {
    expect(canSearchSessionSlots(program(), MENTOR)).toBe(true);
    expect(canSearchSessionSlots(program(), MENTEE)).toBe(true);
    expect(canSearchSessionSlots(program(), COORDINATOR)).toBe(true);
    expect(
      canSearchSessionSlots(program(), { ...COORDINATOR, role: 'administrator' }),
    ).toBe(true);
  });

  it('denies outsiders and other tenants by default', () => {
    expect(
      findMutualSessionSlots(
        searchInput({ actor: { ...MENTOR, userId: 'mentor-2' } }),
      ),
    ).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'NOT_AUTHORIZED' }),
    });
    expect(
      findMutualSessionSlots(
        searchInput({ actor: { ...MENTOR, tenantId: 'tenant-b' } }),
      ),
    ).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'NOT_AUTHORIZED' }),
    });
  });

  it('returns stable validation codes for invalid duration, windows and time zones', () => {
    expect(
      findMutualSessionSlots(searchInput({ program: program({ durationMinutes: 0 }) })),
    ).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'INVALID_SEARCH' }),
    });
    expect(
      findMutualSessionSlots(
        searchInput({
          participants: [
            participant('mentor-1', [{ dayOfWeek: 1, start: '12:00', end: '09:00' }]),
            participant('mentee-1', [{ dayOfWeek: 1, start: '09:00', end: '12:00' }]),
          ],
        }),
      ),
    ).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'INVALID_WINDOW' }),
    });
    expect(
      findMutualSessionSlots(
        searchInput({
          participants: [
            participant('mentor-1', [{ dayOfWeek: 1, start: '09:00', end: '12:00' }], {
              timeZone: 'Mars/Olympus',
            }),
            participant('mentee-1', [{ dayOfWeek: 1, start: '09:00', end: '12:00' }]),
          ],
        }),
      ),
    ).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'INVALID_TIME_ZONE' }),
    });
  });

  it('rejects a search range longer than the allowed horizon', () => {
    const result = findMutualSessionSlots(
      searchInput({
        rangeStart: new Date('2026-01-01T00:00:00.000Z'),
        rangeEnd: new Date('2026-06-01T00:00:00.000Z'),
      }),
    );
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'INVALID_SEARCH' }),
    });
  });
});

describe('revalidation at booking time', () => {
  it('accepts a candidate that is still available', () => {
    const found = findMutualSessionSlots(searchInput());
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    const candidate = found.page.slots[0];

    const result = revalidateSessionSlot({
      program: program(),
      participants: searchInput().participants,
      actor: MENTOR,
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
      now: NOW,
      candidate,
    });

    expect(result).toEqual({ ok: true, slot: candidate });
  });

  it('rejects a candidate once a booking has taken it', () => {
    const found = findMutualSessionSlots(searchInput());
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    const candidate = found.page.slots[0];

    const result = revalidateSessionSlot({
      program: program(),
      participants: searchInput().participants,
      actor: MENTOR,
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
      now: NOW,
      candidate,
      bookings: [
        { startsAt: candidate.startsAt, endsAt: candidate.endsAt },
      ],
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'SLOT_STALE' }),
    });
  });

  it('rejects an expired candidate', () => {
    const found = findMutualSessionSlots(searchInput());
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    const candidate = found.page.slots[0];

    const result = revalidateSessionSlot({
      program: program(),
      participants: searchInput().participants,
      actor: MENTOR,
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
      now: new Date('2026-01-06T00:00:00.000Z'),
      candidate,
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'SLOT_STALE' }),
    });
  });
});

describe('time-zone conversion helper', () => {
  it('keeps local wall-clock time and skips non-existent local times', () => {
    expect(localWallClockToUtc(MONDAY, '09:00', 'UTC')?.toISOString()).toBe(
      '2026-01-05T09:00:00.000Z',
    );
    expect(localWallClockToUtc('2026-03-08', '02:30', 'America/New_York')).toBeNull();
  });
});
