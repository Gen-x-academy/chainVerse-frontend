/**
 * Application Draft Domain Logic.
 *
 * Pure, side-effect-free functions for:
 * - Draft ownership enforcement
 * - Version conflict detection
 * - Autosave guard (must never produce a submitted state)
 * - Client-side schema migration
 *
 * @ownership Ownership checks here are UX guards only. The API server
 *   enforces ownership authoritatively via JWT subject claims.
 */

import {
  DRAFT_SCHEMA_VERSION,
  type ApplicationDraftRecord,
  type AutosaveState,
  type DraftVersionConflict,
  type SaveDraftResult,
} from './draft.types';
import type { UpdateDraftPayload } from './draft.types';

// ── Ownership ─────────────────────────────────────────────────────────────

/**
 * Returns true if `studentId` is the owner of the draft.
 *
 * This is a UX guard — the server always re-validates ownership
 * using the authenticated session identity.
 */
export function isDraftOwner(
  draft: ApplicationDraftRecord,
  studentId: string
): boolean {
  return draft.ownerId === studentId;
}

// ── Concurrent-edit conflict detection ───────────────────────────────────

/**
 * Returns true when the client's cached version differs from the
 * version returned by the server — indicating a concurrent edit.
 */
export function isVersionConflict(
  localVersion: string,
  serverVersion: string
): boolean {
  return localVersion !== serverVersion;
}

/**
 * Builds a typed `DraftVersionConflict` from a server response that
 * returned a newer version than what the client held.
 */
export function buildVersionConflict(
  localVersion: string,
  serverDraft: ApplicationDraftRecord
): DraftVersionConflict {
  return {
    conflictDetected: true,
    localVersion,
    serverVersion: serverDraft.version,
    serverDraft,
  };
}

// ── Autosave guard ─────────────────────────────────────────────────────────

/**
 * Guards that an autosave payload does NOT change draft status to `submitted`.
 *
 * Invariant: autosave is a draft-preservation mechanism only.
 * The submission transition is performed exclusively by the atomic
 * submission flow (`atomicApplicationService.submitAtomically`).
 *
 * @throws {Error} if the payload would set status to `submitted`.
 */
export function assertAutosaveDoesNotSubmit(
  payload: Partial<UpdateDraftPayload & { status?: string }>
): void {
  if ('status' in payload && payload.status === 'submitted') {
    throw new Error(
      '[AutosaveGuard] Autosave must not transition a draft to "submitted". ' +
        'Use atomicApplicationService.submitAtomically() for submission.'
    );
  }
}

/**
 * Produces a clean `UpdateDraftPayload` from the current draft record,
 * stripping any status or read-only fields.
 *
 * Safe to pass directly to the autosave API endpoint.
 */
export function buildAutosavePayload(
  draft: ApplicationDraftRecord,
  now = new Date()
): UpdateDraftPayload {
  return {
    version: draft.version,
    statementSummary: draft.statementSummary,
    requestedAmountCents: draft.requestedAmountCents,
    needsFinancialAid: draft.needsFinancialAid,
    applicantProfile: draft.applicantProfile,
    documents: draft.documents,
    acceptedConsentKinds: draft.acceptedConsentKinds,
    updatedAt: now.toISOString(),
  };
}

// ── Initial autosave state ─────────────────────────────────────────────────

export function makeInitialAutosaveState(): AutosaveState {
  return {
    status: 'idle',
    lastSavedAt: null,
    errorMessage: null,
    conflictDraft: null,
  };
}

// ── Schema migration ───────────────────────────────────────────────────────

/**
 * Migrates a locally-stored draft from an older schema version to the
 * current one. Returns the migrated draft unchanged if already current.
 *
 * Add migration steps here whenever `DRAFT_SCHEMA_VERSION` is incremented.
 */
export function migrateDraftSchema(
  raw: Record<string, unknown>
): ApplicationDraftRecord {
  const storedVersion = (raw.schemaVersion as number | undefined) ?? 0;

  // v0 → v1: no-op (first version)
  if (storedVersion < 1) {
    raw = {
      ...raw,
      schemaVersion: 1,
      status: raw.status ?? 'draft',
      version: raw.version ?? `v0-migrated-${Date.now()}`,
    };
  }

  if ((raw.schemaVersion as number) !== DRAFT_SCHEMA_VERSION) {
    // Future migration steps go here
  }

  return raw as unknown as ApplicationDraftRecord;
}

// ── Draft list helpers ─────────────────────────────────────────────────────

/**
 * Filters a list of draft records to only those owned by `studentId`
 * with status `'draft'` (i.e. resumable, not abandoned).
 */
export function getResumableDrafts(
  drafts: ApplicationDraftRecord[],
  studentId: string
): ApplicationDraftRecord[] {
  return drafts.filter(
    (d) => d.ownerId === studentId && d.status === 'draft'
  );
}

/**
 * Sorts draft records by `lastSavedAt` descending (most recently saved first).
 */
export function sortDraftsByRecency(
  drafts: ApplicationDraftRecord[]
): ApplicationDraftRecord[] {
  return [...drafts].sort(
    (a, b) =>
      new Date(b.lastSavedAt).getTime() - new Date(a.lastSavedAt).getTime()
  );
}

/**
 * Produces a `SaveDraftResult` from a resolved server response.
 * If the server returned a newer version (conflict), wraps it accordingly.
 */
export function resolveSaveResult(
  localVersion: string,
  serverDraft: ApplicationDraftRecord
): SaveDraftResult {
  if (isVersionConflict(localVersion, serverDraft.version)) {
    return {
      ok: false,
      conflict: buildVersionConflict(localVersion, serverDraft),
    };
  }
  return { ok: true, draft: serverDraft };
}
