import { describe, expect, it } from 'vitest';
import {
  createCalendarConnection,
  createExternalCalendarState,
  disconnectExternalCalendar,
  externalCalendarError,
  isOpaqueTokenRef,
  normalizeBusyWindows,
  subtractBusyWindows,
  syncExternalCalendar,
  toBusyWindows,
  type CalendarActor,
  type CalendarConnection,
  type CalendarProvider,
  type ExternalCalendarState,
} from './external-calendar';

const NOW = new Date('2026-05-01T10:00:00.000Z');

const MENTOR: CalendarActor = { userId: 'mentor-1', role: 'mentor', tenantId: 'tenant-a' };
const ADMIN: CalendarActor = { userId: 'admin-1', role: 'administrator', tenantId: 'tenant-a' };
const STRANGER: CalendarActor = { userId: 'mentor-2', role: 'mentor', tenantId: 'tenant-a' };
const OTHER_TENANT: CalendarActor = {
  userId: 'admin-2',
  role: 'administrator',
  tenantId: 'tenant-b',
};

function connectInput(overrides: Partial<Parameters<typeof createCalendarConnection>[0]> = {}) {
  return {
    id: 'connection-1',
    mentorId: MENTOR.userId,
    tenantId: MENTOR.tenantId,
    provider: 'google' as CalendarProvider,
    tokenRef: 'vault:encrypted-ref-1',
    tokenKeyVersion: 'k1',
    scopes: ['calendar.freebusy'],
    actor: MENTOR,
    now: NOW,
    ...overrides,
  };
}

function connection(overrides: Partial<CalendarConnection> = {}): CalendarConnection {
  return {
    id: 'connection-1',
    mentorId: MENTOR.userId,
    tenantId: MENTOR.tenantId,
    provider: 'google',
    tokenRef: 'vault:encrypted-ref-1',
    tokenKeyVersion: 'k1',
    scopes: ['calendar.freebusy'],
    status: 'connected',
    connectedAt: NOW.toISOString(),
    ...overrides,
  };
}

function stateWith(overrides: Partial<ExternalCalendarState> = {}): ExternalCalendarState {
  const base = createExternalCalendarState();
  return { ...base, connections: [connection()], ...overrides };
}

describe('calendar connection authorization and scoping', () => {
  it('connects an authorized mentor with only the free/busy scope', () => {
    const result = createCalendarConnection(connectInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.connection).toMatchObject({
      status: 'connected',
      scopes: ['calendar.freebusy'],
      tokenRef: 'vault:encrypted-ref-1',
      tokenKeyVersion: 'k1',
    });
  });

  it('allows an administrator in the same tenant but denies other tenants', () => {
    expect(createCalendarConnection(connectInput({ actor: ADMIN })).ok).toBe(true);
    expect(createCalendarConnection(connectInput({ actor: OTHER_TENANT }))).toEqual({
      ok: false,
      error: externalCalendarError('NOT_AUTHORIZED'),
    });
  });

  it('denies another mentor connecting on someone else behalf', () => {
    expect(createCalendarConnection(connectInput({ actor: STRANGER }))).toEqual({
      ok: false,
      error: externalCalendarError('NOT_AUTHORIZED'),
    });
  });

  it('rejects unsupported providers, broad scopes and raw token values', () => {
    expect(createCalendarConnection(connectInput({ provider: 'apple' as CalendarProvider }))).toEqual({
      ok: false,
      error: externalCalendarError('UNSUPPORTED_PROVIDER'),
    });
    expect(
      createCalendarConnection(connectInput({ scopes: ['calendar.freebusy', 'calendar.events'] })),
    ).toEqual({
      ok: false,
      error: externalCalendarError('INVALID_SCOPE'),
    });
    expect(createCalendarConnection(connectInput({ tokenRef: 'ya29.raw-provider-token' }))).toEqual({
      ok: false,
      error: externalCalendarError('INVALID_TOKEN_HANDLE'),
    });
    expect(isOpaqueTokenRef('vault:abc')).toBe(true);
    expect(isOpaqueTokenRef('vault:has space')).toBe(false);
  });
});

describe('free/busy privacy boundary', () => {
  it('retains only busy start/end times and drops event content', () => {
    const windows = toBusyWindows(
      [
        {
          id: 'event-1',
          startsAt: '2026-05-01T09:00:00.000Z',
          endsAt: '2026-05-01T10:00:00.000Z',
          status: 'confirmed',
          summary: 'PRIVATE-EVENT-TITLE',
          description: 'PRIVATE-EVENT-DESCRIPTION',
          location: 'PRIVATE-LOCATION',
          attendees: [{ email: 'private@example.com', name: 'PRIVATE-ATTENDEE' }],
        },
        {
          id: 'event-2',
          startsAt: '2026-05-01T11:00:00.000Z',
          endsAt: '2026-05-01T12:00:00.000Z',
          status: 'cancelled',
          summary: 'CANCELLED-EVENT',
        },
      ],
      connection(),
    );

    expect(windows).toEqual([
      {
        connectionId: 'connection-1',
        provider: 'google',
        startsAt: '2026-05-01T09:00:00.000Z',
        endsAt: '2026-05-01T10:00:00.000Z',
      },
    ]);
    const serialized = JSON.stringify(windows);
    expect(serialized).not.toContain('PRIVATE-EVENT-TITLE');
    expect(serialized).not.toContain('PRIVATE-EVENT-DESCRIPTION');
    expect(serialized).not.toContain('PRIVATE-LOCATION');
    expect(serialized).not.toContain('private@example.com');
    expect(serialized).not.toContain('PRIVATE-ATTENDEE');
  });

  it('normalizes overlapping and unsorted busy windows deterministically', () => {
    expect(
      normalizeBusyWindows([
        { startsAt: '2026-05-01T11:00:00.000Z', endsAt: '2026-05-01T13:00:00.000Z' },
        { startsAt: '2026-05-01T09:00:00.000Z', endsAt: '2026-05-01T10:30:00.000Z' },
        { startsAt: '2026-05-01T10:00:00.000Z', endsAt: '2026-05-01T11:30:00.000Z' },
      ]),
    ).toEqual([
      { startsAt: '2026-05-01T09:00:00.000Z', endsAt: '2026-05-01T13:00:00.000Z' },
    ]);
  });
});

describe('calendar sync', () => {
  const events = [
    {
      startsAt: '2026-05-01T09:00:00.000Z',
      endsAt: '2026-05-01T10:00:00.000Z',
      summary: 'PRIVATE',
    },
    {
      startsAt: '2026-05-01T12:00:00.000Z',
      endsAt: '2026-05-01T13:00:00.000Z',
    },
  ];

  it('stores busy windows, updates the cursor and audits the sync', () => {
    const result = syncExternalCalendar({
      state: stateWith(),
      connectionId: 'connection-1',
      actor: MENTOR,
      idempotencyKey: 'sync-1',
      events,
      cursor: 'cursor-2',
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok || result.degraded) return;
    expect(result.added).toBe(2);
    expect(result.removed).toBe(0);
    expect(result.replayed).toBe(false);
    expect(result.state.connections[0]).toMatchObject({
      lastSyncedAt: NOW.toISOString(),
      syncCursor: 'cursor-2',
    });
    expect(result.state.busyWindows).toHaveLength(2);
    expect(result.state.audit.at(-1)).toMatchObject({ action: 'sync', outcome: 'success' });
  });

  it('replays an idempotency key without duplicating windows or audit entries', () => {
    const first = syncExternalCalendar({
      state: stateWith(),
      connectionId: 'connection-1',
      actor: MENTOR,
      idempotencyKey: 'sync-1',
      events,
      now: NOW,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const replay = syncExternalCalendar({
      state: first.state,
      connectionId: 'connection-1',
      actor: MENTOR,
      idempotencyKey: 'sync-1',
      events,
      now: new Date(NOW.getTime() + 60_000),
    });

    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.replayed).toBe(true);
    expect(replay.state).toBe(first.state);
    expect(replay.state.busyWindows).toHaveLength(2);
    expect(replay.state.audit).toHaveLength(first.state.audit.length);
  });

  it('uses the new snapshot rather than appending stale busy windows', () => {
    const first = syncExternalCalendar({
      state: stateWith(),
      connectionId: 'connection-1',
      actor: MENTOR,
      idempotencyKey: 'sync-1',
      events,
      now: NOW,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = syncExternalCalendar({
      state: first.state,
      connectionId: 'connection-1',
      actor: MENTOR,
      idempotencyKey: 'sync-2',
      events: [events[0]],
      now: new Date(NOW.getTime() + 120_000),
    });
    expect(second.ok).toBe(true);
    if (!second.ok || second.degraded) return;
    expect(second.removed).toBe(2);
    expect(second.added).toBe(1);
    expect(second.state.busyWindows).toHaveLength(1);
  });

  it('degrades gracefully when the provider is unavailable', () => {
    const initial = stateWith({
      busyWindows: [
        {
          connectionId: 'connection-1',
          provider: 'google',
          startsAt: '2026-05-01T09:00:00.000Z',
          endsAt: '2026-05-01T10:00:00.000Z',
        },
      ],
    });

    const result = syncExternalCalendar({
      state: initial,
      connectionId: 'connection-1',
      actor: MENTOR,
      idempotencyKey: 'sync-fail',
      providerError: 'socket hang up',
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.degraded).toBe(true);
    if (!result.degraded) return;
    expect(result.error).toEqual(externalCalendarError('PROVIDER_UNAVAILABLE'));
    expect(result.state.busyWindows).toEqual(initial.busyWindows);
    expect(result.state.connections[0].lastSyncedAt).toBeUndefined();
    expect(result.state.audit.at(-1)).toMatchObject({
      outcome: 'degraded',
      reason: 'PROVIDER_UNAVAILABLE',
    });
  });

  it('denies unauthorized actors and revoked connections with stable codes', () => {
    expect(
      syncExternalCalendar({
        state: stateWith(),
        connectionId: 'connection-1',
        actor: STRANGER,
        idempotencyKey: 'sync-1',
        events,
        now: NOW,
      }),
    ).toEqual({
      ok: false,
      state: expect.objectContaining({
        audit: [expect.objectContaining({ outcome: 'denied', reason: 'NOT_AUTHORIZED' })],
      }),
      error: externalCalendarError('NOT_AUTHORIZED'),
    });

    expect(
      syncExternalCalendar({
        state: stateWith({ connections: [connection({ status: 'revoked' })] }),
        connectionId: 'connection-1',
        actor: MENTOR,
        idempotencyKey: 'sync-1',
        events,
        now: NOW,
      }),
    ).toEqual({
      ok: false,
      state: expect.objectContaining({
        audit: [expect.objectContaining({ outcome: 'denied', reason: 'CONNECTION_REVOKED' })],
      }),
      error: externalCalendarError('CONNECTION_REVOKED'),
    });
  });

  it('rejects a missing idempotency key', () => {
    const result = syncExternalCalendar({
      state: stateWith(),
      connectionId: 'connection-1',
      actor: MENTOR,
      idempotencyKey: '   ',
      events,
      now: NOW,
    });
    expect(result).toEqual({
      ok: false,
      state: stateWith(),
      error: externalCalendarError('INVALID_SYNC'),
    });
  });
});

describe('disconnect', () => {
  it('revokes the connection, clears token material and removes future busy windows', () => {
    const state = stateWith({
      busyWindows: [
        {
          connectionId: 'connection-1',
          provider: 'google',
          startsAt: '2026-05-01T09:00:00.000Z',
          endsAt: '2026-05-01T10:00:00.000Z',
        },
        {
          connectionId: 'connection-1',
          provider: 'google',
          startsAt: '2026-06-01T09:00:00.000Z',
          endsAt: '2026-06-01T10:00:00.000Z',
        },
      ],
    });

    const result = disconnectExternalCalendar({
      state,
      connectionId: 'connection-1',
      actor: MENTOR,
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.connection).toMatchObject({
      status: 'revoked',
      tokenRef: undefined,
      syncCursor: undefined,
      revokedAt: NOW.toISOString(),
    });
    expect(result.state.busyWindows.map((window) => window.startsAt)).toEqual([
      '2026-05-01T09:00:00.000Z',
    ]);
    expect(result.state.audit.at(-1)).toMatchObject({
      action: 'disconnect',
      outcome: 'success',
    });
  });

  it('is idempotent when already revoked', () => {
    const revokedState = stateWith({
      connections: [connection({ status: 'revoked', tokenRef: undefined })],
    });
    const result = disconnectExternalCalendar({
      state: revokedState,
      connectionId: 'connection-1',
      actor: MENTOR,
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.alreadyRevoked).toBe(true);
    expect(result.state).toBe(revokedState);
  });

  it('denies an unauthorized disconnect', () => {
    const result = disconnectExternalCalendar({
      state: stateWith(),
      connectionId: 'connection-1',
      actor: OTHER_TENANT,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_AUTHORIZED');
    expect(result.state.audit.at(-1)).toMatchObject({ outcome: 'denied' });
  });
});

describe('busy windows and availability slots', () => {
  it('subtracts busy windows from bookable slots', () => {
    const slots = [{ startsAt: '2026-05-01T09:00:00.000Z', endsAt: '2026-05-01T17:00:00.000Z' }];
    const busy = [
      {
        connectionId: 'connection-1',
        provider: 'google' as const,
        startsAt: '2026-05-01T10:00:00.000Z',
        endsAt: '2026-05-01T11:00:00.000Z',
      },
      {
        connectionId: 'connection-1',
        provider: 'google' as const,
        startsAt: '2026-05-01T14:00:00.000Z',
        endsAt: '2026-05-01T15:00:00.000Z',
      },
    ];

    expect(subtractBusyWindows(slots, busy)).toEqual([
      { startsAt: '2026-05-01T09:00:00.000Z', endsAt: '2026-05-01T10:00:00.000Z' },
      { startsAt: '2026-05-01T11:00:00.000Z', endsAt: '2026-05-01T14:00:00.000Z' },
      { startsAt: '2026-05-01T15:00:00.000Z', endsAt: '2026-05-01T17:00:00.000Z' },
    ]);
  });
});
