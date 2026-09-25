/** Patron-facing library account types (issue #1057). */

export type PatronAccountTab =
  | 'overview'
  | 'loans'
  | 'holds'
  | 'fines'
  | 'activity'
  | 'settings';

/** Authoritative balances — always in backend minor units with explicit currency. */
export interface AccountSummary {
  activeLoans: number;
  pendingHolds: number;
  totalCheckouts: number;
  outstandingFinesCents: number;
  currency: string;
}

export interface AccountLoan {
  id: string;
  bookId: string;
  title: string;
  currentDueDate: string;
  newDueDatePreview?: string;
  renewalsUsed: number;
  maxRenewals: number;
  isOverdue: boolean;
  canRenew: boolean;
  blockReason?: 'max-renewals-reached' | 'hold-pending' | 'overdue-fines' | 'policy-restriction' | 'course-linked-limit';
  blockMessage?: string;
}

export interface AccountHold {
  bookId: string;
  bookTitle: string;
  position: number;
  totalHolders: number;
  estimatedWait?: string;
  status: 'waiting' | 'ready' | 'expired';
}

export interface AccountFine {
  id: string;
  bookId?: string;
  title?: string;
  amountCents: number;
  currency: string;
  reason?: string;
  accruedAt: string;
}

export type FinesLedgerEntryKind =
  | 'fine'
  | 'replacement'
  | 'waiver'
  | 'payment'
  | 'refund'
  | 'adjustment';

export interface AccountLedgerEntry {
  id: string;
  kind: FinesLedgerEntryKind;
  amountCents: number;
  currency: string;
  createdAt: string;
  reference: string;
}

export interface AccountNotification {
  id: string;
  type:
    | 'checkout'
    | 'due'
    | 'overdue'
    | 'hold'
    | 'renewal'
    | 'fine'
    | 'payment'
    | 'license'
    | 'reading-list';
  message: string;
  href?: string;
  read: boolean;
}

export interface AccountAutoRenewal {
  enabled: boolean;
  notifyBeforeRenewal: boolean;
  notifyOnFailure: boolean;
}

export interface RenewLoanResult {
  success: boolean;
  newDueDate?: string;
  error?: string;
}

export interface PayFinesResult {
  success: boolean;
  txHash?: string;
  error?: string;
}