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

export type AwardInventoryDecision = {
  decisionId: string;
  programId: string;
  awardAmount: number;
  recipientsCount: number;
  committedAt: string;
  status: 'approved' | 'rejected';
  reason?: string;
};

export type AwardInventoryState = {
  inventory: AwardInventory | null;
  loading: boolean;
  error: string | null;
  lastDecision: AwardInventoryDecision | null;
  history: AwardInventoryDecision[];
};
