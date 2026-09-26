/**
 * Refunds, returned payments, and their reversals (issue #1129).
 *
 * Authority is derived from the caller's role, never from client input alone.
 * A refund that would leave the treasury unable to cover its payables is
 * blocked. A settled payment is reversed, never deleted: the original ledger
 * entry stays and is linked to its reversal.
 */

export type RefundTrigger =
  | 'sponsor-request'
  | 'rejected-transfer'
  | 'overpayment'
  | 'unused-program-balance'
  | 'duplicate-deposit';

export type RefundStatus =
  | 'requested'
  | 'authorized'
  | 'processing'
  | 'settled'
  | 'rejected'
  | 'reversed';

export type RefundAuthority = 'sponsor' | 'finance' | 'administrator' | 'none';

export type RefundRequest = {
  id: string;
  programId: string;
  sponsorId: string;
  trigger: RefundTrigger;
  amountCents: number;
  currency: string;
  assetCode: string;
  destinationAccountId: string;
  status: RefundStatus;
  requestedBy: string;
  requestedAt: string;
  authorizedBy?: string;
  authorizedAt?: string;
  settledAt?: string;
  reason: string;
  clientToken: string;
};

export type ReversalEntry = {
  id: string;
  originalEntryId: string;
  entryType: 'debit' | 'credit';
  amountCents: number;
  currency: string;
  ledgerEntryId: string;
  occurredAt: string;
  memo: string;
  reversesEntryId: string;
};

/** The immutable ledger entry that a reversal points back to. */
export type LedgerEntry = {
  id: string;
  entryType: 'debit' | 'credit';
  amountCents: number;
  currency: string;
  programId: string;
  memo: string;
  occurredAt: string;
  reversesEntryId?: string;
};

export type SolvencyCheck = {
  solvent: boolean;
  availableCents: number;
  payableCents: number;
  shortfallCents: number;
  currency: string;
  blockedDiscrepancyIds: string[];
};

/** The single currency a refund may be denominated in. */
export const REFUND_CURRENCY = 'USD';

export const REFUND_TRIGGERS: readonly RefundTrigger[] = [
  'sponsor-request',
  'rejected-transfer',
  'overpayment',
  'unused-program-balance',
  'duplicate-deposit',
];

export const REFUND_ROLES: readonly string[] = ['sponsor', 'finance', 'administrator'];
