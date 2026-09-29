import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createIdempotencyToken } from '../lib/server-identity';
import { awardInventoryService } from './service';
import type {
  AwardInventory,
  AwardInventoryDecision,
  AwardInventoryDecisionProposal,
  AwardInventoryState,
} from './types';

type AwardInventoryStore = AwardInventoryState & {
  fetchInventory: (programId: string) => Promise<AwardInventory | null>;
  updateInventory: (input: {
    programId: string;
    maxRecipients?: number;
    perAwardAmount?: number;
    totalBudget?: number;
    reserveAmount?: number;
    currency?: string;
    expectedVersion?: string;
  }) => Promise<AwardInventory | null>;
  /**
   * Computes a local preview, then asks the API to record it. Resolves to the
   * API's decision, or `null` when nothing was recorded (issue #1223).
   */
  submitDecision: (
    programId: string,
    requestedRecipients: number,
    requestedAmount: number
  ) => Promise<AwardInventoryDecision | null>;
  /** Local-only preview; never persisted and never given an identifier. */
  previewDecision: (
    programId: string,
    requestedRecipients: number,
    requestedAmount: number
  ) => Promise<AwardInventoryDecisionProposal | null>;
  reset: () => void;
};

export const useAwardInventoryStore = create<AwardInventoryStore>()(
  persist(
    (set, get) => ({
      inventory: null,
      loading: false,
      error: null,
      pendingProposal: null,
      lastDecision: null,
      history: [],

      fetchInventory: async (programId) => {
        set({ loading: true, error: null });

        try {
          const inventory = await awardInventoryService.getAwardInventory(programId);
          set({ inventory, loading: false, error: null });
          return inventory;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unable to load award inventory.';
          set({ loading: false, error: message, inventory: null });
          return null;
        }
      },

      updateInventory: async (input) => {
        set({ loading: true, error: null });

        try {
          const inventory = await awardInventoryService.updateAwardInventory(input);
          set({ inventory, loading: false, error: null });
          return inventory;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unable to update the award inventory.';
          set({ loading: false, error: message });
          return null;
        }
      },

      previewDecision: async (programId, requestedRecipients, requestedAmount) => {
        const inventory = get().inventory ?? (await awardInventoryService.getAwardInventory(programId));
        const proposal = awardInventoryService.proposeAwardDecision(
          inventory,
          requestedRecipients,
          requestedAmount
        );
        set({ pendingProposal: proposal });
        return proposal;
      },

      submitDecision: async (programId, requestedRecipients, requestedAmount) => {
        set({ loading: true, error: null });

        try {
          const inventory = get().inventory ?? (await awardInventoryService.getAwardInventory(programId));
          const proposal = awardInventoryService.proposeAwardDecision(
            inventory,
            requestedRecipients,
            requestedAmount
          );
          set({ pendingProposal: proposal });

          // The retry token covers this one user action. Reusing the previous
          // token would make the API replay its first outcome instead of
          // recording a genuinely new intent, so a new token is minted here.
          const decision = await awardInventoryService.recordAwardDecision(
            proposal,
            createIdempotencyToken('award.decision')
          );

          set({
            loading: false,
            pendingProposal: null,
            lastDecision: decision,
            history: [...get().history, decision],
            error:
              decision.status === 'rejected' ? decision.reason ?? 'Award decision rejected.' : null,
          });
          return decision;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'The award decision could not be recorded.';
          // `pendingProposal` is intentionally left in place: the local
          // computation is still useful. `lastDecision` stays null so nothing
          // can be read back as a server-recorded decision.
          set({ loading: false, error: message, lastDecision: null });
          return null;
        }
      },

      reset: () =>
        set({
          inventory: null,
          loading: false,
          error: null,
          pendingProposal: null,
          lastDecision: null,
          history: [],
        }),
    }),
    {
      name: 'chainverse-award-inventory-store',
      storage: createJSONStorage(() => localStorage),
      // Only server-assigned records are persisted. A pending proposal is a
      // local computation with no identifier, so writing it to storage would
      // resurrect it after a reload as if it were a decision (issue #1223).
      partialize: (state) => ({
        inventory: state.inventory,
        lastDecision: state.lastDecision,
        history: state.history,
      }),
    }
  )
);
