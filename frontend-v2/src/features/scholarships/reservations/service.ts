import { apiClient } from '@/src/lib/api-client';
import type {
  BudgetReservation,
  AcquireReservationPayload,
  ReservationPolicy,
} from './types';

export const budgetReservationService = {
  acquire: (payload: AcquireReservationPayload): Promise<BudgetReservation> =>
    apiClient.post<BudgetReservation>('/scholarships/budget-reservations', payload),

  get: (reservationId: string): Promise<BudgetReservation> =>
    apiClient.get<BudgetReservation>(
      `/scholarships/budget-reservations/${encodeURIComponent(reservationId)}`
    ),

  listByProgram: (programId: string): Promise<BudgetReservation[]> =>
    apiClient.get<BudgetReservation[]>(
      `/scholarships/programs/${encodeURIComponent(programId)}/budget-reservations`
    ),

  release: (reservationId: string): Promise<BudgetReservation> =>
    apiClient.post<BudgetReservation>(
      `/scholarships/budget-reservations/${encodeURIComponent(reservationId)}/release`,
      {}
    ),

  commit: (reservationId: string): Promise<BudgetReservation> =>
    apiClient.post<BudgetReservation>(
      `/scholarships/budget-reservations/${encodeURIComponent(reservationId)}/commit`,
      {}
    ),

  getPolicy: (programId: string): Promise<ReservationPolicy> =>
    apiClient.get<ReservationPolicy>(
      `/scholarships/programs/${encodeURIComponent(programId)}/reservation-policy`
    ),
};
