export type ReservationStatus = 'held' | 'released' | 'expired' | 'committed';

/** A hold placed on program budget when an award decision is approved, before applicant acceptance. */
export type BudgetReservation = {
  id: string;
  programId: string;
  applicationId: string;
  decisionId: string;
  amountCents: number;
  currency: string;
  /** ISO 8601 expiry; the hold is automatically released after this time if not committed. */
  expiresAt: string;
  status: ReservationStatus;
  /** Client-generated key — repeated calls with the same key return the existing reservation. */
  idempotencyKey: string;
  createdAt: string;
  releasedAt?: string;
  expiredAt?: string;
  committedAt?: string;
};

export type ReservationPolicy = {
  /** Maximum duration in hours a reservation may be held before automatic expiry. */
  maxHoldHours: number;
  /** Total budget ceiling for the program in cents. */
  maxBudgetCents: number;
};

export type AcquireReservationPayload = {
  programId: string;
  applicationId: string;
  decisionId: string;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
};

export type ReservationValidationError = { field: string; message: string };

export type ReservationState = {
  reservation: BudgetReservation | null;
  loading: boolean;
  error: string | null;
};
