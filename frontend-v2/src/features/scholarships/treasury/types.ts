/**
 * Treasury balances, liabilities, and reconciliation (issue #1126).
 *
 * Money is integer minor units with an explicit `currency` on every value and
 * every line. A reconciliation run is an immutable snapshot: re-running appends
 * a new run and never mutates an earlier one.
 */

export type TreasuryAccountKind =
  | 'program-pool'
  | 'unrestricted-pool'
  | 'operating'
  | 'reserve';

export type TreasuryAccount = {
  id: string;
  programId?: string;
  kind: TreasuryAccountKind;
  availableCents: number;
  reservedCents: number;
  payableCents: number;
  currency: string;
  asOf: string;
};

export type LiabilityKind =
  | 'committed-award'
  | 'accepted-award'
  | 'scheduled-payment'
  | 'refund-payable'
  | 'recovery-receivable';

export type Liability = {
  id: string;
  programId: string;
  kind: LiabilityKind;
  amountCents: number;
  currency: string;
  dueAt?: string;
  createdAt: string;
};

export type TreasuryPosition = {
  availableCents: number;
  reservedCents: number;
  payableCents: number;
  netCents: number;
  currency: string;
  accounts: TreasuryAccount[];
};

export type DiscrepancyKind =
  | 'account-mismatch'
  | 'unrecorded-liability'
  | 'currency-mismatch'
  | 'stale-source'
  | 'variance';

export type Discrepancy = {
  id: string;
  kind: DiscrepancyKind;
  expectedCents: number;
  actualCents: number;
  varianceCents: number;
  currency: string;
  description: string;
  alertId: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
};

export type ReconciliationStatus = 'running' | 'balanced' | 'drifted' | 'insolvent';

export type ReconciliationRun = {
  id: string;
  asOf: string;
  startedAt: string;
  completedAt: string;
  position: TreasuryPosition;
  liabilities: Liability[];
  balanced: boolean;
  varianceCents: number;
  discrepancies: Discrepancy[];
  status: ReconciliationStatus;
  approvedBy?: string;
  approvedAt?: string;
};

export type AwardGate = {
  allowed: boolean;
  blockingDiscrepancyIds: string[];
  reason: string;
};

/** Kinds of liability that increase what the treasury owes. */
export const PAYABLE_LIABILITY_KINDS: readonly LiabilityKind[] = [
  'committed-award',
  'accepted-award',
  'scheduled-payment',
  'refund-payable',
];

/** Kinds of liability that increase what the treasury expects to receive back. */
export const RECEIVABLE_LIABILITY_KINDS: readonly LiabilityKind[] = ['recovery-receivable'];

/** Roles permitted to operate the treasury surface. */
export const TREASURY_ROLES: readonly string[] = ['finance', 'sponsor', 'administrator'];

export function canOperateTreasury(role?: string): boolean {
  if (!role) return false;
  return TREASURY_ROLES.includes(role);
}
