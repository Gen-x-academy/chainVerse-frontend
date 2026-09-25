import type { DisbursementCurrency } from '../types';

export type ScheduledPaymentStatus = 'due' | 'processing' | 'completed' | 'skipped';

export type ScheduledPayment = {
  id: string;
  awardId: string;
  installmentId: string;
  recipientId: string;
  recipientWalletAddress: string;
  amount: string;
  currency: DisbursementCurrency;
  scheduledAt: string;
  status: ScheduledPaymentStatus;
  programId?: string;
};

export type PaymentBatchRequest = {
  batchKey: string;
  programId?: string;
  maxItems: number;
  dryRun?: boolean;
};

export type BatchItemOutcome = {
  scheduledPaymentId: string;
  disbursementIntentId?: string;
  success: boolean;
  failureReason?: string;
  ledgerRef?: string;
};

export type BatchStatus = 'idle' | 'running' | 'completed' | 'partially_failed' | 'failed';

export type PaymentBatchResult = {
  batchId: string;
  batchKey: string;
  status: BatchStatus;
  totalItems: number;
  successCount: number;
  failureCount: number;
  outcomes: BatchItemOutcome[];
  startedAt: string;
  completedAt?: string;
};
