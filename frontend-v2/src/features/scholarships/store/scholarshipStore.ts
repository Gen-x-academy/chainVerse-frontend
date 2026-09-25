import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { scholarshipService } from '../services/scholarship.service';
import type {
  ScholarshipApplicationInput,
  ScholarshipApplicationRecord,
  ScholarshipSubmissionReceipt,
} from '../types';

export type ScholarshipStoreStatus = 'idle' | 'loading' | 'success' | 'error';

type ScholarshipStoreState = {
  application: ScholarshipApplicationRecord | null;
  receipt: ScholarshipSubmissionReceipt | null;
  status: ScholarshipStoreStatus;
  error: string | null;
  submitApplication: (input: ScholarshipApplicationInput) => Promise<ScholarshipSubmissionReceipt>;
  reset: () => void;
};

export const useScholarshipStore = create<ScholarshipStoreState>()(
  persist(
    (set) => ({
      application: null,
      receipt: null,
      status: 'idle',
      error: null,
      submitApplication: async (input) => {
        set({ status: 'loading', error: null });

        try {
          const result = await scholarshipService.submitApplication(input);
          set({
            application: result.application,
            receipt: result.receipt,
            status: 'success',
            error: null,
          });
          return result.receipt;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unable to submit scholarship application.';
          set({ status: 'error', error: message });
          throw error;
        }
      },
      reset: () => set({ application: null, receipt: null, status: 'idle', error: null }),
    }),
    {
      name: 'chainverse-scholarship-store',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
