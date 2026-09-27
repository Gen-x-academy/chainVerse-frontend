/**
 * Refunds, returned payments, solvency gating, and ledger reversals
 * (issue #1129).
 *
 * Authority comes from the caller's role, never from the request payload. A
 * refund that would make the treasury unable to cover its payables is blocked
 * before settlement. A settled entry is reversed, never deleted: the original
 * entry stays in the ledger and is linked to its reversal.
 */

import { apiClient } from '@/src/lib/api-client';
import type { TreasuryPosition } from '../../treasury/types';
import {
  REFUND_ROLES,
  type LedgerEntry,
  type RefundAuthority,
  type RefundRequest,
  type ReversalEntry,
  type SolvencyCheck,
} from './types';

const REFUNDS_PATH = '/scholarships/refunds';

/** Smallest refund the platform will process, in minor units. */
export const MINIMUM_REFUND_CENTS = 1_00;

/** A refund paired with the ledger entry it is returning. */
export type SettledRefund = RefundRequest & { originalEntryId: string };

/**
 * Maps a scholarship role to refund authority. Students and reviewers never
 * hold refund authority, whatever the client claims.
 */
export function refundAuthorityFor(role?: string): RefundAuthority {
  if (role === 'sponsor' || role === 'finance' || role === 'administrator') return role;
  return 'none';
}

/** Roles that may operate the refund surface at all. */
export function canOperateRefunds(role?: string): boolean {
  if (!role) return false;
  return REFUND_ROLES.includes(role);
}

/**
 * A sponsor may only ask for a refund of their own program's funds; finance and
 * administrators may act on any program. `actorId` lets the caller prove they
 * are the sponsor of record.
 */
export function canRequestRefund(
  request: RefundRequest,
  role?: string,
  programId?: string,
  actorId?: string
): boolean {
  const authority = refundAuthorityFor(role);
  if (authority === 'none') return false;
  if (authority === 'sponsor') {
    if (programId !== undefined && request.programId !== programId) return false;
    if (actorId !== undefined && actorId !== request.sponsorId) return false;
  }
  return Number.isInteger(request.amountCents) && request.amountCents >= MINIMUM_REFUND_CENTS;
}

/**
 * Refunds are only payable while the treasury can still cover its liabilities.
 * `pendingRefunds` are refunds already authorized but not yet settled.
 */
export function checkSolvency(
  treasury: Pick<TreasuryPosition, 'availableCents' | 'payableCents' | 'currency'>,
  pendingRefunds: RefundRequest[]
): SolvencyCheck {
  const requestedCents = pendingRefunds
    .filter((refund) => refund.currency === treasury.currency)
    .filter((refund) => refund.status === 'requested' || refund.status === 'authorized' || refund.status === 'processing')
    .reduce((total, refund) => total + refund.amountCents, 0);

  const shortfallCents = Math.max(0, requestedCents - Math.max(0, treasury.availableCents - treasury.payableCents));

  return {
    solvent: shortfallCents === 0,
    availableCents: treasury.availableCents,
    payableCents: treasury.payableCents,
    shortfallCents,
    currency: treasury.currency,
    blockedDiscrepancyIds: [],
  };
}

/** Moves a refund to `authorized`. The authorizer must be named. */
export function authorizeRefund(
  request: RefundRequest,
  authorizer: string,
  authorizedAt: string
): RefundRequest {
  if (!authorizer || authorizer.trim().length === 0) {
    throw new Error('A named authorizer is required before a refund can be authorized.');
  }
  if (request.status !== 'requested') {
    throw new Error(`A ${request.status} refund cannot be authorized.`);
  }
  if (!request.reason || request.reason.trim().length === 0) {
    throw new Error('A documented reason is required before a refund can be authorized.');
  }
  return { ...request, status: 'authorized', authorizedBy: authorizer, authorizedAt };
}

/** Moves an authorized refund into `processing`. */
export function markRefundProcessing(request: RefundRequest): RefundRequest {
  if (request.status !== 'authorized') {
    throw new Error('Only an authorized refund can be sent for processing.');
  }
  return { ...request, status: 'processing' };
}

/**
 * Settles a refund that is already processing. Solvency is re-checked here so
 * an authorized refund that would break the treasury is never settled.
 */
export function settleRefund(
  request: RefundRequest,
  settledAt: string,
  treasury?: Pick<TreasuryPosition, 'availableCents' | 'payableCents' | 'currency'>
): RefundRequest {
  if (request.status !== 'processing') {
    throw new Error(`A ${request.status} refund cannot be settled.`);
  }
  if (treasury) {
    const check = checkSolvency(treasury, [request]);
    if (!check.solvent) {
      throw new Error(
        `Settlement blocked: settling this refund leaves a shortfall of ${check.shortfallCents} ${check.currency}.`
      );
    }
  }
  return { ...request, status: 'settled', settledAt };
}

/**
 * Builds the reversal of a ledger entry. The reversal carries the opposite
 * entry type, links back to the original, and never replaces it.
 */
export function reverseEntry(original: LedgerEntry, memo: string, occurredAt: string): ReversalEntry {
  if (!original) {
    throw new Error('An original ledger entry is required before it can be reversed.');
  }
  if (original.reversesEntryId) {
    throw new Error('A reversal cannot itself be reversed.');
  }
  if (!memo || memo.trim().length === 0) {
    throw new Error('A documented memo is required on a reversal.');
  }

  return {
    id: `rev-${original.id}`,
    originalEntryId: original.id,
    entryType: original.entryType === 'debit' ? 'credit' : 'debit',
    amountCents: original.amountCents,
    currency: original.currency,
    ledgerEntryId: `led-${original.id}-rev`,
    occurredAt,
    memo,
    reversesEntryId: original.id,
  };
}

/**
 * Returns the ledger after a settled refund: the original entry is still there
 * and the reversal is appended alongside it. Nothing is removed.
 */
export function ledgerAfterRefund(
  entries: LedgerEntry[],
  refund: SettledRefund,
  memo?: string
): LedgerEntry[] {
  const original = entries.find((entry) => entry.id === refund.originalEntryId);
  if (!original) {
    throw new Error(`Ledger entry ${refund.originalEntryId} is not on the ledger.`);
  }
  if (original.currency !== refund.currency) {
    throw new Error('Currencies must match; a refund is never converted.');
  }
  if (original.amountCents !== refund.amountCents) {
    throw new Error('The refund amount must equal the amount of the entry being returned.');
  }

  const reversal = reverseEntry(
    original,
    memo ?? `Reversal of ${original.id} for refund ${refund.id}: ${refund.reason}`,
    refund.settledAt ?? refund.requestedAt
  );

  const reversalEntry: LedgerEntry = {
    id: reversal.id,
    entryType: reversal.entryType,
    amountCents: reversal.amountCents,
    currency: reversal.currency,
    programId: original.programId,
    memo: reversal.memo,
    occurredAt: reversal.occurredAt,
    reversesEntryId: reversal.reversesEntryId,
  };

  return [...entries, reversalEntry];
}

/** The net effect of a ledger: debits reduce it, credits restore it. */
export function ledgerNetCents(entries: LedgerEntry[]): number {
  return entries.reduce(
    (total, entry) => total + (entry.entryType === 'debit' ? -entry.amountCents : entry.amountCents),
    0
  );
}

export type RefundRequestInput = Omit<RefundRequest, 'id' | 'status' | 'requestedAt'>;

export const refundService = {
  listRequests: (programId?: string): Promise<RefundRequest[]> => {
    const query = programId ? `?programId=${encodeURIComponent(programId)}` : '';
    return apiClient.get<RefundRequest[]>(`${REFUNDS_PATH}${query}`);
  },

  request: (payload: RefundRequestInput & { idempotencyKey: string }): Promise<RefundRequest> =>
    apiClient.post<RefundRequest>(`${REFUNDS_PATH}`, payload),

  authorize: (requestId: string, body: { authorizedBy: string; reason: string; expectedStatus: 'requested' }): Promise<RefundRequest> =>
    apiClient.patch<RefundRequest>(`${REFUNDS_PATH}/${encodeURIComponent(requestId)}`, body),

  settle: (requestId: string, body: { idempotencyKey: string }): Promise<RefundRequest> =>
    apiClient.post<RefundRequest>(`${REFUNDS_PATH}/${encodeURIComponent(requestId)}/settlement`, body),

  reverse: (requestId: string, body: { memo: string; originalEntryId: string }): Promise<ReversalEntry> =>
    apiClient.post<ReversalEntry>(`${REFUNDS_PATH}/${encodeURIComponent(requestId)}/reversal`, body),

  listLedger: (programId?: string): Promise<LedgerEntry[]> => {
    const query = programId ? `?programId=${encodeURIComponent(programId)}` : '';
    return apiClient.get<LedgerEntry[]>(`${REFUNDS_PATH}/ledger${query}`);
  },

  checkSolvency: (programId: string): Promise<SolvencyCheck> =>
    apiClient.get<SolvencyCheck>(`${REFUNDS_PATH}/solvency?programId=${encodeURIComponent(programId)}`),
};
