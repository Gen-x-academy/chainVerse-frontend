/** MENTOR-054: revocable external calendar free/busy connections. */

export interface AvailabilitySlot {
  startsAt: string;
  endsAt: string;
}

export type CalendarProvider = 'google' | 'microsoft';
export type CalendarConnectionStatus = 'connected' | 'revoked';
export type CalendarScope = 'calendar.freebusy';

export const CALENDAR_PROVIDERS: readonly CalendarProvider[] = ['google', 'microsoft'];
export const REQUIRED_CALENDAR_SCOPES: readonly CalendarScope[] = ['calendar.freebusy'];
export const TOKEN_HANDLE_PREFIX = 'vault:';

export interface CalendarActor {
  userId: string;
  role: 'mentor' | 'administrator';
  tenantId: string;
}

export interface CalendarConnection {
  id: string;
  mentorId: string;
  tenantId: string;
  provider: CalendarProvider;
  /** Opaque reference to server-side encrypted token material; never a raw token. */
  tokenRef?: string;
  tokenKeyVersion: string;
  scopes: CalendarScope[];
  status: CalendarConnectionStatus;
  connectedAt: string;
  lastSyncedAt?: string;
  syncCursor?: string;
  revokedAt?: string;
}

export interface ProviderCalendarEvent {
  id?: string;
  startsAt: string;
  endsAt: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  summary?: string;
  description?: string;
  location?: string;
  attendees?: { email: string; name?: string }[];
}

export interface CalendarBusyWindow {
  connectionId: string;
  provider: CalendarProvider;
  startsAt: string;
  endsAt: string;
}

export interface CalendarAuditEntry {
  id: string;
  connectionId: string;
  actorId: string;
  action: 'connect' | 'sync' | 'disconnect';
  outcome: 'success' | 'denied' | 'degraded';
  reason?: ExternalCalendarErrorCode;
  occurredAt: string;
}

export interface ExternalCalendarState {
  connections: CalendarConnection[];
  busyWindows: CalendarBusyWindow[];
  processedSyncKeys: string[];
  audit: CalendarAuditEntry[];
}

export type ExternalCalendarErrorCode =
  | 'NOT_AUTHORIZED'
  | 'UNSUPPORTED_PROVIDER'
  | 'INVALID_SCOPE'
  | 'INVALID_TOKEN_HANDLE'
  | 'CONNECTION_NOT_FOUND'
  | 'CONNECTION_REVOKED'
  | 'INVALID_SYNC'
  | 'PROVIDER_UNAVAILABLE';

export interface ExternalCalendarError {
  code: ExternalCalendarErrorCode;
  message: string;
  status: number;
  retryable: boolean;
}

const ERROR_MESSAGES: Record<ExternalCalendarErrorCode, string> = {
  NOT_AUTHORIZED: 'You are not allowed to manage this calendar connection.',
  UNSUPPORTED_PROVIDER: 'Choose a supported calendar provider.',
  INVALID_SCOPE: 'Calendar connections may only request free/busy access.',
  INVALID_TOKEN_HANDLE: 'The encrypted calendar token reference is not valid.',
  CONNECTION_NOT_FOUND: 'This calendar connection does not exist.',
  CONNECTION_REVOKED: 'Reconnect the calendar before syncing availability.',
  INVALID_SYNC: 'The calendar sync request is invalid.',
  PROVIDER_UNAVAILABLE: 'The calendar provider is unavailable. Existing busy windows are unchanged.',
};

const ERROR_STATUS: Record<ExternalCalendarErrorCode, number> = {
  NOT_AUTHORIZED: 403,
  UNSUPPORTED_PROVIDER: 422,
  INVALID_SCOPE: 422,
  INVALID_TOKEN_HANDLE: 422,
  CONNECTION_NOT_FOUND: 404,
  CONNECTION_REVOKED: 409,
  INVALID_SYNC: 422,
  PROVIDER_UNAVAILABLE: 503,
};

export function externalCalendarError(code: ExternalCalendarErrorCode): ExternalCalendarError {
  return {
    code,
    message: ERROR_MESSAGES[code],
    status: ERROR_STATUS[code],
    retryable: code === 'PROVIDER_UNAVAILABLE',
  };
}

export function createExternalCalendarState(): ExternalCalendarState {
  return { connections: [], busyWindows: [], processedSyncKeys: [], audit: [] };
}

export function isOpaqueTokenRef(value: string): boolean {
  return (
    value.startsWith(TOKEN_HANDLE_PREFIX) &&
    value.length > TOKEN_HANDLE_PREFIX.length &&
    value.length <= 512 &&
    !/\s/.test(value)
  );
}

export function canManageCalendarConnection(
  connection: CalendarConnection,
  actor: CalendarActor,
): boolean {
  if (connection.tenantId !== actor.tenantId) return false;
  if (actor.role === 'administrator') return true;
  return actor.role === 'mentor' && actor.userId === connection.mentorId;
}

function nextAuditId(state: ExternalCalendarState): string {
  return `cal-audit-${state.audit.length + 1}`;
}

function audit(
  state: ExternalCalendarState,
  input: {
    connectionId: string;
    actorId: string;
    action: CalendarAuditEntry['action'];
    outcome: CalendarAuditEntry['outcome'];
    now: Date;
    reason?: ExternalCalendarErrorCode;
  },
): ExternalCalendarState {
  const entry: CalendarAuditEntry = {
    id: nextAuditId(state),
    connectionId: input.connectionId,
    actorId: input.actorId,
    action: input.action,
    outcome: input.outcome,
    reason: input.reason,
    occurredAt: input.now.toISOString(),
  };
  return { ...state, audit: [...state.audit, entry] };
}

export interface CreateCalendarConnectionInput {
  id: string;
  mentorId: string;
  tenantId: string;
  provider: CalendarProvider;
  tokenRef: string;
  tokenKeyVersion: string;
  scopes: readonly string[];
  actor: CalendarActor;
  now?: Date;
}

export type CalendarConnectResult =
  | { ok: true; connection: CalendarConnection }
  | { ok: false; error: ExternalCalendarError };

export function createCalendarConnection(
  input: CreateCalendarConnectionInput,
): CalendarConnectResult {
  const actorAllowed =
    input.actor.tenantId === input.tenantId &&
    (input.actor.role === 'administrator' ||
      (input.actor.role === 'mentor' && input.actor.userId === input.mentorId));
  if (!actorAllowed) return { ok: false, error: externalCalendarError('NOT_AUTHORIZED') };

  if (!CALENDAR_PROVIDERS.includes(input.provider)) {
    return { ok: false, error: externalCalendarError('UNSUPPORTED_PROVIDER') };
  }

  const allowedScopes = new Set<string>(REQUIRED_CALENDAR_SCOPES);
  if (
    input.scopes.length === 0 ||
    input.scopes.some((scope) => !allowedScopes.has(scope)) ||
    !REQUIRED_CALENDAR_SCOPES.every((scope) => input.scopes.includes(scope))
  ) {
    return { ok: false, error: externalCalendarError('INVALID_SCOPE') };
  }

  if (!isOpaqueTokenRef(input.tokenRef)) {
    return { ok: false, error: externalCalendarError('INVALID_TOKEN_HANDLE') };
  }

  return {
    ok: true,
    connection: {
      id: input.id,
      mentorId: input.mentorId,
      tenantId: input.tenantId,
      provider: input.provider,
      tokenRef: input.tokenRef,
      tokenKeyVersion: input.tokenKeyVersion,
      scopes: [...REQUIRED_CALENDAR_SCOPES],
      status: 'connected',
      connectedAt: (input.now ?? new Date()).toISOString(),
    },
  };
}

export function normalizeBusyWindows(
  windows: readonly { startsAt: string; endsAt: string }[],
): { startsAt: string; endsAt: string }[] {
  const valid = windows
    .map((window) => ({ start: Date.parse(window.startsAt), end: Date.parse(window.endsAt) }))
    .filter((window) => Number.isFinite(window.start) && Number.isFinite(window.end) && window.start < window.end)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: { start: number; end: number }[] = [];
  for (const window of valid) {
    const previous = merged[merged.length - 1];
    if (previous && window.start <= previous.end) {
      previous.end = Math.max(previous.end, window.end);
    } else {
      merged.push({ ...window });
    }
  }

  return merged.map((window) => ({
    startsAt: new Date(window.start).toISOString(),
    endsAt: new Date(window.end).toISOString(),
  }));
}

export function toBusyWindows(
  events: readonly ProviderCalendarEvent[],
  connection: Pick<CalendarConnection, 'id' | 'provider'>,
): CalendarBusyWindow[] {
  const freeBusy = events
    .filter((event) => event.status !== 'cancelled')
    .map((event) => ({ startsAt: event.startsAt, endsAt: event.endsAt }));

  return normalizeBusyWindows(freeBusy).map((window) => ({
    connectionId: connection.id,
    provider: connection.provider,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
  }));
}

export interface SyncExternalCalendarInput {
  state: ExternalCalendarState;
  connectionId: string;
  actor: CalendarActor;
  idempotencyKey: string;
  events?: readonly ProviderCalendarEvent[];
  providerError?: string;
  cursor?: string;
  now?: Date;
}

export type CalendarSyncResult =
  | {
      ok: true;
      state: ExternalCalendarState;
      added: number;
      removed: number;
      replayed: boolean;
      degraded: false;
    }
  | {
      ok: true;
      state: ExternalCalendarState;
      added: 0;
      removed: 0;
      replayed: false;
      degraded: true;
      error: ExternalCalendarError;
    }
  | { ok: false; state: ExternalCalendarState; error: ExternalCalendarError };

export function syncExternalCalendar(input: SyncExternalCalendarInput): CalendarSyncResult {
  const now = input.now ?? new Date();
  const connection = input.state.connections.find(
    (candidate) => candidate.id === input.connectionId,
  );

  if (!connection) {
    return { ok: false, state: input.state, error: externalCalendarError('CONNECTION_NOT_FOUND') };
  }
  if (!canManageCalendarConnection(connection, input.actor)) {
    return {
      ok: false,
      state: audit(input.state, {
        connectionId: connection.id,
        actorId: input.actor.userId,
        action: 'sync',
        outcome: 'denied',
        reason: 'NOT_AUTHORIZED',
        now,
      }),
      error: externalCalendarError('NOT_AUTHORIZED'),
    };
  }
  if (connection.status === 'revoked') {
    return {
      ok: false,
      state: audit(input.state, {
        connectionId: connection.id,
        actorId: input.actor.userId,
        action: 'sync',
        outcome: 'denied',
        reason: 'CONNECTION_REVOKED',
        now,
      }),
      error: externalCalendarError('CONNECTION_REVOKED'),
    };
  }
  if (!input.idempotencyKey.trim()) {
    return { ok: false, state: input.state, error: externalCalendarError('INVALID_SYNC') };
  }

  if (input.state.processedSyncKeys.includes(input.idempotencyKey)) {
    return {
      ok: true,
      state: input.state,
      added: 0,
      removed: 0,
      replayed: true,
      degraded: false,
    };
  }

  if (input.providerError) {
    return {
      ok: true,
      state: audit(input.state, {
        connectionId: connection.id,
        actorId: input.actor.userId,
        action: 'sync',
        outcome: 'degraded',
        reason: 'PROVIDER_UNAVAILABLE',
        now,
      }),
      added: 0,
      removed: 0,
      replayed: false,
      degraded: true,
      error: externalCalendarError('PROVIDER_UNAVAILABLE'),
    };
  }

  const previous = input.state.busyWindows.filter(
    (window) => window.connectionId === connection.id,
  );
  const nextWindows = toBusyWindows(input.events ?? [], connection);
  const nextConnection: CalendarConnection = {
    ...connection,
    lastSyncedAt: now.toISOString(),
    syncCursor: input.cursor,
  };

  const state: ExternalCalendarState = {
    connections: input.state.connections.map((candidate) =>
      candidate.id === connection.id ? nextConnection : candidate,
    ),
    busyWindows: [
      ...input.state.busyWindows.filter((window) => window.connectionId !== connection.id),
      ...nextWindows,
    ],
    processedSyncKeys: [...input.state.processedSyncKeys, input.idempotencyKey],
    audit: [
      ...input.state.audit,
      {
        id: nextAuditId(input.state),
        connectionId: connection.id,
        actorId: input.actor.userId,
        action: 'sync',
        outcome: 'success',
        occurredAt: now.toISOString(),
      },
    ],
  };

  return {
    ok: true,
    state,
    added: nextWindows.length,
    removed: previous.length,
    replayed: false,
    degraded: false,
  };
}

export interface DisconnectExternalCalendarInput {
  state: ExternalCalendarState;
  connectionId: string;
  actor: CalendarActor;
  now?: Date;
}

export type CalendarDisconnectResult =
  | {
      ok: true;
      state: ExternalCalendarState;
      connection: CalendarConnection;
      alreadyRevoked: boolean;
    }
  | { ok: false; state: ExternalCalendarState; error: ExternalCalendarError };

export function disconnectExternalCalendar(
  input: DisconnectExternalCalendarInput,
): CalendarDisconnectResult {
  const now = input.now ?? new Date();
  const connection = input.state.connections.find(
    (candidate) => candidate.id === input.connectionId,
  );

  if (!connection) {
    return { ok: false, state: input.state, error: externalCalendarError('CONNECTION_NOT_FOUND') };
  }
  if (!canManageCalendarConnection(connection, input.actor)) {
    return {
      ok: false,
      state: audit(input.state, {
        connectionId: connection.id,
        actorId: input.actor.userId,
        action: 'disconnect',
        outcome: 'denied',
        reason: 'NOT_AUTHORIZED',
        now,
      }),
      error: externalCalendarError('NOT_AUTHORIZED'),
    };
  }

  if (connection.status === 'revoked') {
    return { ok: true, state: input.state, connection, alreadyRevoked: true };
  }

  const revoked: CalendarConnection = {
    ...connection,
    status: 'revoked',
    tokenRef: undefined,
    syncCursor: undefined,
    revokedAt: now.toISOString(),
  };
  const nowMs = now.getTime();

  const state: ExternalCalendarState = {
    ...input.state,
    connections: input.state.connections.map((candidate) =>
      candidate.id === connection.id ? revoked : candidate,
    ),
    busyWindows: input.state.busyWindows.filter(
      (window) => window.connectionId !== connection.id || Date.parse(window.endsAt) <= nowMs,
    ),
    audit: [
      ...input.state.audit,
      {
        id: nextAuditId(input.state),
        connectionId: connection.id,
        actorId: input.actor.userId,
        action: 'disconnect',
        outcome: 'success',
        occurredAt: now.toISOString(),
      },
    ],
  };

  return { ok: true, state, connection: revoked, alreadyRevoked: false };
}

export function subtractBusyWindows(
  slots: readonly AvailabilitySlot[],
  busyWindows: readonly CalendarBusyWindow[],
): AvailabilitySlot[] {
  let result = slots.map((slot) => ({
    start: Date.parse(slot.startsAt),
    end: Date.parse(slot.endsAt),
  }));

  for (const busy of normalizeBusyWindows(busyWindows)) {
    const busyStart = Date.parse(busy.startsAt);
    const busyEnd = Date.parse(busy.endsAt);
    const next: { start: number; end: number }[] = [];
    for (const slot of result) {
      if (busyEnd <= slot.start || busyStart >= slot.end) {
        next.push(slot);
        continue;
      }
      if (slot.start < busyStart) next.push({ start: slot.start, end: busyStart });
      if (slot.end > busyEnd) next.push({ start: busyEnd, end: slot.end });
    }
    result = next;
  }

  return result
    .filter((slot) => Number.isFinite(slot.start) && Number.isFinite(slot.end) && slot.start < slot.end)
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map((slot) => ({
      startsAt: new Date(slot.start).toISOString(),
      endsAt: new Date(slot.end).toISOString(),
    }));
}
