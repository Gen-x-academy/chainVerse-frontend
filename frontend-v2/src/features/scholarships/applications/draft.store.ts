/**
 * Scholarship Application Draft — Zustand Store.
 *
 * Manages the in-progress draft state for a single scholarship application
 * session. Persisted to `sessionStorage` so that page-refresh and accidental
 * navigation do not lose the student's work. Clears on successful submission.
 *
 * Autosave invariant (enforced here and in `draft.service.ts`):
 *   `saveDraft` NEVER transitions `status` to `'submitted'`.
 *   Submission is triggered only by `atomicApplicationService.submitAtomically`.
 *
 * Concurrent-edit protection:
 *   Every save carries the current `version`. A `409`-equivalent conflict
 *   from the server sets `autosaveStatus` to `'conflict'` and exposes the
 *   server's draft for the UI to present a resolution dialog.
 *
 * @ownership Only actions initiated by the owner (`ownerId`) should be
 *   dispatched. The API server enforces this authoritatively.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { buildAutosavePayload } from './draft.domain';
import { applicationDraftService } from './draft.service';
import type {
  ApplicationDraftRecord,
  AutosaveState,
  AutosaveStatus,
} from './draft.types';
import type { ConsentKind } from '../consent';
import type { SupportingDocument } from '../documents';
import type { EligibilityApplicant } from '../types';

// ── State & actions ────────────────────────────────────────────────────────

export interface DraftStoreState {
  /** The active in-progress draft, or null when no session is open. */
  draft: ApplicationDraftRecord | null;
  /** Real-time autosave indicator. */
  autosave: AutosaveState;

  // ── Session lifecycle ────────────────────────────────────────────────────
  /** Load an existing draft into the store (resume). */
  loadDraft: (draft: ApplicationDraftRecord) => void;
  /** Start a fresh empty draft session. */
  setDraft: (draft: ApplicationDraftRecord) => void;
  /** Clear the active session (called after successful submission or abandon). */
  clearSession: () => void;

  // ── Field mutations ──────────────────────────────────────────────────────
  setStatementSummary: (value: string) => void;
  setRequestedAmountCents: (value: number | undefined) => void;
  setNeedsFinancialAid: (value: boolean) => void;
  setApplicantProfile: (profile: EligibilityApplicant) => void;
  addDocument: (doc: SupportingDocument) => void;
  removeDocument: (docId: string) => void;
  toggleConsent: (kind: ConsentKind) => void;

  // ── Autosave ─────────────────────────────────────────────────────────────
  /** Persist the current in-memory draft to the server (or in-memory fallback). */
  saveDraft: () => Promise<void>;
  /** Set autosave status externally (e.g., from autosave hook). */
  setAutosaveStatus: (status: AutosaveStatus, message?: string) => void;
  /** Accept the server's version in a conflict resolution. */
  resolveConflictWithServer: () => void;
  /** Keep the local version in a conflict resolution (triggers a force-save). */
  resolveConflictWithLocal: () => Promise<void>;

  // ── Abandon ───────────────────────────────────────────────────────────────
  abandonDraft: () => Promise<void>;
}

// ── Initial autosave state ─────────────────────────────────────────────────

const initialAutosave: AutosaveState = {
  status: 'idle',
  lastSavedAt: null,
  errorMessage: null,
  conflictDraft: null,
};

// ── Store ──────────────────────────────────────────────────────────────────

export const useDraftStore = create<DraftStoreState>()(
  persist(
    (set, get) => ({
      draft: null,
      autosave: initialAutosave,

      // ── Session lifecycle ──────────────────────────────────────────────

      loadDraft: (draft) =>
        set({ draft, autosave: { ...initialAutosave, lastSavedAt: draft.lastSavedAt } }),

      setDraft: (draft) => set({ draft, autosave: initialAutosave }),

      clearSession: () => set({ draft: null, autosave: initialAutosave }),

      // ── Field mutations ────────────────────────────────────────────────

      setStatementSummary: (value) =>
        set((s) =>
          s.draft
            ? {
                draft: {
                  ...s.draft,
                  statementSummary: value,
                  updatedAt: new Date().toISOString(),
                },
                autosave: { ...s.autosave, status: 'pending' },
              }
            : s
        ),

      setRequestedAmountCents: (value) =>
        set((s) =>
          s.draft
            ? {
                draft: {
                  ...s.draft,
                  requestedAmountCents: value,
                  updatedAt: new Date().toISOString(),
                },
                autosave: { ...s.autosave, status: 'pending' },
              }
            : s
        ),

      setNeedsFinancialAid: (value) =>
        set((s) =>
          s.draft
            ? {
                draft: {
                  ...s.draft,
                  needsFinancialAid: value,
                  updatedAt: new Date().toISOString(),
                },
                autosave: { ...s.autosave, status: 'pending' },
              }
            : s
        ),

      setApplicantProfile: (profile) =>
        set((s) =>
          s.draft
            ? {
                draft: {
                  ...s.draft,
                  applicantProfile: profile,
                  updatedAt: new Date().toISOString(),
                },
                autosave: { ...s.autosave, status: 'pending' },
              }
            : s
        ),

      addDocument: (doc) =>
        set((s) =>
          s.draft
            ? {
                draft: {
                  ...s.draft,
                  documents: [
                    ...s.draft.documents.filter((d) => d.id !== doc.id),
                    doc,
                  ],
                  updatedAt: new Date().toISOString(),
                },
                autosave: { ...s.autosave, status: 'pending' },
              }
            : s
        ),

      removeDocument: (docId) =>
        set((s) =>
          s.draft
            ? {
                draft: {
                  ...s.draft,
                  documents: s.draft.documents.filter((d) => d.id !== docId),
                  updatedAt: new Date().toISOString(),
                },
                autosave: { ...s.autosave, status: 'pending' },
              }
            : s
        ),

      toggleConsent: (kind) =>
        set((s) => {
          if (!s.draft) return s;
          const current = s.draft.acceptedConsentKinds;
          return {
            draft: {
              ...s.draft,
              acceptedConsentKinds: current.includes(kind)
                ? current.filter((k) => k !== kind)
                : [...current, kind],
              updatedAt: new Date().toISOString(),
            },
            autosave: { ...s.autosave, status: 'pending' },
          };
        }),

      // ── Autosave ───────────────────────────────────────────────────────

      saveDraft: async () => {
        const { draft } = get();
        if (!draft || draft.status !== 'draft') return;

        set((s) => ({
          autosave: { ...s.autosave, status: 'saving', errorMessage: null },
        }));

        const payload = buildAutosavePayload(draft);

        const result = await applicationDraftService.save(draft.id, payload);

        if (result.ok) {
          set({
            draft: result.draft,
            autosave: {
              status: 'saved',
              lastSavedAt: result.draft.lastSavedAt,
              errorMessage: null,
              conflictDraft: null,
            },
          });
        } else if ('conflict' in result && result.conflict) {
          set((s) => ({
            autosave: {
              ...s.autosave,
              status: 'conflict',
              errorMessage:
                'Another session saved this draft. Review changes below.',
              conflictDraft: result.conflict.serverDraft,
            },
          }));
        } else {
          const errMsg =
            'error' in result && result.error
              ? result.error
              : 'Draft could not be saved. Changes are preserved locally.';
          set((s) => ({
            autosave: {
              ...s.autosave,
              status: 'error',
              errorMessage: errMsg,
            },
          }));
        }
      },

      setAutosaveStatus: (status, message) =>
        set((s) => ({
          autosave: { ...s.autosave, status, errorMessage: message ?? null },
        })),

      resolveConflictWithServer: () =>
        set((s) => {
          if (!s.autosave.conflictDraft) return s;
          return {
            draft: s.autosave.conflictDraft,
            autosave: {
              status: 'saved',
              lastSavedAt: s.autosave.conflictDraft.lastSavedAt,
              errorMessage: null,
              conflictDraft: null,
            },
          };
        }),

      resolveConflictWithLocal: async () => {
        const { draft, saveDraft } = get();
        if (!draft) return;
        // Force a re-save by bumping updatedAt; the service will generate a new version
        set((s) =>
          s.draft
            ? {
                draft: { ...s.draft, updatedAt: new Date().toISOString() },
                autosave: {
                  ...s.autosave,
                  conflictDraft: null,
                  status: 'pending',
                },
              }
            : s
        );
        await saveDraft();
      },

      // ── Abandon ─────────────────────────────────────────────────────────

      abandonDraft: async () => {
        const { draft } = get();
        if (!draft) return;

        await applicationDraftService.abandon(draft.id, {
          version: draft.version,
        });

        set({ draft: null, autosave: initialAutosave });
      },
    }),
    {
      name: 'chainverse-application-draft-store',
      // sessionStorage so drafts survive page refresh but clear on tab close
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? sessionStorage
          : ({
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            } as Storage)
      ),
      // Only persist the draft itself; autosave UI state is transient
      partialize: (state) => ({ draft: state.draft }),
    }
  )
);
