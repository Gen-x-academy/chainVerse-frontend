import { apiClient } from '@/src/lib/api-client';
import { buildMentorshipEvent, trackMentorshipEvent } from '../analytics';
import type { PrivateNote, PrivateNoteExportBundle } from './private-notes';

const BASE = '/mentorship/engagements';

export interface SaveNoteInput {
  body: string;
  /** Required for create; the same key on retry returns the same note. */
  idempotencyKey?: string;
  /** Required for update; mismatches return a version conflict. */
  expectedVersion?: number;
}

export const privateNoteService = {
  list: (engagementId: string): Promise<PrivateNote[]> =>
    apiClient.get<PrivateNote[]>(`${BASE}/${encodeURIComponent(engagementId)}/notes`),

  create: (engagementId: string, input: SaveNoteInput): Promise<PrivateNote> =>
    apiClient.post<PrivateNote>(`${BASE}/${encodeURIComponent(engagementId)}/notes`, input),

  update: (engagementId: string, noteId: string, input: SaveNoteInput): Promise<PrivateNote> =>
    apiClient.put<PrivateNote>(
      `${BASE}/${encodeURIComponent(engagementId)}/notes/${encodeURIComponent(noteId)}`,
      input,
    ),

  /** Idempotent: deleting an already-deleted note succeeds. */
  remove: (engagementId: string, noteId: string): Promise<void> =>
    apiClient.delete<void>(
      `${BASE}/${encodeURIComponent(engagementId)}/notes/${encodeURIComponent(noteId)}`,
    ),

  export: (): Promise<PrivateNoteExportBundle> =>
    apiClient.get<PrivateNoteExportBundle>('/mentorship/notes/export'),
};

export type PrivateNoteAction = 'created' | 'updated' | 'deleted' | 'exported' | 'searched';

/** Events carry the action and note id only, never note text. */
export function trackPrivateNoteEvent(
  action: PrivateNoteAction,
  entityId: string,
  actorKey: string,
  occurredAt: Date = new Date(),
): void {
  trackMentorshipEvent(
    buildMentorshipEvent('private_note', `${entityId}:${action}`, actorKey, occurredAt),
  );
}
