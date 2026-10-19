import { apiClient } from '@/src/lib/api-client';
import { buildMentorshipEvent, trackMentorshipEvent } from '../analytics';
import type { SessionWorkspaceData, WorkspaceCommandEnvelope } from './workspace';

const BASE = '/mentorship/sessions';

export const workspaceService = {
  get: (sessionId: string): Promise<SessionWorkspaceData> =>
    apiClient.get<SessionWorkspaceData>(`${BASE}/${encodeURIComponent(sessionId)}/workspace`),

  /** The same `commandId` on retry is a no-op; a stale version returns 409. */
  apply: (sessionId: string, envelope: WorkspaceCommandEnvelope): Promise<SessionWorkspaceData> =>
    apiClient.post<SessionWorkspaceData>(
      `${BASE}/${encodeURIComponent(sessionId)}/workspace/commands`,
      envelope,
    ),
};

export type WorkspaceAnalyticsAction =
  | 'opened'
  | 'follow_up_added'
  | 'follow_up_toggled'
  | 'section_viewed';

/** Events carry the action and session id only; never workspace content. */
export function trackWorkspaceEvent(
  action: WorkspaceAnalyticsAction,
  sessionId: string,
  actorKey: string,
  occurredAt: Date = new Date(),
): void {
  trackMentorshipEvent(
    buildMentorshipEvent('session_workspace', `${sessionId}:${action}`, actorKey, occurredAt),
  );
}
