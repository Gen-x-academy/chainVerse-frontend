export type AwardInventory = {
  programId: string;
  programName: string;
  maxRecipients: number;
  perAwardAmount: number;
  totalBudget: number;
  reserveAmount: number;
  currency: string;
  remainingCapacity: number;
  reservedCapacity: number;
  committedAwards: number;
  updatedAt: string;
  version: string;
};

export type AwardInventoryUpdateInput = {
  programId: string;
  maxRecipients?: number;
  perAwardAmount?: number;
  totalBudget?: number;
  reserveAmount?: number;
  currency?: string;
  expectedVersion?: string;
};

/**
 * What the client believes the API will decide, computed locally to preview a
 * commitment. It carries **no identifier and no timestamp** (issue #1223): a
 * proposal is never a record.
 */
export type AwardInventoryDecisionProposal = {
  programId: string;
  awardAmount: number;
  recipientsCount: number;
  status: 'approved' | 'rejected';
  reason?: string;
};

/**
 * A decision the scholarship API has actually recorded. `decisionId` and
 * `committedAt` are assigned server-side; the client never fabricates either.
 */
export type AwardInventoryDecision = AwardInventoryDecisionProposal & {
  decisionId: string;
  committedAt: string;
};

export type AwardInventoryState = {
  inventory: AwardInventory | null;
  loading: boolean;
  error: string | null;
  /** Local preview only, until the API returns a recorded decision. */
  pendingProposal: AwardInventoryDecisionProposal | null;
  lastDecision: AwardInventoryDecision | null;
  history: AwardInventoryDecision[];
};
