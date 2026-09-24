import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { scholarshipWithdrawalService } from './service';
import type { WithdrawalRecord, WithdrawalRequest, WithdrawalState } from './types';

type WithdrawalStore = WithdrawalState & {
  requestWithdrawal: (request: WithdrawalRequest) => Promise<WithdrawalRecord | null>;
  reset: () => void;
};

export const useScholarshipWithdrawalStore = create<WithdrawalStore>()(
  persist(
    (set) => ({
      withdrawal: null,
      loading: false,
      error: null,
      history: [],
      requestWithdrawal: async (request) => {
        set({ loading: true, error: null });

        try {
          const record = await scholarshipWithdrawalService.submitWithdrawal(request);
          set({
            withdrawal: record,
            loading: false,
            error: null,
            history: [record, ...((typeof window !== 'undefined' && localStorage.getItem('scholarship-withdrawal-history')) ? JSON.parse(localStorage.getItem('scholarship-withdrawal-history') ?? '[]') : [])],
          });
          return record;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unable to submit withdrawal request.';
          set({ loading: false, error: message });
          return null;
        }
      },
      reset: () => set({ withdrawal: null, loading: false, error: null, history: [] }),
    }),
    {
      name: 'chainverse-withdrawal-store',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
