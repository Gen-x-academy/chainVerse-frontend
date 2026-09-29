/**
 * On-chain settlement reconciliation (issue #1164).
 *
 * Award and payment intents recorded by the backend are reconciled against the
 * authoritative Soroban/Stellar transactions. The UI only shows a payment as
 * confirmed when the matching ledger transaction is final (past the configured
 * finality depth) and every field agrees; anything else is surfaced as a
 * mismatch for an operator to resolve.
 */

import { apiClient } from '@/src/lib/api-client';

export type SettlementStatus = 'pending' | 'submitted' | 'confirmed' | 'failed';

export type SettlementIntent = {
  id: string;
  awardId: string;
  amount: string;
  asset: string;
  destination: string;
  status: SettlementStatus;
  txHash?: string;
};

export type LedgerTransaction = {
  hash: string;
  successful: boolean;
  ledger: number;
  memo?: string;
  amount: string;
  asset: string;
  destination: string;
};

/** Number of ledgers that must pass before a transaction is considered final. */
export const FINALITY_LEDGER_DEPTH = 2;

export type SettlementMismatchCode =
  | 'MISSING_TRANSACTION'
  | 'TRANSACTION_FAILED'
  | 'NOT_FINAL'
  | 'AMOUNT_MISMATCH'
  | 'ASSET_MISMATCH'
  | 'DESTINATION_MISMATCH';

export type SettlementReconciliation = {
  intentId: string;
  awardId: string;
  reconciledStatus: SettlementStatus;
  final: boolean;
  txHash?: string;
  mismatches: SettlementMismatchCode[];
  checkedAt: string;
};

export function isLedgerFinal(transaction: LedgerTransaction, latestLedger: number): boolean {
  return transaction.successful && latestLedger - transaction.ledger >= FINALITY_LEDGER_DEPTH;
}

export function reconcileSettlement(
  intent: SettlementIntent,
  transactions: LedgerTransaction[],
  latestLedger: number,
  now: Date = new Date()
): SettlementReconciliation {
  const transaction = intent.txHash
    ? transactions.find((candidate) => candidate.hash === intent.txHash)
    : transactions.find(
        (candidate) => candidate.memo === intent.id || candidate.memo === intent.awardId
      );

  if (!transaction) {
    return {
      intentId: intent.id,
      awardId: intent.awardId,
      reconciledStatus: 'pending',
      final: false,
      mismatches: ['MISSING_TRANSACTION'],
      checkedAt: now.toISOString(),
    };
  }

  const mismatches: SettlementMismatchCode[] = [];
  if (!transaction.successful) mismatches.push('TRANSACTION_FAILED');
  if (transaction.amount !== intent.amount) mismatches.push('AMOUNT_MISMATCH');
  if (transaction.asset !== intent.asset) mismatches.push('ASSET_MISMATCH');
  if (transaction.destination !== intent.destination) mismatches.push('DESTINATION_MISMATCH');

  const final = isLedgerFinal(transaction, latestLedger);
  if (transaction.successful && !final) mismatches.push('NOT_FINAL');

  const reconciledStatus: SettlementStatus = !transaction.successful
    ? 'failed'
    : final && mismatches.length === 0
      ? 'confirmed'
      : 'submitted';

  return {
    intentId: intent.id,
    awardId: intent.awardId,
    reconciledStatus,
    final,
    txHash: transaction.hash,
    mismatches,
    checkedAt: now.toISOString(),
  };
}

export function reconcileAllSettlements(
  intents: SettlementIntent[],
  transactions: LedgerTransaction[],
  latestLedger: number,
  now: Date = new Date()
): SettlementReconciliation[] {
  return intents.map((intent) => reconcileSettlement(intent, transactions, latestLedger, now));
}

/** Reprocessing the same intents never creates a second settlement outcome. */
export function groupReconciliationsByIntent(
  reconciliations: SettlementReconciliation[]
): Record<string, SettlementReconciliation> {
  const byIntent: Record<string, SettlementReconciliation> = {};
  for (const reconciliation of reconciliations) {
    byIntent[reconciliation.intentId] = reconciliation;
  }
  return byIntent;
}

export const scholarshipSettlementService = {
  reconcile: (awardId: string): Promise<SettlementReconciliation[]> =>
    apiClient.get<SettlementReconciliation[]>(`/scholarships/awards/${awardId}/settlement`),

  acknowledgeMismatches: (
    awardId: string,
    intentIds: string[]
  ): Promise<{ acknowledged: string[] }> =>
    apiClient.post<{ acknowledged: string[] }>(
      `/scholarships/awards/${awardId}/settlement/acknowledge`,
      { intentIds }
    ),
};

// ---------------------------------------------------------------------------
// Per-program financial ledgers (#1125)
// ---------------------------------------------------------------------------

/**
 * Amounts are carried as strings because Stellar amounts are int64 and exceed
 * the safe integer range in JavaScript. Every arithmetic check below goes
 * through `amountToBigInt` so a balance is never decided by float rounding.
 */
export type LedgerAccountKind =
  | 'funding'
  | 'reserved'
  | 'awarded'
  | 'disbursed'
  | 'refunded'
  | 'recovered'
  | 'adjustment';

export type LedgerAccount = {
  programId: string;
  code: string;
  kind: LedgerAccountKind;
  asset: string;
};

export type LedgerDirection = 'debit' | 'credit';

export type LedgerLeg = {
  accountCode: string;
  direction: LedgerDirection;
  /** Non-negative integer amount in the account's asset units. */
  amount: string;
};

export type JournalEntryKind =
  | 'funding'
  | 'reservation'
  | 'award'
  | 'disbursement'
  | 'refund'
  | 'recovery'
  | 'adjustment';

export type JournalEntry = {
  /** Unique, caller-supplied reference — e.g. the intent or award ID. */
  reference: string;
  programId: string;
  kind: JournalEntryKind;
  asset: string;
  occurredAtUtc: string;
  legs: LedgerLeg[];
  memo?: string;
};

export class UnbalancedJournalEntryError extends Error {
  readonly code = 'UNBALANCED_JOURNAL_ENTRY';

  constructor(readonly difference: string) {
    super(`Journal entry does not balance. Debits and credits differ by ${difference}.`);
    this.name = 'UnbalancedJournalEntryError';
  }
}

export class DuplicateJournalReferenceError extends Error {
  readonly code = 'DUPLICATE_JOURNAL_REFERENCE';

  constructor(readonly reference: string) {
    super(`Journal reference "${reference}" has already been recorded.`);
    this.name = 'DuplicateJournalReferenceError';
  }
}

/** Parse a decimal integer string into a bigint, rejecting anything lossy. */
export function amountToBigInt(amount: string): bigint {
  if (!/^\d+$/.test(amount)) {
    throw new Error(`Amount "${amount}" is not a non-negative integer string.`);
  }
  return BigInt(amount);
}

/** A journal entry balances when its total debits equal its total credits. */
export function isBalanced(entry: JournalEntry): boolean {
  let debits = 0n;
  let credits = 0n;
  for (const leg of entry.legs) {
    const value = amountToBigInt(leg.amount);
    if (leg.direction === 'debit') debits += value;
    else credits += value;
  }
  return debits === credits;
}

function assertEntryShape(entry: JournalEntry): void {
  if (entry.legs.length < 2) {
    throw new Error('A double-entry journal entry needs at least two legs.');
  }

  const assets = new Set(entry.legs.map(() => entry.asset));
  if (assets.size > 1) {
    throw new Error('All legs of a journal entry must share the entry asset.');
  }

  let debits = 0n;
  let credits = 0n;
  for (const leg of entry.legs) {
    const value = amountToBigInt(leg.amount);
    if (value === 0n) {
      throw new Error(`Leg for account "${leg.accountCode}" has a zero amount.`);
    }
    if (leg.direction === 'debit') debits += value;
    else credits += value;
  }

  if (debits !== credits) {
    throw new UnbalancedJournalEntryError((debits - credits).toString());
  }
}

/**
 * Append an entry to the ledger, refusing duplicates and unbalanced entries.
 *
 * Both invariants from the acceptance criteria are enforced at write time
 * rather than at read time, so an invalid ledger cannot be constructed.
 */
export function recordJournalEntry(
  ledger: JournalEntry[],
  entry: JournalEntry
): JournalEntry[] {
  if (ledger.some((existing) => existing.reference === entry.reference)) {
    throw new DuplicateJournalReferenceError(entry.reference);
  }
  assertEntryShape(entry);
  return [...ledger, entry];
}

/** Net balance per account code, derived from the recorded legs. */
export function deriveProgramBalances(ledger: JournalEntry[]): Record<string, string> {
  const totals: Record<string, bigint> = {};
  for (const entry of ledger) {
    for (const leg of entry.legs) {
      const value = amountToBigInt(leg.amount);
      const signed = leg.direction === 'debit' ? value : -value;
      totals[leg.accountCode] = (totals[leg.accountCode] ?? 0n) + signed;
    }
  }

  const out: Record<string, string> = {};
  for (const [code, total] of Object.entries(totals)) {
    out[code] = total.toString();
  }
  return out;
}

export type LedgerReconciliation = {
  programId: string;
  /** Sum of every disbursement intent recorded for the program. */
  expectedDisbursed: string;
  /** Sum of the `disbursed` legs in the ledger. */
  ledgerDisbursed: string;
  balanced: boolean;
  difference: string;
  unreferencedIntents: string[];
};

/**
 * Reconcile derived ledger balances against externally-recorded settlement
 * intents, so a derived balance can be checked against real assets rather than
 * trusted.
 */
export function reconcileProgramLedger(
  programId: string,
  accounts: LedgerAccount[],
  ledger: JournalEntry[],
  intents: SettlementIntent[]
): LedgerReconciliation {
  const programAccounts = accounts.filter((account) => account.programId === programId);
  const disbursedCodes = new Set(
    programAccounts.filter((account) => account.kind === 'disbursed').map((account) => account.code)
  );

  const programEntries = ledger.filter((entry) => entry.programId === programId);

  let expected = 0n;
  const unreferenced: string[] = [];

  for (const intent of intents) {
    const entry = programEntries.find((candidate) => candidate.reference === intent.id);
    if (!entry) {
      unreferenced.push(intent.id);
      continue;
    }
    expected += amountToBigInt(intent.amount);
  }

  let ledgerDisbursed = 0n;
  for (const entry of programEntries) {
    if (entry.kind !== 'disbursement') continue;
    for (const leg of entry.legs) {
      if (disbursedCodes.has(leg.accountCode) && leg.direction === 'debit') {
        ledgerDisbursed += amountToBigInt(leg.amount);
      }
    }
  }

  const difference = ledgerDisbursed - expected;

  return {
    programId,
    expectedDisbursed: expected.toString(),
    ledgerDisbursed: ledgerDisbursed.toString(),
    balanced: difference === 0n && unreferenced.length === 0,
    difference: difference.toString(),
    unreferencedIntents: unreferenced,
  };
}

// ---------------------------------------------------------------------------
// Recipient payment receipts (#1124)
// ---------------------------------------------------------------------------

/**
 * A durable recipient receipt.
 *
 * Only the fields below are ever written. Application answers, documents and
 * any other private submission data are deliberately not part of this shape,
 * and `buildPaymentReceipt` picks fields explicitly rather than spreading a
 * source object, so a new private field cannot leak in by accident.
 */
export type PaymentReceipt = {
  /** Server-signed receipt identifier. Never generated in the browser. */
  receiptId: string;
  awardId: string;
  programId: string;
  installment: number;
  asset: string;
  amount: string;
  network: string;
  txHash: string;
  completedAtUtc: string;
  /** Explorer link the recipient can verify independently. */
  evidenceUrl: string;
  checksum: string;
};

export type PaymentReceiptInput = {
  receiptId: string;
  awardId: string;
  programId: string;
  installment: number;
  asset: string;
  amount: string;
  network: string;
  reconciliation: SettlementReconciliation;
  explorerUrlFor: (txHash: string) => string;
};

/**
 * Build a receipt from a confirmed reconciliation.
 *
 * Refuses to build one for a payment that is not confirmed and final, so a
 * receipt can never imply funds were released when they were not.
 */
export function buildPaymentReceipt(input: PaymentReceiptInput): PaymentReceipt {
  if (input.reconciliation.reconciledStatus !== 'confirmed' || !input.reconciliation.final) {
    throw new Error(
      'A receipt can only be issued for a confirmed, final settlement with no outstanding mismatches.'
    );
  }

  const txHash = input.reconciliation.txHash;
  if (!txHash) {
    throw new Error('A receipt requires a transaction hash as verifiable evidence.');
  }

  const receipt: PaymentReceipt = {
    receiptId: input.receiptId,
    awardId: input.awardId,
    programId: input.programId,
    installment: input.installment,
    asset: input.asset,
    amount: input.amount,
    network: input.network,
    txHash,
    completedAtUtc: input.reconciliation.checkedAt,
    evidenceUrl: input.explorerUrlFor(txHash),
    checksum: '',
  };

  receipt.checksum = receiptChecksum(receipt);
  return receipt;
}

/** Stable checksum over the receipt's substantive fields. */
export function receiptChecksum(receipt: PaymentReceipt): string {
  const parts = [
    receipt.receiptId,
    receipt.awardId,
    receipt.programId,
    String(receipt.installment),
    receipt.asset,
    receipt.amount,
    receipt.network,
    receipt.txHash,
    receipt.completedAtUtc,
  ];
  return parts.join('|');
}

export function verifyReceiptChecksum(receipt: PaymentReceipt): boolean {
  return receipt.checksum === receiptChecksum(receipt);
}

export const scholarshipFinanceService = {
  listLedger: (programId: string): Promise<JournalEntry[]> =>
    apiClient.get<JournalEntry[]>(
      `/scholarships/programs/${encodeURIComponent(programId)}/ledger`
    ),

  recordEntry: (programId: string, entry: JournalEntry): Promise<JournalEntry> =>
    apiClient.post<JournalEntry>(
      `/scholarships/programs/${encodeURIComponent(programId)}/ledger`,
      entry
    ),

  listReceipts: (awardId: string): Promise<PaymentReceipt[]> =>
    apiClient.get<PaymentReceipt[]>(
      `/scholarships/awards/${encodeURIComponent(awardId)}/receipts`
    ),
};
