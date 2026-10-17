import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { trustIndicatorService } from './service';
import { computeTrustIndicators } from './indicators';
import type { StudentTrustProfile } from './types';

export type TrustProfileState = 'idle' | 'loading' | 'success' | 'error';

type TrustStoreState = {
  profile: StudentTrustProfile | null;
  status: TrustProfileState;
  error: string | null;
  compute: () => Promise<StudentTrustProfile>;
  load: (studentId: string) => Promise<StudentTrustProfile>;
};

export const useTrustStore = create<TrustStoreState>()(
  persist(
    (set, get) => ({
      profile: null,
      status: 'idle',
      error: null,
      compute: async () => {
        set({ status: 'loading', error: null });
        try {
          const profile = computeTrustIndicators('current-student', {});
          set({ profile, status: 'success' });
          return profile;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unable to compute trust indicators.';
          set({ status: 'error', error: message });
          throw error;
        }
      },
      load: async (studentId: string) => {
        set({ status: 'loading', error: null });
        try {
          const profile = await trustIndicatorService.getProfile(studentId);
          set({ profile, status: 'success' });
          return profile;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unable to load the trust profile.';
          set({ status: 'error', error: message });
          throw error;
        }
      },
    }),
    {
      name: 'chainverse-mentor-trust',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
