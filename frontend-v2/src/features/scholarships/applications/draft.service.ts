/**
 * Application Draft API Service.
 *
 * Provides typed methods for:
 * - Creating a new draft (owned by the authenticated student)
 * - Saving / autosaving a draft with optimistic-concurrency (ETag version)
 * - Loading a single draft or listing all drafts for a student
 * - Abandoning a draft
 *
 * Autosave safety invariant:
 *   Every save call asserts that the payload does NOT include `status: 'submitted'`.
 *   Submission is handled exclusively by `atomicApplicationService.submitAtomically`.
 *
 * Network fallback:
 *   When `NEXT_PUBLIC_API_BASE_URL` is not configured or the server is
 *   unreachable, the service falls back to the in-memory `draftStore` so
 *   the UI remains functional in development and staging environments.
 *
 * @operational The in-memory fallback means drafts are NOT persisted across
 *   page reloads in offline mode. Production deployments must configure
 *   `NEXT_PUBLIC_API_BASE_URL`.
 */

import { apiClient } from '@/src/lib/api-client';
import {
  assertAutosaveDoesNotSubmit,
  buildVersionConflict,
  isVersionConflict,
  migrateDraftSchema,
} from './draft.domain';
import type {
  AbandonDraftPayload,
  ApplicationDraftRecord,
  CreateDraftPayload,
  DraftStatus,
  SaveDraftResult,
  UpdateDraftPayload,
} from './draft.types';
import { DRAFT_SCHEMA_VERSION } from './draft.types';
import type { EligibilityApplicant } from '../types';

const BASE = '/scholarships/applications/drafts';

// ── In-memory fallback store (used when API is unavailable) ───────────────

const inMemoryDraftStore = new Map<string, ApplicationDraftRecord>();

function generateVersion(): string {
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateDraftId(): string {
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeInMemoryDraft(
  payload: CreateDraftPayload,
  now = new Date()
): ApplicationDraftRecord {
  const iso = now.toISOString();
  return {
    id: generateDraftId(),
    roundId: payload.roundId,
    ownerId: payload.ownerId,
    version: generateVersion(),
    status: 'draft',
    schemaVersion: DRAFT_SCHEMA_VERSION,
    statementSummary: '',
    requestedAmountCents: undefined,
    needsFinancialAid: true,
    applicantProfile: payload.applicantProfile,
    documents: [],
    acceptedConsentKinds: [],
    clientNonce: payload.clientNonce,
    createdAt: iso,
    lastSavedAt: iso,
    updatedAt: iso,
  };
}

function applyUpdateToInMemoryDraft(
  existing: ApplicationDraftRecord,
  payload: UpdateDraftPayload
): ApplicationDraftRecord {
  const now = new Date().toISOString();
  return {
    ...existing,
    version: generateVersion(),
    statementSummary: payload.statementSummary,
    requestedAmountCents: payload.requestedAmountCents,
    needsFinancialAid: payload.needsFinancialAid,
    applicantProfile: payload.applicantProfile,
    documents: payload.documents,
    acceptedConsentKinds: payload.acceptedConsentKinds,
    lastSavedAt: now,
    updatedAt: payload.updatedAt,
  };
}

// ── Service ───────────────────────────────────────────────────────────────

export const applicationDraftService = {
  /**
   * Creates a new empty draft owned by the given student for the given round.
   *
   * Returns the persisted draft with its server-assigned `id` and initial `version`.
   */
  async create(payload: CreateDraftPayload): Promise<ApplicationDraftRecord> {
    try {
      const remote = await apiClient.post<ApplicationDraftRecord>(BASE, payload);
      return migrateDraftSchema(remote as unknown as Record<string, unknown>);
    } catch {
      // Offline / development fallback
      const draft = makeInMemoryDraft(payload);
      inMemoryDraftStore.set(draft.id, draft);
      return draft;
    }
  },

  /**
   * Saves (autosaves) an existing draft.
   *
   * Safety:
   * - Asserts the payload does not set status to `submitted`.
   * - Sends the current `version` for optimistic-concurrency detection.
   * - Returns `SaveDraftResult` indicating success, conflict, or error.
   *
   * @throws {Error} if payload would set status to submitted (autosave guard).
   */
  async save(
    draftId: string,
    payload: UpdateDraftPayload
  ): Promise<SaveDraftResult> {
    // Autosave invariant: must never submit
    assertAutosaveDoesNotSubmit(payload);

    try {
      const remote = await apiClient.put<ApplicationDraftRecord>(
        `${BASE}/${encodeURIComponent(draftId)}`,
        payload
      );

      // Server returns the authoritative new version
      const serverDraft = migrateDraftSchema(
        remote as unknown as Record<string, unknown>
      );

      // Detect concurrent-edit conflict
      if (isVersionConflict(payload.version, serverDraft.version)) {
        return {
          ok: false,
          conflict: buildVersionConflict(payload.version, serverDraft),
        };
      }

      return { ok: true, draft: serverDraft };
    } catch (err) {
      // Offline fallback — update in-memory store
      const existing = inMemoryDraftStore.get(draftId);
      if (!existing) {
        return {
          ok: false,
          error: 'Draft not found in offline store.',
        };
      }

      // Detect in-memory version conflict
      if (isVersionConflict(payload.version, existing.version)) {
        return {
          ok: false,
          conflict: buildVersionConflict(payload.version, existing),
        };
      }

      const updated = applyUpdateToInMemoryDraft(existing, payload);
      inMemoryDraftStore.set(draftId, updated);
      return { ok: true, draft: updated };
    }
  },

  /**
   * Loads a single draft by its ID.
   *
   * Ownership is enforced by the server; this call will receive a 403
   * if the authenticated user is not the owner.
   */
  async load(draftId: string): Promise<ApplicationDraftRecord | null> {
    try {
      const remote = await apiClient.get<ApplicationDraftRecord>(
        `${BASE}/${encodeURIComponent(draftId)}`
      );
      return migrateDraftSchema(remote as unknown as Record<string, unknown>);
    } catch {
      return inMemoryDraftStore.get(draftId) ?? null;
    }
  },

  /**
   * Lists all resumable drafts for a student.
   * Results are filtered to `status: 'draft'` (not abandoned) server-side.
   */
  async listForStudent(
    studentId: string,
    options?: { roundId?: string; status?: DraftStatus }
  ): Promise<ApplicationDraftRecord[]> {
    try {
      const qs = new URLSearchParams({ studentId });
      if (options?.roundId) qs.set('roundId', options.roundId);
      if (options?.status) qs.set('status', options.status);

      const remote = await apiClient.get<ApplicationDraftRecord[]>(
        `${BASE}?${qs.toString()}`
      );
      return remote.map((d) =>
        migrateDraftSchema(d as unknown as Record<string, unknown>)
      );
    } catch {
      // Return in-memory fallback filtered to this student
      return Array.from(inMemoryDraftStore.values()).filter(
        (d) =>
          d.ownerId === studentId &&
          (!options?.roundId || d.roundId === options.roundId) &&
          (!options?.status || d.status === options.status)
      );
    }
  },

  /**
   * Marks a draft as `abandoned`.
   *
   * Sends the current version to prevent accidental abandonment of a
   * concurrently-updated draft. Once abandoned the draft is excluded
   * from the student's active draft list.
   */
  async abandon(
    draftId: string,
    payload: AbandonDraftPayload
  ): Promise<ApplicationDraftRecord> {
    try {
      return await apiClient.post<ApplicationDraftRecord>(
        `${BASE}/${encodeURIComponent(draftId)}/abandon`,
        payload
      );
    } catch {
      const existing = inMemoryDraftStore.get(draftId);
      if (!existing) {
        throw new Error(`Draft ${draftId} not found.`);
      }
      const abandoned: ApplicationDraftRecord = {
        ...existing,
        status: 'abandoned',
        version: generateVersion(),
        updatedAt: new Date().toISOString(),
      };
      inMemoryDraftStore.set(draftId, abandoned);
      return abandoned;
    }
  },

  /**
   * Resets the in-memory store. For use in tests only.
   * @internal
   */
  _resetForTests(): void {
    inMemoryDraftStore.clear();
  },
};

/**
 * Creates a default eligibility applicant profile for a new draft.
 * The student can update their profile fields in the form.
 */
export function makeDefaultApplicantProfile(): EligibilityApplicant {
  return {
    enrollmentStatus: 'current',
    courseIds: [],
    gradeValue: undefined,
    gradeMetric: 'percentage',
    region: undefined,
    incomeBand: undefined,
    role: 'student',
    age: undefined,
    customAttestation: undefined,
    completedAchievementIds: [],
    selectedScholarshipIds: [],
    priorAwardIds: [],
    evidencePermissionGranted: false,
  };
}
