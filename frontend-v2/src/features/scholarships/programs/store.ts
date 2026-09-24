import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { scholarshipProgramsService } from './service';
import type { ProgramTermRevision, ProgramTermsState } from './types';

type ProgramTermsStore = ProgramTermsState & {
  selectedRevision: ProgramTermRevision | null;
  fetchProgramTerms: (programId: string) => Promise<ProgramTermRevision[]>;
  acceptTerms: (payload: {
    applicationId: string;
    programId: string;
    revisionId: string;
    termsVersion: string;
    integrityHash: string;
  }) => Promise<{ revisionId: string; termsVersion: string } | null>;
  reset: () => void;
};

export const useScholarshipProgramsStore = create<ProgramTermsStore>()(
  persist(
    (set, get) => ({
      revisions: [],
      loading: false,
      error: null,
      acceptedRevisionId: null,
      selectedRevision: null,
      fetchProgramTerms: async (programId) => {
        set({ loading: true, error: null });

        try {
          const revisions = await scholarshipProgramsService.getPublishedProgramTerms(programId);
          const selectedRevision = revisions[0] ?? null;
          set({ revisions, loading: false, selectedRevision, error: null });
          return revisions;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unable to load program terms.';
          set({ loading: false, error: message, revisions: [] });
          return [];
        }
      },
      acceptTerms: async (payload) => {
        set({ loading: true, error: null });

        try {
          const response = await scholarshipProgramsService.acceptProgramTerms({
            ...payload,
            acceptedAt: new Date().toISOString(),
          });

          const acceptedRevisionId = response.revisionId ?? payload.revisionId;
          const selectedRevision = get().revisions.find((revision) => revision.id === acceptedRevisionId) ?? null;

          set({
            loading: false,
            error: null,
            acceptedRevisionId,
            selectedRevision,
          });

          return { revisionId: acceptedRevisionId, termsVersion: response.termsVersion ?? payload.termsVersion };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unable to accept the current program terms.';
          set({ loading: false, error: message });
          return null;
        }
      },
      reset: () => set({ revisions: [], loading: false, error: null, acceptedRevisionId: null, selectedRevision: null }),
    }),
    {
      name: 'chainverse-program-terms-store',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
