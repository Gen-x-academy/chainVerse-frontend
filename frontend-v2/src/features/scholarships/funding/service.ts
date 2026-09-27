/**
 * Sponsor deposits, funding rounds, and reallocation requests (issue #1127).
 *
 * Recording a deposit is idempotent on the dedupe key: the same `reference` or
 * the same `clientToken` can never credit twice. Reallocating a credited
 * deposit is an authorized, auditable request that never mutates the original
 * allocation in place.
 */

import { apiClient } from '@/src/lib/api-client';
import { auditFingerprint } from '../audit';
import {
  EXPECTED_SOURCE_ACCOUNT_ID,
  KNOWN_ASSET_CODES,
  canOperateFunding,
  type AssetBinding,
  type Deposit,
  type DepositDraft,
  type DepositValidation,
  type FundingRound,
  type ReallocationRequest,
  type RoundProgress,
} from './types';

const FUNDING_PATH = '/scholarships/funding';

/** Smallest deposit the platform will credit, in minor units. */
export const MINIMUM_DEPOSIT_CENTS = 100_00;

function error(field: string, code: DepositValidation['errors'][number]['code'], message: string) {
  return { field, code, message };
}

/**
 * Finds an already-recorded deposit with the same `reference` or the same
 * `clientToken`. Either match means the money has already been presented.
 */
export function detectDuplicate(deposits: Deposit[], incoming: DepositDraft): Deposit | null {
  const match = deposits.find(
    (deposit) =>
      (incoming.reference.length > 0 && deposit.reference === incoming.reference) ||
      (incoming.clientToken.length > 0 && deposit.clientToken === incoming.clientToken)
  );
  return match ?? null;
}

/**
 * Validates a deposit draft. The duplicate check runs first: a deposit whose
 * dedupe key is already on file is never credited a second time, whatever else
 * is wrong with it.
 */
export function validateDeposit(
  draft: DepositDraft,
  deposits: Deposit[],
  rounds: FundingRound[]
): DepositValidation {
  const errors: DepositValidation['errors'] = [];

  if (detectDuplicate(deposits, draft)) {
    errors.push(
      error('reference', 'duplicate-reference', 'A deposit with this reference or client token has already been recorded.')
    );
  }

  if (!KNOWN_ASSET_CODES.includes(draft.assetCode)) {
    errors.push(error('assetCode', 'unknown-asset', `Asset ${draft.assetCode || '(none)'} is not an accepted asset.`));
  }

  if (draft.sourceAccountId !== EXPECTED_SOURCE_ACCOUNT_ID) {
    errors.push(
      error(
        'sourceAccountId',
        'source-mismatch',
        `The deposit must originate from the verified source account ${EXPECTED_SOURCE_ACCOUNT_ID}.`
      )
    );
  }

  if (!Number.isInteger(draft.amountCents) || draft.amountCents < MINIMUM_DEPOSIT_CENTS) {
    errors.push(
      error('amountCents', 'below-minimum', `The minimum deposit is ${MINIMUM_DEPOSIT_CENTS} minor units.`)
    );
  }

  if (!draft.reference.trim()) {
    errors.push(error('reference', 'duplicate-reference', 'A deposit reference is required.'));
  }

  if (!draft.clientToken.trim()) {
    errors.push(error('clientToken', 'duplicate-reference', 'A client token is required to deduplicate this deposit.'));
  }

  if (draft.allocation === 'specific-program' && !draft.programId) {
    errors.push(error('programId', 'source-mismatch', 'Select the program this deposit is allocated to.'));
  }

  for (const round of rounds) {
    if (round.programId !== draft.programId || round.currency !== draft.currency) continue;
    if (round.status === 'closed' || round.status === 'funded') {
      errors.push(
        error('programId', 'round-closed', `Round ${round.name} is ${round.status} and no longer accepts deposits.`)
      );
    }
    if (draft.amountCents > round.targetCents - round.committedCents) {
      errors.push(
        error(
          'amountCents',
          'amount-exceeds-target',
          `Round ${round.name} has ${round.targetCents - round.committedCents} minor units remaining of its target.`
        )
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Records a deposit in `recorded` state. Never credits: crediting is a separate
 * authorized step. Throws when validation fails so a duplicate can never be
 * written.
 */
export function recordDeposit(
  draft: DepositDraft,
  deposits: Deposit[],
  rounds: FundingRound[],
  recordedAt: string
): Deposit {
  const validation = validateDeposit(draft, deposits, rounds);
  if (!validation.valid) {
    throw new Error(validation.errors.map((item) => item.message).join(' '));
  }

  const asset: AssetBinding = {
    assetCode: draft.assetCode,
    issuer: draft.issuer,
    sourceAccountId: draft.sourceAccountId,
    verifiedAt: recordedAt,
  };

  return {
    id: `dep-${auditFingerprint(`${draft.reference}|${draft.clientToken}|${recordedAt}`)}`,
    sponsorId: draft.sponsorId,
    allocation: draft.allocation,
    programId: draft.allocation === 'specific-program' ? draft.programId : undefined,
    amountCents: draft.amountCents,
    currency: draft.currency,
    asset,
    reference: draft.reference,
    status: 'recorded',
    recordedAt,
    clientToken: draft.clientToken,
  };
}

/**
 * Authorizes a reallocation. Requires a named authorizer who is not the
 * requester, and a non-empty reason — an allocation never moves silently.
 */
export function authorizeReallocation(
  request: ReallocationRequest,
  authorizer: string,
  authorizedAt: string
): ReallocationRequest {
  if (!authorizer || !authorizer.trim()) {
    throw new Error('A named authorizer is required to move an allocation.');
  }
  if (authorizer === request.requestedBy) {
    throw new Error('An allocation cannot be authorized by the person who requested it.');
  }
  if (!request.reason || !request.reason.trim()) {
    throw new Error('A documented reason is required to move an allocation.');
  }
  if (request.status !== 'requested') {
    throw new Error(`A ${request.status} reallocation cannot be authorized again.`);
  }

  return { ...request, status: 'authorized', authorizedBy: authorizer, authorizedAt };
}

export function rejectReallocation(
  request: ReallocationRequest,
  authorizer: string,
  authorizedAt: string
): ReallocationRequest {
  if (!authorizer || authorizer.trim().length === 0) {
    throw new Error('A named authorizer is required to reject a reallocation.');
  }
  if (!request.reason || request.reason.trim().length === 0) {
    throw new Error('A documented reason is required to reject a reallocation.');
  }
  return { ...request, status: 'rejected', authorizedBy: authorizer, authorizedAt };
}

export function applyReallocation(
  request: ReallocationRequest,
  deposit: Deposit,
  appliedAt: string
): { request: ReallocationRequest; deposit: Deposit } {
  if (request.status !== 'authorized') {
    throw new Error('Only an authorized reallocation can be applied.');
  }
  if (deposit.id !== request.depositId) {
    throw new Error('The reallocation does not belong to this deposit.');
  }
  if (deposit.amountCents < request.amountCents) {
    throw new Error('The reallocation amount exceeds the recorded deposit.');
  }
  if (deposit.currency !== request.currency) {
    throw new Error('Currencies must match; allocations are never converted.');
  }

  return {
    request: { ...request, status: 'applied' },
    deposit: { ...deposit, programId: request.toProgramId, creditedAt: deposit.creditedAt ?? appliedAt },
  };
}

export function roundProgress(round: FundingRound): RoundProgress {
  const remainingCents = Math.max(0, round.targetCents - round.committedCents);
  const percent = round.targetCents <= 0 ? 100 : Math.min(100, Math.round((round.committedCents / round.targetCents) * 100));
  return {
    committedCents: round.committedCents,
    targetCents: round.targetCents,
    remainingCents,
    percent,
    funded: remainingCents === 0,
  };
}

/** A round accepts deposits only while it is open and under its target. */
export function canFundRound(round: FundingRound, amountCents: number): boolean {
  if (round.status !== 'open') return false;
  if (!Number.isInteger(amountCents) || amountCents < MINIMUM_DEPOSIT_CENTS) return false;
  return amountCents <= round.targetCents - round.committedCents;
}

export type RecordDepositRequest = DepositDraft & { idempotencyKey: string };

export const fundingService = {
  listDeposits: (sponsorId?: string): Promise<Deposit[]> => {
    const query = sponsorId ? `?sponsorId=${encodeURIComponent(sponsorId)}` : '';
    return apiClient.get<Deposit[]>(`${FUNDING_PATH}/deposits${query}`);
  },

  recordDeposit: (payload: RecordDepositRequest): Promise<Deposit> =>
    apiClient.post<Deposit>(`${FUNDING_PATH}/deposits`, payload),

  creditDeposit: (depositId: string, body: { idempotencyKey: string }): Promise<Deposit> =>
    apiClient.post<Deposit>(
      `${FUNDING_PATH}/deposits/${encodeURIComponent(depositId)}/credit`,
      body
    ),

  listRounds: (programId?: string): Promise<FundingRound[]> => {
    const query = programId ? `?programId=${encodeURIComponent(programId)}` : '';
    return apiClient.get<FundingRound[]>(`${FUNDING_PATH}/rounds${query}`);
  },

  requestReallocation: (body: Omit<ReallocationRequest, 'id' | 'status' | 'requestedAt'>): Promise<ReallocationRequest> =>
    apiClient.post<ReallocationRequest>(`${FUNDING_PATH}/reallocations`, body),

  authorizeReallocation: (
    requestId: string,
    body: { authorizedBy: string; reason: string; expectedStatus: ReallocationRequest['status'] }
  ): Promise<ReallocationRequest> =>
    apiClient.patch<ReallocationRequest>(
      `${FUNDING_PATH}/reallocations/${encodeURIComponent(requestId)}`,
      body
    ),

  listReallocations: (depositId?: string): Promise<ReallocationRequest[]> => {
    const query = depositId ? `?depositId=${encodeURIComponent(depositId)}` : '';
    return apiClient.get<ReallocationRequest[]>(`${FUNDING_PATH}/reallocations${query}`);
  },
};

export { canOperateFunding };
