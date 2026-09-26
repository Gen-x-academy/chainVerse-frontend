/**
 * React Query hooks for Application Draft management.
 *
 * Covers:
 * - `useStudentDrafts`   — list all resumable drafts (with loading/empty/error states)
 * - `useLoadDraft`       — load a single draft by ID (for resume journey)
 * - `useCreateDraft`     — start a new draft for a round
 * - `useAutosaveDraft`   — debounced autosave that never triggers submission
 * - `useAbandonDraft`    — discard an incomplete draft
 *
 * Autosave debounce: changes are flushed after 2 s of inactivity (configurable).
 * The autosave hook monitors `draft.updatedAt` (set by every store mutation) and
 * triggers `draftStore.saveDraft()` after the debounce period.
 *
 * @permission Only the owning student (`ownerId`) should use `useCreateDraft`,
 *   `useAutosaveDraft`, and `useAbandonDraft`. Permission is also enforced
 *   server-side via JWT subject claims.
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { applicationDraftService, makeDefaultApplicantProfile } from './draft.service';
import { useDraftStore } from './draft.store';
import type { ApplicationDraftRecord } from './draft.types';

// ── Query keys ────────────────────────────────────────────────────────────

export const draftKeys = {
  all: ['application-drafts'] as const,
  list: (studentId: string) =>
    [...draftKeys.all, 'list', studentId] as const,
  detail: (draftId: string) =>
    [...draftKeys.all, 'detail', draftId] as const,
};

// ── Hooks ─────────────────────────────────────────────────────────────────

/**
 * Lists all active (non-abandoned) drafts for a student.
 *
 * States exposed:
 * - `isLoading` — skeleton / loading state
 * - `data: []`  — empty state (no drafts yet)
 * - `isError`   — error state with `error.message`
 * - `data`      — success state with draft list
 */
export function useStudentDrafts(studentId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: draftKeys.list(studentId),
    queryFn: () =>
      applicationDraftService.listForStudent(studentId, { status: 'draft' }),
    enabled: Boolean(studentId) && (options?.enabled ?? true),
    staleTime: 30 * 1000,
  });
}

/**
 * Loads a single draft by ID into the store (resume journey).
 *
 * Automatically calls `draftStore.loadDraft` when data arrives.
 */
export function useLoadDraft(draftId: string | null, options?: { enabled?: boolean }) {
  const loadDraft = useDraftStore((s) => s.loadDraft);

  const query = useQuery({
    queryKey: draftKeys.detail(draftId ?? ''),
    queryFn: () => applicationDraftService.load(draftId!),
    enabled: Boolean(draftId) && (options?.enabled ?? true),
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (query.data) {
      loadDraft(query.data as ApplicationDraftRecord);
    }
  }, [query.data, loadDraft]);

  return query;
}

/**
 * Creates a new draft for a scholarship round.
 *
 * On success:
 * - Stores the new draft in the Zustand store via `setDraft`.
 * - Invalidates the student's draft list.
 */
export function useCreateDraft(studentId: string) {
  const queryClient = useQueryClient();
  const setDraft = useDraftStore((s) => s.setDraft);

  return useMutation({
    mutationFn: (roundId: string) =>
      applicationDraftService.create({
        roundId,
        ownerId: studentId,
        clientNonce:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `nonce-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        applicantProfile: makeDefaultApplicantProfile(),
      }),
    onSuccess: (draft) => {
      setDraft(draft);
      queryClient.invalidateQueries({ queryKey: draftKeys.list(studentId) });
    },
  });
}

/**
 * Debounced autosave hook.
 *
 * Watches `draft.updatedAt` (set by every field mutation in the store) and
 * triggers `saveDraft()` after `debounceMs` of inactivity.
 *
 * Invariant: autosave NEVER triggers submission. The save path in
 * `applicationDraftService.save` and `buildAutosavePayload` enforce this.
 *
 * @param debounceMs Milliseconds to wait after the last change before saving.
 *   Defaults to 2000 ms.
 */
export function useAutosaveDraft(debounceMs = 2000) {
  const draft = useDraftStore((s) => s.draft);
  const autosaveStatus = useDraftStore((s) => s.autosave.status);
  const saveDraft = useDraftStore((s) => s.saveDraft);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void saveDraft();
    }, debounceMs);
  }, [saveDraft, debounceMs]);

  // Watch draft.updatedAt — fires whenever any field changes
  const updatedAt = draft?.updatedAt;
  const draftStatus = draft?.status;

  useEffect(() => {
    // Only autosave drafts in 'draft' status and when there are pending changes
    if (draftStatus !== 'draft') return;
    if (autosaveStatus !== 'pending') return;
    if (!updatedAt) return;

    trigger();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [updatedAt, draftStatus, autosaveStatus, trigger]);
}

/**
 * Abandons a draft and clears the store session.
 *
 * Invalidates the student's draft list on success.
 */
export function useAbandonDraft(studentId: string) {
  const queryClient = useQueryClient();
  const { draft, abandonDraft } = useDraftStore((s) => ({
    draft: s.draft,
    abandonDraft: s.abandonDraft,
  }));

  return useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error('No active draft to abandon.');
      await abandonDraft();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: draftKeys.list(studentId) });
    },
  });
}
