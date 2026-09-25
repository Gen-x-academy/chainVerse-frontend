import type { DisbursementCurrency } from '../types';

export type FailureReason =
  | 'missing_trustline'
  | 'bad_destination'
  | 'insufficient_funds'
  | 'network_expiry'
  | 'unknown';

export type RecoveryStatus = 'open' | 'retrying' | 'resolved' | 'abandoned';

export type PayoutFailure = {
  id: string;
  disbursementIntentId: string;
  awardId: string;
  recipientId: string;
  recipientWalletAddress: string;
  amount: string;
  currency: DisbursementCurrency;
  failureReason: FailureReason;
  failureDetail: string;
  recoveryStatus: RecoveryStatus;
  retryCount: number;
  maxRetries: number;
  failedAt: string;
  lastRetryAt?: string;
  resolvedAt?: string;
};

export type DiagnosticReport = {
  failureId: string;
  failureReason: FailureReason;
  operatorNotes: string;
  suggestedAction: string;
  affectedAccounts: string[];
  canRetry: boolean;
  retryRequiresNewEnvelope: boolean;
  awardEligibilityPreserved: boolean;
  generatedAt: string;
};

export type RetryPayload = {
  failureId: string;
  newEnvelopeKey: string;
};

export type RetryResult = {
  newDisbursementIntentId: string;
  originalFailureId: string;
  enqueued: boolean;
  message: string;
};
