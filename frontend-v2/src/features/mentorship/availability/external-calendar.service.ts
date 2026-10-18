import { apiClient } from '@/src/lib/api-client';
import { buildMentorshipEvent, trackMentorshipEvent } from '../analytics';
import type {
  CalendarBusyWindow,
  CalendarConnection,
  CalendarProvider,
} from './external-calendar';

const BASE = '/mentorship/availability/calendar';

export interface ConnectExternalCalendarRequest {
  provider: CalendarProvider;
  authorizationCode: string;
  redirectUri: string;
}

export interface SyncExternalCalendarRequest {
  idempotencyKey: string;
  cursor?: string;
  from: string;
  to: string;
}

export interface SyncExternalCalendarResponse {
  connection: CalendarConnection;
  busyWindows: CalendarBusyWindow[];
  cursor?: string;
}

export const externalCalendarService = {
  listConnections: (mentorId: string): Promise<CalendarConnection[]> =>
    apiClient.get<CalendarConnection[]>(
      `${BASE}/connections?mentorId=${encodeURIComponent(mentorId)}`,
    ),

  connect: (
    mentorId: string,
    input: ConnectExternalCalendarRequest,
  ): Promise<CalendarConnection> =>
    apiClient.post<CalendarConnection>(`${BASE}/connections`, {
      mentorId,
      ...input,
    }),

  sync: (
    connectionId: string,
    input: SyncExternalCalendarRequest,
  ): Promise<SyncExternalCalendarResponse> =>
    apiClient.post<SyncExternalCalendarResponse>(
      `${BASE}/connections/${encodeURIComponent(connectionId)}/sync`,
      input,
    ),

  disconnect: (connectionId: string): Promise<void> =>
    apiClient.delete<void>(
      `${BASE}/connections/${encodeURIComponent(connectionId)}`,
    ),
};

export function trackExternalCalendarSynced(
  connection: CalendarConnection,
  actorKey: string,
  occurredAt: Date = new Date(),
): void {
  trackMentorshipEvent(
    buildMentorshipEvent(
      'calendar_sync',
      connection.id,
      actorKey,
      occurredAt,
    ),
  );
}
