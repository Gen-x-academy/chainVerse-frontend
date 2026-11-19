/**
 * Autosave for proposal revisions (CAPSTONE-034).
 *
 * Resumable drafts with revision tokens, per-field timestamps, conflict
 * detection, offline recovery and explicit "last saved" feedback. The logic is
 * pure: the caller performs the network request and feeds the result back in.
 *
 * Model: the server owns a revision token. A save sends the changed fields and
 * the token the edit was based on. If the token is stale the server answers
 * with its current fields and token; `resolveConflict` then merges per field,
 * newest edit wins, and reports the fields where both sides changed so the
 * user can review them.
 */

export type FieldMap = Record<string, string>;

export interface FieldStamp {
  /** ISO time of the last local edit to the field. */
  editedAt: string;
}

export interface AutosaveState {
  draftId: string;
  /** Last content known to be on the server. */
  base: FieldMap;
  /** Token of `base`, as given by the server; null before the first save. */
  baseToken: string | null;
  /** Current local content. */
  fields: FieldMap;
  edited: Record<string, FieldStamp>;
  /** Fields changed since the last successful save. */
  dirty: string[];
  savedAt: string | null;
  status: "idle" | "dirty" | "saving" | "saved" | "offline" | "conflict";
}

export function newAutosave(draftId: string, serverFields: FieldMap = {}, token: string | null = null, savedAt: string | null = null): AutosaveState {
  return { draftId, base: { ...serverFields }, baseToken: token, fields: { ...serverFields }, edited: {}, dirty: [], savedAt, status: token ? "saved" : "idle" };
}

export function edit(state: AutosaveState, field: string, value: string, now: Date): AutosaveState {
  const same = value === (state.base[field] ?? "");
  const dirty = same ? state.dirty.filter((f) => f !== field) : [...new Set([...state.dirty, field])].sort();
  return {
    ...state,
    fields: { ...state.fields, [field]: value },
    edited: { ...state.edited, [field]: { editedAt: now.toISOString() } },
    dirty,
    status: dirty.length > 0 ? (state.status === "offline" ? "offline" : "dirty") : state.status === "dirty" ? "saved" : state.status,
  };
}

export interface SaveRequest {
  draftId: string;
  /** The token these changes were based on. */
  baseToken: string | null;
  changes: FieldMap;
  /** Per-field edit times, so the server can record them and a merge can order edits. */
  editedAt: Record<string, string>;
}

export function buildSaveRequest(state: AutosaveState): SaveRequest | null {
  if (state.dirty.length === 0) return null;
  const changes: FieldMap = {};
  const editedAt: Record<string, string> = {};
  for (const f of state.dirty) {
    changes[f] = state.fields[f] ?? "";
    if (state.edited[f]) editedAt[f] = state.edited[f].editedAt;
  }
  return { draftId: state.draftId, baseToken: state.baseToken, changes, editedAt };
}

export function markSaving(state: AutosaveState): AutosaveState {
  return state.dirty.length > 0 ? { ...state, status: "saving" } : state;
}

export type SaveResponse =
  | { kind: "ok"; token: string; savedAt: string }
  | { kind: "conflict"; token: string; serverFields: FieldMap; serverEditedAt: Record<string, string> }
  | { kind: "network_error" };

/** Apply a server response. Edits made while the request was in flight stay dirty. */
export function applySaveResponse(state: AutosaveState, request: SaveRequest, response: SaveResponse): AutosaveState {
  switch (response.kind) {
    case "ok": {
      const base = { ...state.base, ...request.changes };
      const stillDirty = state.dirty.filter((f) => (state.fields[f] ?? "") !== (base[f] ?? ""));
      return { ...state, base, baseToken: response.token, savedAt: response.savedAt, dirty: stillDirty, status: stillDirty.length > 0 ? "dirty" : "saved" };
    }
    case "conflict":
      return resolveConflict({ ...state, status: "conflict" }, response.token, response.serverFields, response.serverEditedAt);
    case "network_error":
      return { ...state, status: "offline" };
  }
}

export interface ConflictedState extends AutosaveState {
  /** Fields both sides changed since the common base; the user should review these. */
  conflicts: string[];
}

/**
 * Merge a newer server version into local edits. Per field: only one side
 * changed means take that side; both changed to different values means the later
 * edit wins and the field is reported in `conflicts`.
 */
export function resolveConflict(state: AutosaveState, serverToken: string, serverFields: FieldMap, serverEditedAt: Record<string, string>): ConflictedState {
  const fields: FieldMap = { ...serverFields };
  const conflicts: string[] = [];
  const dirty: string[] = [];

  for (const f of state.dirty) {
    const local = state.fields[f] ?? "";
    const server = serverFields[f] ?? "";
    const baseValue = state.base[f] ?? "";
    const serverChanged = server !== baseValue;
    if (!serverChanged || server === local) {
      fields[f] = local;
    } else {
      conflicts.push(f);
      const localTime = state.edited[f]?.editedAt ?? "";
      const serverTime = serverEditedAt[f] ?? "";
      fields[f] = localTime >= serverTime ? local : server;
    }
    if (fields[f] !== server) dirty.push(f);
  }
  // Fields the user did not touch follow the server.
  return { ...state, base: { ...serverFields }, baseToken: serverToken, fields: { ...fields }, dirty: dirty.sort(), conflicts: conflicts.sort(), status: conflicts.length > 0 ? "conflict" : dirty.length > 0 ? "dirty" : "saved" };
}

// ---- Offline recovery -------------------------------------------------------

export const STORAGE_VERSION = 1;

/** A plain-JSON snapshot for local storage, so unsaved work survives a reload or lost connection. */
export function serializeForStorage(state: AutosaveState): string {
  return JSON.stringify({ v: STORAGE_VERSION, state });
}

export function restoreFromStorage(raw: string | null | undefined, expectedDraftId: string): AutosaveState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { v?: unknown; state?: AutosaveState };
    if (parsed.v !== STORAGE_VERSION || !parsed.state || parsed.state.draftId !== expectedDraftId) return null;
    const s = parsed.state;
    if (typeof s.fields !== "object" || typeof s.base !== "object" || !Array.isArray(s.dirty)) return null;
    // A recovered session starts offline if it has unsaved work, so it is retried explicitly.
    return { ...s, status: s.dirty.length > 0 ? "offline" : "saved" };
  } catch {
    return null;
  }
}

// ---- Feedback ---------------------------------------------------------------

/** Plain-language save status for the UI (and screen readers). */
export function lastSavedLabel(state: AutosaveState, now: Date): string {
  switch (state.status) {
    case "saving":
      return "Saving…";
    case "offline":
      return "Offline. Your changes are stored on this device and will be saved when you reconnect.";
    case "conflict":
      return "Someone else changed this draft. Review the highlighted fields.";
    case "dirty":
      return "Unsaved changes";
    default:
      break;
  }
  if (!state.savedAt) return "Not saved yet";
  const seconds = Math.max(0, Math.round((now.getTime() - Date.parse(state.savedAt)) / 1000));
  if (seconds < 10) return "Saved just now";
  if (seconds < 60) return `Saved ${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Saved ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  return `Saved ${hours} hour${hours === 1 ? "" : "s"} ago`;
}
