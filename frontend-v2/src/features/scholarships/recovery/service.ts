/**
 * Recovery domain rules (issue #1130).
 *
 * Every function here is pure: the same claim always yields the same
 * reconciliation, and the same input always yields the same instruction or
 * the same refusal. All refusals are explained in words, never just a code.
 */

import { apiClient } from '@/src/lib/api-client';
import {
  hasLegalBasis,
  type InstructionDecision,
  type IssueInstructionInput,
  type IssueInstructionResult,
  type RecoveryClaim,
  type RecoveryClaimWithCollections,
  type RecoveryCollection,
  type RecoveryReconciliation,
  type ReverseCollectionResult,
} from './types';

/** Money still owed on a claim. Never negative. */
export function outstandingCents(claim: Pick<RecoveryClaim, 'requestedCents' | 'collectedCents'>): number {
  return Math.max(0, claim.requestedCents - claim.collectedCents);
}

function collectionsOf(claim: RecoveryClaimWithCollections): RecoveryCollection[] {
  return claim.collections ?? [];
}

/**
 * Collections that are still in force. A reversed collection is excluded, and
 * so is the reversing entry that offsets it — the pair nets to nothing.
 */
export function effectiveCollections(claim: RecoveryClaimWithCollections): RecoveryCollection[] {
  return collectionsOf(claim).filter(
    (collection) => !collection.reversed && collection.reversesCollectionId === undefined
  );
}

/**
 * An instruction is only ever a *request* to move money, and only when a
 * human has recorded both the authority for it and the approval.
 */
export function canIssueInstruction(
  claim: Pick<RecoveryClaim, 'legalBasis' | 'status' | 'requestedCents' | 'collectedCents'>
): InstructionDecision {
  const reasons: string[] = [];

  if (!hasLegalBasis(claim)) {
    reasons.push('No legal basis recorded — record program terms, a signed agreement, a court order, or policy 9.2 before recovering funds.');
  }
  if (claim.status !== 'approved') {
    reasons.push(`Claim status is "${claim.status}" — only an approved claim can be recovered.`);
  }
  if (outstandingCents(claim) <= 0) {
    reasons.push('Nothing outstanding on this claim — the requested amount is already collected.');
  }

  return { allowed: reasons.length === 0, reasons };
}

export function issueInstruction(
  claim: RecoveryClaim,
  input: IssueInstructionInput
): IssueInstructionResult {
  const decision = canIssueInstruction(claim);
  if (!decision.allowed) {
    return { error: decision.reasons.join(' ') };
  }
  if (input.authorizationId.trim() === '') {
    return { error: 'An authorization id is required. A recovery never silently debits a wallet.' };
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return { error: 'Recovery amount must be a positive whole number of minor units.' };
  }
  if (input.amountCents > outstandingCents(claim)) {
    return {
      error: `Recovery amount exceeds the ${outstandingCents(claim)} minor unit(s) outstanding on this claim.`,
    };
  }
  if (input.currency !== claim.currency) {
    return {
      error: `Currency mismatch: the claim is denominated in ${claim.currency}, not ${input.currency}.`,
    };
  }

  return {
    instruction: {
      claimId: claim.id,
      amountCents: input.amountCents,
      currency: input.currency,
      requiresStudentConsent: input.requiresStudentConsent,
      authorizationId: input.authorizationId.trim(),
      reason: claim.reason,
      issuedAt: input.issuedAt,
    },
  };
}

/**
 * Reconciles a claim from its own record only, for surfaces that have not
 * loaded the collection history. Over-collection is the discrepancy that can
 * be detected without the history.
 */
export function reconcileClaimRecord(claim: RecoveryClaim): RecoveryReconciliation {
  const discrepancyCents = claim.collectedCents - claim.requestedCents;
  return {
    claimId: claim.id,
    requestedCents: claim.requestedCents,
    collectedCents: claim.collectedCents,
    outstandingCents: Math.max(0, claim.requestedCents - claim.collectedCents),
    reconciles: discrepancyCents <= 0,
    discrepancyCents: Math.max(0, discrepancyCents),
  };
}

/** Money still in force after reversals: originals less the entries that offset them. */
export function netCollectedCents(collections: readonly RecoveryCollection[]): number {
  return collections
    .filter((collection) => !collection.reversed && collection.reversesCollectionId === undefined)
    .reduce((total, collection) => total + collection.amountCents, 0);
}

/**
 * Reconciles a claim against its collection history. `discrepancyCents` is the
 * difference between the money actually collected and the amount recorded on
 * the claim; a non-zero value is surfaced rather than silently absorbed.
 */
export function reconcileClaim(
  claim: RecoveryClaim,
  collections: readonly RecoveryCollection[] = []
): RecoveryReconciliation {
  const collected = netCollectedCents(collections);
  const discrepancyCents = collected - claim.collectedCents;

  return {
    claimId: claim.id,
    requestedCents: claim.requestedCents,
    collectedCents: claim.collectedCents,
    outstandingCents: Math.max(0, claim.requestedCents - claim.collectedCents),
    reconciles: discrepancyCents === 0,
    discrepancyCents,
  };
}

/**
 * True when every collection on the claim has been offset by a reversal. The
 * money history is intact — only its net effect is zero.
 */
export function isReversalOnly(claim: RecoveryClaimWithCollections): boolean {
  const collections = collectionsOf(claim).filter(
    (collection) => collection.reversesCollectionId === undefined
  );
  return collections.length > 0 && collections.every((collection) => collection.reversed);
}

/**
 * Reverses a collection. The original collection and its ledger entry are
 * preserved; a new reversing entry is appended.
 */
export function reverseCollection(
  claim: RecoveryClaimWithCollections,
  collection: RecoveryCollection,
  reversedAt: string
): ReverseCollectionResult {
  if (collection.claimId !== claim.id) {
    return { error: 'That collection belongs to a different claim.' };
  }
  if (collection.reversed) {
    return { error: 'That collection has already been reversed.' };
  }

  const reversingEntry: RecoveryCollection = {
    id: `${collection.id}-reversal`,
    claimId: claim.id,
    amountCents: collection.amountCents,
    currency: collection.currency,
    ledgerEntryId: `${collection.ledgerEntryId}-reversal`,
    collectedAt: reversedAt,
    reversed: false,
    reversesCollectionId: collection.id,
  };

  const collections = [
    ...collectionsOf(claim).map((entry) =>
      entry.id === collection.id ? { ...entry, reversed: true } : entry
    ),
    reversingEntry,
  ];

  return {
    claim: {
      ...claim,
      // Gross collected is never reduced by a reversal; only the net effect is.
      status: isReversalOnly({ ...claim, collections }) ? ('reversed' as const) : claim.status,
      collections,
    },
    reversingEntry,
  };
}

export const recoveryService = {
  listClaims(params: { programId?: string; status?: string } = {}): Promise<RecoveryClaim[]> {
    const query = new URLSearchParams();
    if (params.programId) query.set('programId', params.programId);
    if (params.status) query.set('status', params.status);
    const suffix = query.toString();
    return apiClient.get<RecoveryClaim[]>(`/scholarships/recovery/claims${suffix ? `?${suffix}` : ''}`);
  },

  getClaim(claimId: string): Promise<RecoveryClaim> {
    return apiClient.get<RecoveryClaim>(`/scholarships/recovery/claims/${encodeURIComponent(claimId)}`);
  },

  issueInstruction(
    claimId: string,
    input: IssueInstructionInput & { expectedStatus?: string }
  ): Promise<RecoveryInstruction> {
    return apiClient.post<RecoveryInstruction>(
      `/scholarships/recovery/claims/${encodeURIComponent(claimId)}/instructions`,
      input
    );
  },

  reverseCollection(
    claimId: string,
    collectionId: string,
    expectedVersion?: string
  ): Promise<RecoveryClaim> {
    return apiClient.post<RecoveryClaim>(
      `/scholarships/recovery/claims/${encodeURIComponent(claimId)}/reversals`,
      { collectionId, expectedVersion }
    );
  },
};
