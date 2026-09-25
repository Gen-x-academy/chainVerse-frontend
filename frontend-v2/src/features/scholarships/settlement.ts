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
