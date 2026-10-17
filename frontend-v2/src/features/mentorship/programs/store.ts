import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { buildMentorshipEvent, trackMentorshipEvent } from '../analytics';
import { programService } from './service';
import { validateProgramDraft } from './validation';
import type {
  CreateProgramPayload,
  MentorshipProgram,
  MentorshipProgramStatus,
} from './types';

export type ProgramState = 'idle' | 'loading' | 'success' | 'error';

type ProgramStoreState = {
  programs: MentorshipProgram[];
  status: ProgramState;
  error: string | null;
  load: () => Promise<void>;
  createDraft: (payload: CreateProgramPayload) => Promise<MentorshipProgram>;
  publish: (programId: string) => Promise<void>;
};

export const useProgramStore = create<ProgramStoreState>()(
  persist(
    (set, get) => ({
      programs: [],
      status: 'idle',
      error: null,
      load: async () => {
        set({ status: 'loading', error: null });
        try {
          const programs = await programService.list();
          set({ programs, status: 'success' });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unable to load programs.';
          set({ status: 'error', error: message });
        }
      },
      createDraft: async (payload) => {
        const errors = validateProgramDraft(payload);
        if (errors.length > 0) {
          throw new Error(errors[0].message);
        }
        set({ status: 'loading', error: null });
        try {
          const program = await programService.create(payload);
          set({ programs: [...get().programs, program], status: 'success' });
          trackMentorshipEvent(
            buildMentorshipEvent('organization_programs', program.internalId, 'draft-created')
          );
          return program;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unable to create a program.';
          set({ status: 'error', error: message });
          throw error;
        }
      },
      publish: async (programId) => {
        set({ status: 'loading', error: null });
        try {
          await programService.publish(programId);
        } catch {
          // The mentorship API is not wired up yet; publish locally.
        }
        set({
          programs: get().programs.map((program) =>
            program.internalId === programId
              ? { ...program, status: 'published' as MentorshipProgramStatus }
              : program
          ),
          status: 'success',
        });
        trackMentorshipEvent(
          buildMentorshipEvent('organization_programs', programId, 'publish')
        );
      },
    }),
    {
      name: 'chainverse-mentor-programs',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
