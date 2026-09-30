import { create } from 'zustand';
import type { WithdrawalRecord } from './types';

type WithdrawalStore = {
  /** The most recently acknowledged withdrawal, for the confirmation view. */
  withdrawal: WithdrawalRecord | null;
  setWithdrawal: (record: WithdrawalRecord | null) => void;
  reset: () => void;
};

/**
 * @deprecated Use `useRequestWithdrawal` from `./hooks` (#1227).
 *
 * This store used to own the request itself and persisted both the record and a
 * hand-rolled `scholarship-withdrawal-history` array in `localStorage` under
 * keys that were not scoped to a user, so a second person signing in on the same
 * browser could read the previous applicant's withdrawal. The request now lives
 * in a TanStack mutation under the identity-scoped scholarship key, and this
 * store is session-only — it is never persisted and never calls the network.
 */
export const useScholarshipWithdrawalStore = create<WithdrawalStore>()((set) => ({
  withdrawal: null,
  setWithdrawal: (record) => set({ withdrawal: record }),
  reset: () => set({ withdrawal: null }),
}));
