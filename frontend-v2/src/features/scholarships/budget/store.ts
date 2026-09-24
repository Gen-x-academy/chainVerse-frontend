import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { awardInventoryService } from './service';
import type { AwardInventory, AwardInventoryDecision, AwardInventoryState } from './types';

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
  submitDecision: (programId: string, requestedRecipients: number, requestedAmount: number) => Promise<AwardInventoryDecision | null>;
  reset: () => void;
};

export const useAwardInventoryStore = create<AwardInventoryStore>()(
  persist(
    (set, get) => ({
      inventory: null,
      loading: false,
      error: null,
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
      submitDecision: async (programId, requestedRecipients, requestedAmount) => {
        set({ loading: true, error: null });

        try {
          const inventory = get().inventory ?? (await awardInventoryService.getAwardInventory(programId));
          const decision = awardInventoryService.evaluateAwardDecision(inventory, requestedRecipients, requestedAmount);
          const history = [...get().history, decision];
          set({
            loading: false,
            lastDecision: decision,
            history,
            error: decision.status === 'rejected' ? decision.reason ?? 'Award decision rejected.' : null,
          });
          return decision;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unable to process the award decision.';
          set({ loading: false, error: message });
          return null;
        }
      },
      reset: () => set({ inventory: null, loading: false, error: null, lastDecision: null, history: [] }),
    }),
    {
      name: 'chainverse-award-inventory-store',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
