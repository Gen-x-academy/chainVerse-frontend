/**
 * Sponsor deposits and funding rounds (issue #1127).
 *
 * A deposit binds both the asset and the source account, is denominated in
 * integer minor units with an explicit `currency`, and carries a dedupe key
 * (`reference` + `clientToken`) so the same money can never be credited twice.
 * Allocation changes are authorized requests, never silent edits.
 */

export type AssetBinding = {
  assetCode: string;
  issuer?: string;
  sourceAccountId: string;
  verifiedAt: string;
};

export type FundingAllocation = 'specific-program' | 'unrestricted-pool';

export type DepositStatus = 'recorded' | 'credited' | 'rejected' | 'reversed';

export type Deposit = {
  id: string;
  sponsorId: string;
  allocation: FundingAllocation;
  programId?: string;
  amountCents: number;
  currency: string;
  asset: AssetBinding;
  reference: string;
  status: DepositStatus;
  recordedAt: string;
  creditedAt?: string;
  clientToken: string;
};

export type ReallocationStatus = 'requested' | 'authorized' | 'rejected' | 'applied';

export type ReallocationRequest = {
  id: string;
  depositId: string;
  fromProgramId: string;
  toProgramId: string;
  amountCents: number;
  currency: string;
  status: ReallocationStatus;
  requestedBy: string;
  requestedAt: string;
  authorizedBy?: string;
  authorizedAt?: string;
  reason: string;
};

export type FundingRoundStatus = 'draft' | 'open' | 'closed' | 'funded';

export type FundingRound = {
  id: string;
  name: string;
  programId: string;
  currency: string;
  targetCents: number;
  committedCents: number;
  opensAt: string;
  closesAt: string;
  status: FundingRoundStatus;
};

export type RejectionReason =
  | 'unknown-asset'
  | 'source-mismatch'
  | 'below-minimum'
  | 'duplicate-reference'
  | 'round-closed'
  | 'amount-exceeds-target';

export type DepositFieldError = {
  field: string;
  code: RejectionReason;
  message: string;
};

export type DepositDraft = {
  sponsorId: string;
  allocation: FundingAllocation;
  programId?: string;
  amountCents: number;
  currency: string;
  assetCode: string;
  issuer?: string;
  sourceAccountId: string;
  reference: string;
  clientToken: string;
};

export type DepositValidation = {
  valid: boolean;
  errors: DepositFieldError[];
};

export type RoundProgress = {
  committedCents: number;
  targetCents: number;
  remainingCents: number;
  percent: number;
  funded: boolean;
};

/** Roles permitted to operate funding. */
export const FUNDING_ROLES: readonly string[] = ['finance', 'sponsor', 'administrator'];

/** Assets the platform accepts; anything else is rejected as `unknown-asset`. */
export const KNOWN_ASSET_CODES: readonly string[] = ['USDC', 'USDT', 'DAI', 'USD', 'NGN'];

/** The sponsor's own recorded source account, used to detect a source mismatch. */
export const EXPECTED_SOURCE_ACCOUNT_ID = 'sponsor-source-account';

export function canOperateFunding(role?: string): boolean {
  if (!role) return false;
  return FUNDING_ROLES.includes(role);
}
