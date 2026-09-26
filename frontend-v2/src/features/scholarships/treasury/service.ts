/**
 * Treasury reconciliation domain logic and HTTP service (issue #1126).
 *
 * A reconciliation is a read-and-compare operation. It never edits balances,
 * never edits a liability, and never edits an earlier run — it only produces
 * discrepancies and alerts. Re-running with the same accounts, liabilities and
 * `asOf` yields the same run id and the same result, so the operation is safe
 * to retry.
 */

import { apiClient } from '@/src/lib/api-client';
import { auditFingerprint } from '../audit';
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

function stableId(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}-${auditFingerprint(parts.join('|'))}`;
}

/**
 * Rolls account balances up into a single position.
 *
 * `netCents = availableCents - payableCents`; a negative net is an insolvent
 * treasury. Balances in a currency other than the position currency are still
 * summed here (never converted) and reported separately by
 * `detectCurrencyMismatch` — we never mix currencies.
 */
export function computePosition(accounts: TreasuryAccount[]): TreasuryPosition {
  if (accounts.length === 0) {
    return {
      availableCents: 0,
      reservedCents: 0,
      payableCents: 0,
      netCents: 0,
      currency: '',
      accounts: [],
    };
  }

  const availableCents = accounts.reduce((total, a) => total + a.availableCents, 0);
  const reservedCents = accounts.reduce((total, a) => total + a.reservedCents, 0);
  const payableCents = accounts.reduce((total, a) => total + a.payableCents, 0);

  return {
    availableCents,
    reservedCents,
    payableCents,
    netCents: availableCents - payableCents,
    currency: accounts[0].currency,
    accounts: [...accounts],
  };
}

/** Every account or liability denominated in a currency other than the position currency. */
export function detectCurrencyMismatch(
  position: TreasuryPosition,
  liabilities: Liability[]
): CurrencyMismatch[] {
  const expectedCurrency = position.currency;
  if (!expectedCurrency) return [];

  const mismatches: CurrencyMismatch[] = [];

  for (const account of position.accounts) {
    if (account.currency !== expectedCurrency) {
      mismatches.push({
        id: stableId('currency-account', account.id, account.currency),
        expectedCurrency,
        actualCurrency: account.currency,
        amountCents: account.availableCents,
        source: 'account',
      });
    }
  }

  for (const liability of liabilities) {
    if (liability.currency !== expectedCurrency) {
      mismatches.push({
        id: stableId('currency-liability', liability.id, liability.currency),
        expectedCurrency,
        actualCurrency: liability.currency,
        amountCents: liability.amountCents,
        source: 'liability',
      });
    }
  }

  return mismatches;
}

function accountIndex(accounts: TreasuryAccount[]): Record<string, TreasuryAccount> {
  const index: Record<string, TreasuryAccount> = {};
  for (const account of accounts) index[account.id] = account;
  return index;
}

function liabilityIndex(liabilities: Liability[]): Record<string, Liability> {
  const index: Record<string, Liability> = {};
  for (const liability of liabilities) index[liability.id] = liability;
  return index;
}

/**
 * Compares the current position and liability book against the previous run and
 * reports every difference. This function is pure and read-only: it produces
 * discrepancies and alert ids, it never corrects a balance.
 */
export function collectDiscrepancies(
  position: TreasuryPosition,
  liabilities: Liability[],
  previousRun?: ReconciliationRun
): Discrepancy[] {
  const discrepancies: Discrepancy[] = [];
  const currency = position.currency || 'UNKNOWN';

  // 1. Currencies that do not match the position currency.
  for (const mismatch of detectCurrencyMismatch(position, liabilities)) {
    discrepancies.push({
      id: stableId('discrepancy', mismatch.id),
      kind: 'currency-mismatch',
      expectedCents: mismatch.amountCents,
      actualCents: 0,
      varianceCents: mismatch.amountCents,
      currency: mismatch.actualCurrency,
      description: `${mismatch.source} ${mismatch.id} is denominated in ${mismatch.actualCurrency} but the position is ${mismatch.expectedCurrency}. Currencies are never converted or combined.`,
      alertId: stableId('alert', mismatch.id),
    });
  }

  // 2. Accounts whose own reservations and payables exceed what they hold.
  for (const account of position.accounts) {
    const committedCents = account.reservedCents + account.payableCents;
    if (account.availableCents < committedCents) {
      const varianceCents = account.availableCents - committedCents;
      discrepancies.push({
        id: stableId('discrepancy', 'account-mismatch', account.id),
        kind: 'account-mismatch',
        expectedCents: account.availableCents,
        actualCents: committedCents,
        varianceCents,
        currency: account.currency,
        description: `Account ${account.id} has ${account.availableCents} available against ${committedCents} reserved + payable.`,
        alertId: stableId('alert', 'account-mismatch', account.id),
      });
    }
  }

  const mismatchedCurrencies =
    detectCurrencyMismatch(position, liabilities).length > 0 ||
    position.accounts.some((account) => account.currency !== currency);

  // 3. Payable liabilities that do not agree with recorded payables. Only
  //    comparable when every line shares the position currency.
  if (!mismatchedCurrencies) {
    const expectedCents = payableLiabilityCents(liabilities);
    const varianceCents = expectedCents - position.payableCents;
    if (varianceCents !== 0) {
      discrepancies.push({
        id: stableId('discrepancy', 'variance', currency),
        kind: 'variance',
        expectedCents,
        actualCents: position.payableCents,
        varianceCents,
        currency,
        description: `Payable liabilities total ${expectedCents} but recorded account payables total ${position.payableCents}.`,
        alertId: stableId('alert', 'variance', currency),
      });
    }
  }

  if (!previousRun) return discrepancies;

  const previousAccounts = accountIndex(previousRun.position.accounts);
  const currentAccounts = accountIndex(position.accounts);
  const previousLiabilities = liabilityIndex(previousRun.liabilities);
  const currentLiabilities = liabilityIndex(liabilities);

  // 4. Accounts that vanished from the source without an adjustment entry.
  for (const previousAccount of previousRun.position.accounts) {
    if (currentAccounts[previousAccount.id]) continue;
    discrepancies.push({
      id: stableId('discrepancy', 'account-missing', previousAccount.id),
      kind: 'account-mismatch',
      expectedCents: previousAccount.availableCents,
      actualCents: 0,
      varianceCents: -previousAccount.availableCents,
      currency: previousAccount.currency,
      description: `Account ${previousAccount.id} was present in run ${previousRun.id} and is missing from the current source.`,
      alertId: stableId('alert', 'account-missing', previousAccount.id),
    });
  }

  // 5. Liabilities that were removed from the book without an audit entry.
  for (const previousLiability of previousRun.liabilities) {
    if (currentLiabilities[previousLiability.id]) continue;
    discrepancies.push({
      id: stableId('discrepancy', 'liability-missing', previousLiability.id),
      kind: 'unrecorded-liability',
      expectedCents: previousLiability.amountCents,
      actualCents: 0,
      varianceCents: -previousLiability.amountCents,
      currency: previousLiability.currency,
      description: `Liability ${previousLiability.id} disappeared from the liability book since run ${previousRun.id}.`,
      alertId: stableId('alert', 'liability-missing', previousLiability.id),
    });
  }

  // 6. Sources older than the snapshot the previous run was taken from.
  for (const account of position.accounts) {
    const previous = previousAccounts[account.id];
    if (!previous) continue;
    if (Date.parse(account.asOf) < Date.parse(previous.asOf)) {
      discrepancies.push({
        id: stableId('discrepancy', 'stale-source', account.id, account.asOf),
        kind: 'stale-source',
        expectedCents: Date.parse(previous.asOf),
        actualCents: Date.parse(account.asOf),
        varianceCents: Date.parse(previous.asOf) - Date.parse(account.asOf),
        currency: account.currency,
        description: `Account ${account.id} reports ${account.asOf}, which is older than the ${previous.asOf} snapshot used by run ${previousRun.id}.`,
        alertId: stableId('alert', 'stale-source', account.id, account.asOf),
      });
    }
  }

  return discrepancies;
}

export function unacknowledgedDiscrepancies(run: ReconciliationRun): Discrepancy[] {
  return run.discrepancies.filter((discrepancy) => !discrepancy.acknowledgedAt);
}

/**
 * Produces an immutable reconciliation snapshot. Idempotent for identical
 * inputs, and never edits balances, liabilities, or prior runs.
 */
export function runReconciliation(
  accounts: TreasuryAccount[],
  liabilities: Liability[],
  asOf: string,
  previousRun?: ReconciliationRun,
  startedAt: string = asOf,
  completedAt: string = startedAt
): ReconciliationRun {
  const position = computePosition(accounts);
  const discrepancies = collectDiscrepancies(position, liabilities, previousRun);
  const mismatchedCurrencies = detectCurrencyMismatch(position, liabilities).length > 0;
  const varianceCents = mismatchedCurrencies ? 0 : payableLiabilityCents(liabilities) - position.payableCents;

  const status: ReconciliationRun['status'] =
    position.netCents < 0
      ? 'insolvent'
      : discrepancies.length > 0 || varianceCents !== 0
        ? 'drifted'
        : 'balanced';

  return {
    id: stableId('run', asOf, JSON.stringify(accounts), JSON.stringify(liabilities)),
    asOf,
    startedAt,
    completedAt,
    position,
    liabilities: [...liabilities],
    balanced: status === 'balanced',
    varianceCents,
    discrepancies,
    status,
  };
}

/**
 * New awards are blocked while the treasury is insolvent, while a run is still
 * in progress, or while any drift is unacknowledged.
 */
export function evaluateAwardGate(run: ReconciliationRun): AwardGate {
  const unacknowledged = unacknowledgedDiscrepancies(run);

  if (run.status === 'insolvent') {
    return {
      allowed: false,
      blockingDiscrepancyIds: unacknowledged.map((d) => d.id),
      reason: `New awards are blocked: the treasury is insolvent, net position is ${run.position.netCents} ${run.position.currency}.`,
    };
  }

  if (run.status === 'running') {
    return {
      allowed: false,
      blockingDiscrepancyIds: unacknowledged.map((d) => d.id),
      reason: 'New awards are blocked: a reconciliation run is still in progress.',
    };
  }

  if (unacknowledged.length > 0) {
    return {
      allowed: false,
      blockingDiscrepancyIds: unacknowledged.map((d) => d.id),
      reason: `New awards are blocked: ${unacknowledged.length} unacknowledged reconciliation discrepanc${unacknowledged.length === 1 ? 'y' : 'ies'} must be acknowledged first.`,
    };
  }

  if (run.status === 'drifted') {
    return {
      allowed: true,
      blockingDiscrepancyIds: [],
      reason: 'New awards are allowed: drift is present but every discrepancy has been acknowledged.',
    };
  }

  return {
    allowed: true,
    blockingDiscrepancyIds: [],
    reason: 'New awards are allowed: the treasury is balanced as of the latest run.',
  };
}

/**
 * Records an acknowledgement. Returns a NEW run and leaves the input run — and
 * every earlier run — untouched, so history is never rewritten.
 */
export function acknowledgeDiscrepancy(
  run: ReconciliationRun,
  discrepancyId: string,
  by: string,
  acknowledgedAt: string = run.completedAt
): ReconciliationRun {
  const target = run.discrepancies.find((discrepancy) => discrepancy.id === discrepancyId);
  if (!target) {
    throw new Error(`Unknown discrepancy ${discrepancyId}`);
  }
  if (!by) {
    throw new Error('An acknowledging actor is required.');
  }

  const discrepancies = run.discrepancies.map((discrepancy) =>
    discrepancy.id === discrepancyId
      ? { ...discrepancy, acknowledgedAt, acknowledgedBy: by }
      : { ...discrepancy }
  );

  const unacknowledged = discrepancies.filter((discrepancy) => !discrepancy.acknowledgedAt);

  return {
    ...run,
    id: `${run.id}-ack-${auditFingerprint(`${discrepancyId}|${by}|${acknowledgedAt}`)}`,
    discrepancies,
    status:
      run.status === 'insolvent' || run.status === 'running'
        ? run.status
        : unacknowledged.length > 0 || run.varianceCents !== 0
          ? 'drifted'
          : 'balanced',
    balanced: run.status !== 'insolvent' && unacknowledged.length === 0 && run.varianceCents === 0,
    approvedBy: by,
    approvedAt: acknowledgedAt,
  };
}

export type ReconcileRequest = {
  asOf: string;
  previousRunId?: string;
  idempotencyKey: string;
};

export const treasuryService = {
  getPosition: (programId?: string): Promise<TreasuryPosition> => {
    const query = programId ? `?programId=${encodeURIComponent(programId)}` : '';
    return apiClient.get<TreasuryPosition>(`${TREASURY_PATH}/position${query}`);
  },

  listAccounts: (programId?: string): Promise<TreasuryAccount[]> => {
    const query = programId ? `?programId=${encodeURIComponent(programId)}` : '';
    return apiClient.get<TreasuryAccount[]>(`${TREASURY_PATH}/accounts${query}`);
  },

  listLiabilities: (programId?: string): Promise<Liability[]> => {
    const query = programId ? `?programId=${encodeURIComponent(programId)}` : '';
    return apiClient.get<Liability[]>(`${TREASURY_PATH}/liabilities${query}`);
  },

  runReconciliation: (request: ReconcileRequest): Promise<ReconciliationRun> =>
    apiClient.post<ReconciliationRun>(`${TREASURY_PATH}/reconciliation-runs`, request),

  listRuns: (programId?: string): Promise<ReconciliationRun[]> => {
    const query = programId ? `?programId=${encodeURIComponent(programId)}` : '';
    return apiClient.get<ReconciliationRun[]>(`${TREASURY_PATH}/reconciliation-runs${query}`);
  },

  acknowledge: (runId: string, body: { discrepancyId: string; by: string }): Promise<ReconciliationRun> =>
    apiClient.post<ReconciliationRun>(
      `${TREASURY_PATH}/reconciliation-runs/${encodeURIComponent(runId)}/acknowledgements`,
      body
    ),

  beforeAward: (body: { programId: string; amountCents: number; currency: string }): Promise<AwardGate> =>
    apiClient.post<AwardGate>(`${TREASURY_PATH}/before-award`, body),
};

export { canOperateTreasury };
