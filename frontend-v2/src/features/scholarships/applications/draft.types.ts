/**
 * Persisted Application Draft Types.
 *
 * Enforces:
 * - Draft ownership: only the owning student may read or overwrite their draft.
 * - Concurrent-edit safety: `version` (ETag-style) allows detection of conflicts
 *   when two sessions edit the same draft simultaneously.
 * - Autosave invariant: saving a draft never changes `status` to `submitted`.
 *   Submission is a separate, explicit, atomic operation.
 * - Abandon: a student may discard an incomplete draft at any time.
 *
 * @ownership The student identified by `ownerId` is the only party allowed
 *   to read, edit, save, or abandon this draft.
 * @privacy Draft content (statement, documents) is treated as sensitive
 *   personal data in line with the platform privacy policy.
 * @migration When the `ApplicationDraft` shape changes, increment
 *   `DRAFT_SCHEMA_VERSION` and provide a migration function in `draft.domain.ts`.
 */

import type { ConsentKind } from '../consent';
import type { SupportingDocument } from '../documents';
import type { EligibilityApplicant } from '../types';

/** Bumped whenever the stored shape changes incompatibly. */
export const DRAFT_SCHEMA_VERSION = 1;

/**
 * Lifecycle states of an application draft.
 *
 * State machine:
 *   draft → submitted  (via AtomicSubmissionFlow — never via autosave)
 *   draft → abandoned  (explicit student action)
 *
 * Autosave only operates on drafts in `'draft'` status.
 */
export type DraftStatus = 'draft' | 'abandoned';

/**
 * A persisted, version-stamped application draft owned by a single student.
 *
 * The `version` field is an opaque string returned by the server (or generated
 * client-side in offline mode) that acts as an optimistic-concurrency ETag.
 * Clients must send the current `version` with every save; the server rejects
 * the update with `409 Conflict` if the stored version has changed.
 */
export interface ApplicationDraftRecord {
  /** Stable surrogate key for the draft (never reused after deletion). */
  id: string;
  /** The scholarship round this draft targets. */
  roundId: string;
  /** Identity of the student who created this draft (owner). */
  ownerId: string;
  /**
   * Optimistic-concurrency version (ETag).
   * Must match the server's stored value on every save request.
   * Updated by every successful save response.
   */
  version: string;
  /** Lifecycle state — autosave MUST NOT set this to `submitted`. */
  status: DraftStatus;
  /** Schema version — used for client-side migration. */
  schemaVersion: number;

  // ── Form content ──────────────────────────────────────────────────────────
  statementSummary: string;
  requestedAmountCents?: number;
  needsFinancialAid: boolean;
  applicantProfile: EligibilityApplicant;
  documents: SupportingDocument[];
  acceptedConsentKinds: ConsentKind[];

  /** Client-generated idempotency nonce for the eventual submission. */
  clientNonce: string;

  // ── Timestamps ────────────────────────────────────────────────────────────
  createdAt: string;
  /** ISO-8601; updated on every successful autosave. */
  lastSavedAt: string;
  /** ISO-8601 of the most recent field-level change by the user. */
  updatedAt: string;
}

// ── Request / response shapes ─────────────────────────────────────────────

export interface CreateDraftPayload {
  roundId: string;
  ownerId: string;
  clientNonce: string;
  applicantProfile: EligibilityApplicant;
}

export interface UpdateDraftPayload {
  /** Must match the server's current version — enforces optimistic concurrency. */
  version: string;
  statementSummary: string;
  requestedAmountCents?: number;
  needsFinancialAid: boolean;
  applicantProfile: EligibilityApplicant;
  documents: SupportingDocument[];
  acceptedConsentKinds: ConsentKind[];
  updatedAt: string;
}

export interface AbandonDraftPayload {
  /** Must match server version to prevent accidental abandonment of a newer draft. */
  version: string;
}

// ── Conflict handling ─────────────────────────────────────────────────────

/**
 * Returned when a save is rejected because the server's version differs
 * from the one the client sent (concurrent edit detected).
 */
export interface DraftVersionConflict {
  conflictDetected: true;
  localVersion: string;
  serverVersion: string;
  serverDraft: ApplicationDraftRecord;
}

export type SaveDraftResult =
  | { ok: true; draft: ApplicationDraftRecord }
  | { ok: false; conflict: DraftVersionConflict }
  | { ok: false; error: string };

// ── Autosave ──────────────────────────────────────────────────────────────

export type AutosaveStatus =
  | 'idle'
  | 'pending'
  | 'saving'
  | 'saved'
  | 'conflict'
  | 'error';

/**
 * UI-facing autosave indicator state.
 *
 * Invariant: `status` is NEVER `'submitted'` — autosave is strictly a
 * draft-preservation mechanism, not a submission pathway.
 */
export interface AutosaveState {
  status: AutosaveStatus;
  lastSavedAt: string | null;
  errorMessage: string | null;
  conflictDraft: ApplicationDraftRecord | null;
}
