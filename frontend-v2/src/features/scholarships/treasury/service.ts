/**
 * Treasury reconciliation domain logic and HTTP service (issue #1126).
 *
 * A reconciliation is a read-and-compare operation. It never edits balances,
 * never edits a liability, and never edits an earlier run — it only produces
 * discrepancies and alerts. Re-running with the same accounts, liabilities and
 * `asOf` yields the same run id and the same result, so the operation is safe
 * to retry.
 *
 * IDs and fingerprints no longer use client-side FNV-1a hashes (issue #1221).
 * The treasury API assigns deterministic identifiers; the client uses
 * provisional markers that cannot be mistaken for backend-assigned IDs.
 */

/** API client for the scholarship treasury. */
import { apiClient } from '@/src/lib/api-client';
import {
  PAYABLE_LIABILITY_KINDS,
  canOperateTreasury,
  type AwardGate,
  type Discrepancy,
  type Liability,
  type ReconciliationRun,
  type TreasuryAccount,
  type TreasuryPosition,
} from './types';

const TREASURY_PATH = '/scholarships/treasury';

export type CurrencyMismatch = {
  id: string;
  expectedCurrency: string;
  actualCurrency: string;
  amountCents: number;
  source: 'account' | 'liability';
};

/** Sum of every liability that increases what the treasury owes. */
export function payableLiabilityCents(liabilities: Liability[]): number {
  return liabilities
    .filter((liability) => PAYABLE_LIABILITY_KINDS.includes(liability.kind))
    .reduce((total, liability) => total + liability.amountCents, 0);
}

/**
 * Returns a provisional identifier that does not use a client-side
 * FNV-1a hash (issue #1221). The treasury API assigns deterministic
 * identifiers; this is only a local draft marker.
 */
function provisionalId(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}-provisional-${parts.join('|')}`;
}

/**
 * Rolls account balances up into a single position.
 *
 * `netCents = availableCents - payableCents`; a negative net is an insolvent
 * treasury. Balances in a currency other than the position currency are still
 * summed here (never converted) and reported separately by the API.
 */
export function treasuryPosition(accounts: TreasuryAccount[]): TreasuryPosition {
  const availableCents = accounts.reduce(
    (total, account) => total + account.availableCents,
    0
  );
  const payableCents = payableLiabilityCents(accounts);

  return {
    availableCents,
    payableCents,
    netCents: availableCents - payableCents,
    insolvent: availableCents < payableCents,
  };
}

/** The net cents change in a reconciliation run. */
export function reconciliationRunId(asOf: string, accountIds: string[]): string {
  return `run-provisional-${asOf}-${accountIds.sort().join('-')}`;
}

/** Liability kinds that increase what the treasury owes. */
const PAYABLE_LIABILITY_KINDS =
  'academic_failure' |
  'terms_violation' |
  'fraud_confirmed' |
  'program_ended' |
  'mutual_agreement';

/** Reconciliation runs are safe to retry; the same inputs always yield the same result. */
export function runReconciliation(
  asOf: string,
  accounts: TreasuryAccount[],
  liabilities: Liability[],
  asOfGate: AwardGate
): ReconciliationRun {
  const runId = reconciliationRunId(asOf, accounts.map((a) => a.id));
  const payableCents = payableLiabilityCents(liabilities);
  const position = treasuryPosition(accounts);
  const discrepancies: Discrepancy[] = [];

  for (const liability of liabilities) {
    const account = accounts.find((a) => a.id === liability.accountId);
    if (!account) {
      discrepancies.push({
        id: `disc-provisional-${liability.id}`,
        liabilityId: liability.id,
        type: 'missing-account',
        message: `Liability refers to account ${liability.accountId} that is not in the treasury snapshot.`,
        severity: 'high',
      });
      continue;
    }

    const netForAccount = account.availableCents - liability.amountCents;
    if (netForAccount < 0) {
      discrepancies.push({
        id: `disc-provisional-${liability.id}`,
        liabilityId: liability.id,
        type: 'insufficient-funds',
        message: `Liability of ${liability.amountCents} exceeds available ${account.availableCents} for account ${liability.accountId}.`,
        severity: 'high',
      });
    }
  }

  return {
    runId,
    asOf,
    payableCents,
    position,
    discrepancies,
  };
}

/** Treasury service for API interactions. */
export const treasuryService = {
  listAccounts: (): Promise<TreasuryAccount[]> =>
    apiClient.get<TreasuryAccount[]>(`${TREASURY_PATH}/accounts`),

  listLiabilities: (): Promise<Liability[]> =>
    apiClient.get<Liability[]>(`${TREASURY_PATH}/liabilities`),

  listAwardGates: (): Promise<AwardGate[]> =>
    apiClient.get<AwardGate[]>(`${TREASURY_PATH}/award-gates`),

  listReconciliationRuns: (): Promise<ReconciliationRun[]> =>
    apiClient.get<ReconciliationRun[]>(`${TREASURY_PATH}/reconciliation-runs`),

  createReconciliationRun: (input: {
    asOf: string;
    accountIds: string[];
    liabilityIds: string[];
    gate: AwardGate;
  }): Promise<ReconciliationRun> =>
    apiClient.post<ReconciliationRun>(`${TREASURY_PATH}/reconciliation-runs`, input),
};