export type WithdrawalReasonCategory =
  | 'personal'
  | 'academic'
  | 'financial'
  | 'schedule'
  | 'other';

export type WithdrawalRequest = {
  applicationId: string;
  programId: string;
  reasonCategory: WithdrawalReasonCategory;
  reasonDetail?: string;
  confirmed: boolean;
  requestedAt: string;
};

export type WithdrawalRecord = WithdrawalRequest & {
  withdrawalId: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  releasedCapacity: boolean;
  reviewHistoryPreserved: boolean;
  policyImpact: string;
};

export type WithdrawalState = {
  withdrawal: WithdrawalRecord | null;
  loading: boolean;
  error: string | null;
  history: WithdrawalRecord[];
};
