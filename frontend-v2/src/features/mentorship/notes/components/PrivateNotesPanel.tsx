'use client';

import { useId, useMemo, useRef, useState } from 'react';
import {
  NOTE_BODY_MAX_LENGTH,
  PrivateNoteError,
  listOwnNotes,
  searchOwnNotes,
  toPrivateNoteError,
  validateNoteBody,
  type NoteViewer,
  type PrivateNote,
} from '../private-notes';

export interface PrivateNotesPanelProps {
  viewer: NoteViewer;
  notes: readonly PrivateNote[];
  loading?: boolean;
  error?: string | null;
  /** `idempotencyKey` stays stable across retries of the same draft. */
  onCreate?: (body: string, idempotencyKey: string) => Promise<void> | void;
  onUpdate?: (note: PrivateNote, body: string) => Promise<void> | void;
  onDelete?: (note: PrivateNote) => Promise<void> | void;
}

let keyCounter = 0;
function newIdempotencyKey(): string {
  keyCounter += 1;
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `note-draft-${keyCounter}`;
}

export function PrivateNotesPanel({
  viewer,
  notes,
  loading = false,
  error,
  onCreate,
  onUpdate,
  onDelete,
}: PrivateNotesPanelProps) {
  const baseId = useId();
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const draftKey = useRef<string>(newIdempotencyKey());

  const own = useMemo(() => listOwnNotes(viewer, notes), [viewer, notes]);
  const denied = !viewer.userId;

  const { visible, searchError } = useMemo(() => {
    if (query.trim().length === 0) return { visible: own, searchError: null };
    try {
      const ids = new Set(searchOwnNotes(viewer, own, query).map((hit) => hit.id));
      return { visible: own.filter((note) => ids.has(note.id)), searchError: null };
    } catch (caught) {
      return { visible: own, searchError: toPrivateNoteError(caught).message };
    }
  }, [own, query, viewer]);

  const run = async (key: string, success: string, action: () => Promise<void> | void) => {
    setPending(key);
    setLocalError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      return true;
    } catch (caught) {
      setLocalError(toPrivateNoteError(caught).message);
      return false;
    } finally {
      setPending(null);
    }
  };

  const submitCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    let body: string;
    try {
      body = validateNoteBody(draft);
    } catch (caught) {
      setLocalError((caught as PrivateNoteError).message);
      return;
    }
    const ok = await run('create', 'Note saved.', () => onCreate?.(body, draftKey.current));
    if (ok) {
      setDraft('');
      draftKey.current = newIdempotencyKey();
    }
  };

  const submitEdit = async (note: PrivateNote) => {
    let body: string;
    try {
      body = validateNoteBody(editText);
    } catch (caught) {
      setLocalError((caught as PrivateNoteError).message);
      return;
    }
    const ok = await run(note.id, 'Note updated.', () => onUpdate?.(note, body));
    if (ok) setEditingId(null);
  };

  const confirmDelete = async (note: PrivateNote) => {
    const ok = await run(note.id, 'Note deleted.', () => onDelete?.(note));
    if (ok) setConfirmId(null);
  };

  const shownError = localError ?? error;

  return (
    <section
      aria-labelledby={`${baseId}-title`}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <h2 id={`${baseId}-title`} className="text-lg font-semibold text-slate-900">
        My private notes
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Only you can see these notes. They are never shown to your mentor, mentee, reviewers or
        your public profile.
      </p>

      {denied ? (
        <p role="alert" className="mt-4 text-sm text-red-700">
          Sign in to view your private notes.
        </p>
      ) : (
        <>
          <form onSubmit={submitCreate} className="mt-4 space-y-2">
            <label htmlFor={`${baseId}-new`} className="block text-sm font-medium text-slate-800">
              New note
            </label>
            <textarea
              id={`${baseId}-new`}
              value={draft}
              maxLength={NOTE_BODY_MAX_LENGTH}
              rows={3}
              aria-describedby={`${baseId}-count`}
              onChange={(event) => setDraft(event.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-base"
            />
            <div className="flex items-center justify-between gap-3">
              <span id={`${baseId}-count`} className="text-xs text-slate-600">
                {draft.length} / {NOTE_BODY_MAX_LENGTH}
              </span>
              <button
                type="submit"
                disabled={pending !== null}
                className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pending === 'create' ? 'Saving…' : 'Save note'}
              </button>
            </div>
          </form>

          <div className="mt-5">
            <label htmlFor={`${baseId}-search`} className="block text-sm font-medium text-slate-800">
              Search my notes
            </label>
            <input
              id={`${baseId}-search`}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-base"
            />
            {searchError && <p className="mt-1 text-xs text-slate-600">{searchError}</p>}
          </div>

          <div className="mt-5" aria-live="polite">
            {loading ? (
              <p role="status" className="text-sm text-slate-600">
                Loading your notes…
              </p>
            ) : visible.length === 0 ? (
              <p role="status" className="text-sm text-slate-600">
                {query.trim() ? 'No notes match your search.' : 'You have no private notes yet.'}
              </p>
            ) : (
              <ul aria-label="My private notes" className="space-y-3">
                {visible.map((note) => (
                  <li key={note.id} className="rounded-xl border border-slate-200 p-4">
                    {editingId === note.id ? (
                      <div className="space-y-2">
                        <label
                          htmlFor={`${baseId}-edit-${note.id}`}
                          className="block text-sm font-medium text-slate-800"
                        >
                          Edit note
                        </label>
                        <textarea
                          id={`${baseId}-edit-${note.id}`}
                          value={editText}
                          rows={3}
                          maxLength={NOTE_BODY_MAX_LENGTH}
                          autoFocus
                          onChange={(event) => setEditText(event.target.value)}
                          className="w-full rounded-lg border border-slate-300 p-2 text-base"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={pending !== null}
                            onClick={() => void submitEdit(note)}
                            className="min-h-11 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                          >
                            {pending === note.id ? 'Saving…' : 'Save changes'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap break-words text-slate-900">{note.body}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          Updated <time dateTime={note.updatedAt}>{note.updatedAt.slice(0, 10)}</time>
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={pending !== null}
                            onClick={() => {
                              setEditingId(note.id);
                              setEditText(note.body);
                              setConfirmId(null);
                            }}
                            aria-label={`Edit note: ${note.body.slice(0, 30)}`}
                            className="min-h-11 rounded-lg border border-indigo-600 px-3 py-2 text-sm font-semibold text-indigo-700 disabled:opacity-60"
                          >
                            Edit
                          </button>
                          {confirmId === note.id ? (
                            <>
                              <button
                                type="button"
                                disabled={pending !== null}
                                onClick={() => void confirmDelete(note)}
                                className="min-h-11 rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                              >
                                {pending === note.id ? 'Deleting…' : 'Confirm delete'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmId(null)}
                                className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              >
                                Keep note
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              disabled={pending !== null}
                              onClick={() => setConfirmId(note.id)}
                              aria-label={`Delete note: ${note.body.slice(0, 30)}`}
                              className="min-h-11 rounded-lg border border-red-700 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {message && (
        <p role="status" className="mt-3 text-sm text-green-800">
          {message}
        </p>
      )}
      {shownError && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {shownError}
        </p>
      )}
    </section>
  );
}

export default PrivateNotesPanel;
