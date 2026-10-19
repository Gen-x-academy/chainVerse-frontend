/**
 * MENTOR-064: private participant notes.
 *
 * Notes are owner-only. There is no role, counterpart, reviewer, staff or
 * public-profile read path: every decision is deny-by-default and compares the
 * viewer to the note owner. Callers still rely on the API as the authority;
 * these checks give a consistent denied state and keep exports, search and
 * logs from becoming side channels.
 */

export const NOTE_BODY_MAX_LENGTH = 5000;
export const NOTE_SEARCH_MIN_LENGTH = 2;

export type PrivateNoteErrorCode =
  | 'NOT_AUTHORIZED'
  | 'INVALID_NOTE'
  | 'INVALID_SEARCH'
  | 'NOT_FOUND'
  | 'VERSION_CONFLICT'
  | 'DELETION_BLOCKED';

/** Stable, actionable messages; never include note text. */
export const PRIVATE_NOTE_ERROR_MESSAGES: Record<PrivateNoteErrorCode, string> = {
  NOT_AUTHORIZED: 'Private notes are only available to the person who wrote them.',
  INVALID_NOTE: `Write a note between 1 and ${NOTE_BODY_MAX_LENGTH} characters.`,
  INVALID_SEARCH: `Enter at least ${NOTE_SEARCH_MIN_LENGTH} characters to search your notes.`,
  NOT_FOUND: 'This note no longer exists. Refresh your notes and try again.',
  VERSION_CONFLICT: 'This note changed elsewhere. Reload it before saving again.',
  DELETION_BLOCKED: 'This note is under a retention hold and cannot be deleted yet.',
};

export class PrivateNoteError extends Error {
  readonly code: PrivateNoteErrorCode;

  constructor(code: PrivateNoteErrorCode) {
    super(PRIVATE_NOTE_ERROR_MESSAGES[code]);
    this.name = 'PrivateNoteError';
    this.code = code;
  }
}

export interface PrivateNote {
  id: string;
  engagementId: string;
  ownerId: string;
  body: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  /** Set once deleted; deleted notes are never listed, searched or exported. */
  deletedAt?: string;
  /** Retention/legal hold from deletion policy; blocks deletion. */
  retentionHold?: boolean;
}

export interface NoteViewer {
  userId: string | null | undefined;
}

export function isNoteOwner(viewer: NoteViewer, note: Pick<PrivateNote, 'ownerId'>): boolean {
  return Boolean(viewer.userId) && viewer.userId === note.ownerId;
}

function activeOwnedNotes(viewer: NoteViewer, notes: readonly PrivateNote[]): PrivateNote[] {
  return notes
    .filter((note) => !note.deletedAt && isNoteOwner(viewer, note))
    .sort((a, b) =>
      a.updatedAt === b.updatedAt
        ? a.id.localeCompare(b.id)
        : b.updatedAt.localeCompare(a.updatedAt),
    );
}

/** Notes the viewer may see: their own, not deleted, newest first. */
export function listOwnNotes(viewer: NoteViewer, notes: readonly PrivateNote[]): PrivateNote[] {
  return activeOwnedNotes(viewer, notes);
}

/** Validates and normalises note text. Throws `INVALID_NOTE`. */
export function validateNoteBody(body: unknown): string {
  if (typeof body !== 'string') throw new PrivateNoteError('INVALID_NOTE');
  const trimmed = body.trim();
  if (trimmed.length === 0 || trimmed.length > NOTE_BODY_MAX_LENGTH) {
    throw new PrivateNoteError('INVALID_NOTE');
  }
  return trimmed;
}

export interface NoteSearchHit {
  id: string;
}

/**
 * Searches the viewer's own notes. Hits carry only the note id: no snippet,
 * highlight, offset or match count, so a search surface can never echo note
 * text. Non-owners always get an empty result.
 */
export function searchOwnNotes(
  viewer: NoteViewer,
  notes: readonly PrivateNote[],
  query: string,
): NoteSearchHit[] {
  const needle = query.trim().toLocaleLowerCase();
  if (needle.length < NOTE_SEARCH_MIN_LENGTH) throw new PrivateNoteError('INVALID_SEARCH');
  return activeOwnedNotes(viewer, notes)
    .filter((note) => note.body.toLocaleLowerCase().includes(needle))
    .map((note) => ({ id: note.id }));
}

export interface PrivateNoteExportBundle {
  kind: 'private-notes-export';
  requesterId: string;
  exportedAt: string;
  notes: Array<Pick<PrivateNote, 'id' | 'engagementId' | 'body' | 'createdAt' | 'updatedAt'>>;
}

/**
 * Builds an export containing only the requester's own, non-deleted notes.
 * Throws `NOT_AUTHORIZED` for an anonymous requester.
 */
export function buildNotesExport(
  requester: NoteViewer,
  notes: readonly PrivateNote[],
  exportedAt: Date = new Date(),
): PrivateNoteExportBundle {
  if (!requester.userId) throw new PrivateNoteError('NOT_AUTHORIZED');
  return {
    kind: 'private-notes-export',
    requesterId: requester.userId,
    exportedAt: exportedAt.toISOString(),
    notes: activeOwnedNotes(requester, notes).map(
      ({ id, engagementId, body, createdAt, updatedAt }) => ({
        id,
        engagementId,
        body,
        createdAt,
        updatedAt,
      }),
    ),
  };
}

export type DeletionDecision = 'delete' | 'already-deleted';

/**
 * Applies the deletion policy. Non-owners are denied, held notes are blocked,
 * and an already-deleted note is a no-op so retries have no extra effect.
 */
export function evaluateNoteDeletion(viewer: NoteViewer, note: PrivateNote): DeletionDecision {
  if (!isNoteOwner(viewer, note)) throw new PrivateNoteError('NOT_AUTHORIZED');
  if (note.deletedAt) return 'already-deleted';
  if (note.retentionHold) throw new PrivateNoteError('DELETION_BLOCKED');
  return 'delete';
}

/** Log-safe view of a note: identifiers and size only, never text. */
export function redactNoteForLog(note: PrivateNote): {
  id: string;
  engagementId: string;
  version: number;
  bodyLength: number;
} {
  return {
    id: note.id,
    engagementId: note.engagementId,
    version: note.version,
    bodyLength: note.body.length,
  };
}

/** Maps any thrown value to a stable code + message without leaking its text. */
export function toPrivateNoteError(error: unknown): PrivateNoteError {
  if (error instanceof PrivateNoteError) return error;
  const status = (error as { status?: number } | null)?.status;
  if (status === 401 || status === 403) return new PrivateNoteError('NOT_AUTHORIZED');
  if (status === 404) return new PrivateNoteError('NOT_FOUND');
  if (status === 409) return new PrivateNoteError('VERSION_CONFLICT');
  if (status === 400 || status === 422) return new PrivateNoteError('INVALID_NOTE');
  return new PrivateNoteError('NOT_AUTHORIZED');
}
