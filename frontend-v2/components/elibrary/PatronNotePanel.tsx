"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FormWrapper } from "@/components/ui/form-wrapper";

export type PatronNote = {
  id: string;
  body: string;
  visibility: "staff-only" | "sensitive";
  category: string;
  createdBy: string;
  createdAt: string;
  version: number;
};

export type PrivateNote = {
  id: string;
  body: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type NotesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "ready"; notes: PrivateNote[] }
  | { status: "conflict"; message: string; latestVersion: number };

type SaveResult =
  | { ok: true; note: PrivateNote }
  | { ok: false; kind: "conflict"; latestVersion: number; message: string }
  | { ok: false; kind: "error"; message: string };

// Privacy-safe analytics: never include note body, category, or identifiers.
function track(event: string, props: Record<string, string | number | boolean> = {}) {
  if (typeof window === "undefined") return;
  const sink = (window as unknown as { __analytics?: (e: string, p: Record<string, unknown>) => void }).__analytics;
  if (typeof sink === "function") sink(event, props);
}

// Staff-only note panel. Notes are never shown in patron-facing views.
export default function PatronNotePanel({
  notes,
  canViewSensitive,
  onAdd,
}: {
  notes: PatronNote[];
  canViewSensitive: boolean;
  onAdd: (body: string, category: string) => void;
}) {
  const [body, setBody] = useState("");
  const visible = notes.filter((n) => n.visibility !== "sensitive" || canViewSensitive);

  return (
    <div className="border rounded p-4 space-y-3">
      <h3 className="font-semibold">Patron Notes (Staff Only)</h3>
      {visible.length === 0 && <p className="text-sm text-gray-500">No notes yet.</p>}
      <ul className="space-y-2">
        {visible.map((n) => (
          <li key={n.id} className="text-sm border-b pb-1">
            <span className="font-medium">[{n.category}]</span> {n.body}
            <div className="text-xs text-gray-400">{n.createdBy} &middot; {n.createdAt}</div>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note" className="border p-1 rounded flex-1" />
        <button
          onClick={() => { if (body.trim()) { onAdd(body, "general"); setBody(""); } }}
          className="px-3 py-1 border rounded bg-blue-500 text-white"
        >
          Add
        </button>
      </div>
    </div>
  );
}

/**
 * Owner-only private researcher notes editor.
 *
 * Access is deny-by-default: when `isOwner` is false the component renders a
 * non-disclosing denial message and never fetches or displays note content.
 * Note bodies are excluded from analytics and logs; only coarse event names
 * and non-sensitive counters are emitted.
 */
export function PrivateResearcherNotes({
  projectId,
  isOwner,
  loadNotes,
  saveNote,
  deleteNote,
}: {
  projectId: string;
  isOwner: boolean;
  loadNotes: (projectId: string) => Promise<PrivateNote[]>;
  saveNote: (input: {
    projectId: string;
    noteId?: string;
    body: string;
    category: string;
    version?: number;
  }) => Promise<SaveResult>;
  deleteNote?: (input: { projectId: string; noteId: string; version: number }) => Promise<SaveResult>;
}) {
  const [state, setState] = useState<NotesState>({ status: "loading" });
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingVersion, setEditingVersion] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const bodyId = useId();
  const categoryId = useId();
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    if (!isOwner) return;
    setState({ status: "loading" });
    try {
      const notes = await loadNotes(projectId);
      setState(notes.length === 0 ? { status: "empty" } : { status: "ready", notes });
    } catch {
      setState({ status: "error", message: "Unable to load your private notes. Please retry." });
      track("private_notes_load_error", { projectId });
    }
  }, [isOwner, loadNotes, projectId]);

  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    setState({ status: "loading" });
    loadNotes(projectId)
      .then((notes) => {
        if (cancelled) return;
        setState(notes.length === 0 ? { status: "empty" } : { status: "ready", notes });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ status: "error", message: "Unable to load your private notes. Please retry." });
        track("private_notes_load_error", { projectId });
      });
    return () => {
      cancelled = true;
    };
  }, [isOwner, loadNotes, projectId]);

  const resetForm = () => {
    setBody("");
    setCategory("general");
    setEditingId(null);
    setEditingVersion(undefined);
    setFormError(null);
  };

  const startEdit = (note: PrivateNote) => {
    setEditingId(note.id);
    setEditingVersion(note.version);
    setBody(note.body);
    setCategory(note.category);
    setFormError(null);
    setSuccess(null);
    bodyRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const trimmed = body.trim();
    if (!trimmed) {
      setFormError("Note cannot be empty.");
      bodyRef.current?.focus();
      return;
    }
    setSaving(true);
    setFormError(null);
    setSuccess(null);
    try {
      const result = await saveNote({
        projectId,
        noteId: editingId ?? undefined,
        body: trimmed,
        category,
        version: editingVersion,
      });
      if (result.ok) {
        setSuccess(editingId ? "Note updated." : "Note saved.");
        track(editingId ? "private_note_updated" : "private_note_created", { projectId });
        resetForm();
        await refresh();
      } else if (result.kind === "conflict") {
        setState({ status: "conflict", message: result.message, latestVersion: result.latestVersion });
        track("private_note_conflict", { projectId });
      } else {
        setFormError(result.message);
        track("private_note_save_error", { projectId });
      }
    } catch {
      setFormError("Unable to save note. Please retry.");
      track("private_note_save_error", { projectId });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (note: PrivateNote) => {
    if (!deleteNote || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const result = await deleteNote({ projectId, noteId: note.id, version: note.version });
      if (result.ok) {
        setSuccess("Note deleted.");
        track("private_note_deleted", { projectId });
        if (editingId === note.id) resetForm();
        await refresh();
      } else if (result.kind === "conflict") {
        setState({ status: "conflict", message: result.message, latestVersion: result.latestVersion });
        track("private_note_conflict", { projectId });
      } else {
        setFormError(result.message);
      }
    } catch {
      setFormError("Unable to delete note. Please retry.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOwner) {
    return (
      <Card className="p-4">
        <Alert variant="error" role="alert">
          You do not have access to private researcher notes for this project.
        </Alert>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-4" aria-labelledby="private-notes-heading">
      <div className="flex items-center justify-between gap-2">
        <h2 id="private-notes-heading" className="text-lg font-semibold">
          Private Researcher Notes
        </h2>
        <span className="text-xs text-gray-500" aria-hidden="true">
          Owner only
        </span>
      </div>
      <p className="text-sm text-gray-600">
        These notes are visible only to you. They are excluded from team views, reviews, analytics content, and logs.
      </p>

      <div ref={statusRef} aria-live="polite" className="space-y-2">
        {success && <Alert variant="success">{success}</Alert>}
        {state.status === "error" && (
          <Alert variant="error" role="alert">
            <div className="flex items-center justify-between gap-2">
              <span>{state.message}</span>
              <Button type="button" variant="outline" onClick={refresh}>
                Retry
              </Button>
            </div>
          </Alert>
        )}
        {state.status === "conflict" && (
          <Alert variant="error" role="alert">
            <div className="space-y-2">
              <p>{state.message}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setState({ status: "loading" });
                  refresh();
                }}
              >
                Reload latest notes
              </Button>
            </div>
          </Alert>
        )}
      </div>

      {state.status === "loading" && (
        <div className="space-y-2" aria-busy="true" aria-label="Loading private notes">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      )}

      {state.status === "empty" && (
        <p className="text-sm text-gray-500">You have no private notes yet. Add one below.</p>
      )}

      {state.status === "ready" && (
        <ul className="space-y-2" aria-label="Private notes">
          {state.notes.map((note) => (
            <li key={note.id} className="border-b pb-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-medium">[{note.category}]</span> {note.body}
                  <div className="text-xs text-gray-400">
                    Updated {note.updatedAt} &middot; v{note.version}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={`Edit note from ${note.updatedAt}`}
                    onClick={() => startEdit(note)}
                  >
                    Edit
                  </Button>
                  {deleteNote && (
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`Delete note from ${note.updatedAt}`}
                      onClick={() => handleDelete(note)}
                      disabled={saving}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <FormWrapper onSubmit={handleSubmit} aria-label={editingId ? "Edit private note" : "Add private note"}>
        <div className="space-y-2">
          {formError && (
            <Alert variant="error" role="alert">
              {formError}
            </Alert>
          )}
          <label htmlFor={categoryId} className="block text-sm font-medium">
            Category
          </label>
          <input
            id={categoryId}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border p-1 rounded w-full"
            maxLength={40}
          />
          <label htmlFor={bodyId} className="block text-sm font-medium">
            Note
          </label>
          <textarea
            id={bodyId}
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a private note"
            className="border p-1 rounded w-full min-h-[96px]"
            maxLength={4000}
            aria-describedby={`${bodyId}-hint`}
          />
          <p id={`${bodyId}-hint`} className="text-xs text-gray-500">
            Private to you. Never included in analytics or logs.
          </p>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Add note"}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      </FormWrapper>
    </Card>
  );
}
