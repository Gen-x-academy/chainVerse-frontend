import { apiClient } from '@/src/lib/api-client';
import { buildMentorshipEvent, trackMentorshipEvent } from '../analytics';
import type { Agenda, AgendaCommandEnvelope, AgendaExport } from './agenda';

const BASE = '/mentorship/sessions';

export const agendaService = {
  get: (sessionId: string): Promise<Agenda> =>
    apiClient.get<Agenda>(`${BASE}/${encodeURIComponent(sessionId)}/agenda`),

  /**
   * Applies one command. The same `commandId` on retry is a no-op; a stale
   * `baseVersion` returns 409 and the caller should reload.
   */
  apply: (sessionId: string, envelope: AgendaCommandEnvelope): Promise<Agenda> =>
    apiClient.post<Agenda>(`${BASE}/${encodeURIComponent(sessionId)}/agenda/commands`, envelope),

  export: (sessionId: string): Promise<AgendaExport> =>
    apiClient.get<AgendaExport>(`${BASE}/${encodeURIComponent(sessionId)}/agenda/export`),
};

export type AgendaAnalyticsAction = AgendaCommandEnvelope['command']['type'] | 'exported';

/** Events carry the action and ids only; never agenda text. */
export function trackAgendaEvent(
  action: AgendaAnalyticsAction,
  sessionId: string,
  actorKey: string,
  occurredAt: Date = new Date(),
): void {
  trackMentorshipEvent(
    buildMentorshipEvent('session_agenda', `${sessionId}:${action}`, actorKey, occurredAt),
  );
}
