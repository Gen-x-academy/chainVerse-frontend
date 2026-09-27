/**
 * Recoveries and clawbacks (issue #1130).
 *
 * A recovery reclaims money already awarded to a student. The central
 * invariant of this module: **a recovery never silently debits a wallet**.
 * Every debit must be backed by an explicit, recorded `authorizationId` and
 * a real legal basis; without both, nothing is issued.
 *
 * Finance / sponsor / administrator surface. Money is always integer minor
 * units with an explicit `currency` that travels with the value.
 */

export type RecoveryReason =
  | 'fraud'
  | 'withdrawal-after-award'
  | 'milestone-failure'
  | 'duplicate-award'
  | 'academic-fraud'
  | 'other';

export type RecoveryStatus =
  | 'requested'
  | 'under-review'
  | 'approved'
  | 'scheduled'
  | 'recovered'
  | 'written-off'
  | 'reversed';

export type LegalBasis =
  | 'program-terms'
  | 'signed-agreement'
  | 'court-order'
  | 'policy-9.2'
  | 'none';

export type RecoveryClaim = {
  id: string;
  awardId: string;
  studentId: string;
  programId: string;
  amountCents: number;
  currency: string;
  reason: RecoveryReason;
  legalBasis: LegalBasis;
  status: RecoveryStatus;
  requestedCents: number;
  collectedCents: number;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  scheduledAt?: string;
  settledAt?: string;
  notes?: string;
};

/**
 * A single money movement against a claim. Collections are append-only: a
 * collection is never edited or deleted, only offset by a reversing entry.
 */
export type RecoveryCollection = {
  id: string;
  claimId: string;
  amountCents: number;
  currency: string;
  ledgerEntryId: string;
  collectedAt: string;
  reversed: boolean;
  reversesCollectionId?: string;
};

/** A claim together with its append-only collection history. */
export type RecoveryClaimWithCollections = RecoveryClaim & {
  collections?: RecoveryCollection[];
};

export type RecoveryInstruction = {
  claimId: string;
  amountCents: number;
  currency: string;
  requiresStudentConsent: boolean;
  authorizationId: string;
  reason: RecoveryReason;
  issuedAt: string;
};

export type IssueInstructionInput = {
  amountCents: number;
  currency: string;
  requiresStudentConsent: boolean;
  authorizationId: string;
  issuedAt: string;
};

export type IssueInstructionResult =
  | { instruction: RecoveryInstruction }
  | { error: string };

export type ReverseCollectionResult =
  | { claim: RecoveryClaimWithCollections; reversingEntry: RecoveryCollection }
  | { error: string };

export type RecoveryReconciliation = {
  claimId: string;
  requestedCents: number;
  collectedCents: number;
  outstandingCents: number;
  reconciles: boolean;
  discrepancyCents: number;
};

export type InstructionDecision = {
  allowed: boolean;
  reasons: string[];
};

export const RECOVERY_REASONS: readonly RecoveryReason[] = [
  'fraud',
  'withdrawal-after-award',
  'milestone-failure',
  'duplicate-award',
  'academic-fraud',
  'other',
];

export const RECOVERY_STATUSES: readonly RecoveryStatus[] = [
  'requested',
  'under-review',
  'approved',
  'scheduled',
  'recovered',
  'written-off',
  'reversed',
];

export const LEGAL_BASES: readonly LegalBasis[] = [
  'program-terms',
  'signed-agreement',
  'court-order',
  'policy-9.2',
  'none',
];

/** A `none` basis must never be treated as authority to move money. */
export function hasLegalBasis(claim: Pick<RecoveryClaim, 'legalBasis'>): boolean {
  return claim.legalBasis !== 'none';
}
