import { create } from 'zustand';
import { budgetReservationService } from './service';
import type { BudgetReservation, AcquireReservationPayload, ReservationState } from './types';

type BudgetReservationStore = ReservationState & {
  acquire: (payload: AcquireReservationPayload) => Promise<BudgetReservation | null>;
  release: (reservationId: string) => Promise<BudgetReservation | null>;
  commit: (reservationId: string) => Promise<BudgetReservation | null>;
  reset: () => void;
};

export const useBudgetReservationStore = create<BudgetReservationStore>()((set) => ({
  reservation: null,
  loading: false,
  error: null,

  acquire: async (payload) => {
    set({ loading: true, error: null });
    try {
      const reservation = await budgetReservationService.acquire(payload);
      set({ reservation, loading: false, error: null });
      return reservation;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to reserve budget.';
      set({ loading: false, error: message });
      return null;
    }
  },

  release: async (reservationId) => {
    set({ loading: true, error: null });
    try {
      const reservation = await budgetReservationService.release(reservationId);
      set({ reservation, loading: false, error: null });
      return reservation;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to release reservation.';
      set({ loading: false, error: message });
      return null;
    }
  },

  commit: async (reservationId) => {
    set({ loading: true, error: null });
    try {
      const reservation = await budgetReservationService.commit(reservationId);
      set({ reservation, loading: false, error: null });
      return reservation;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to commit reservation.';
      set({ loading: false, error: message });
      return null;
    }
  },

  reset: () => set({ reservation: null, loading: false, error: null }),
}));
