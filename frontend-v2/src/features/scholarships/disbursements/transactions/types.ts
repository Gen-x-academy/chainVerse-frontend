import type { DisbursementCurrency } from '../types';

export type TransactionStatus =
  | 'submitted'
  | 'pending'
  | 'successful'
  | 'failed'
  | 'expired'
  | 'reversed';

export type LedgerTransaction = {
  id: string;
  disbursementIntentId: string;
  awardId: string;
  recipientId: string;
  recipientWalletAddress: string;
  amount: string;
  currency: DisbursementCurrency;
  status: TransactionStatus;
  txHash?: string;
  ledgerSequence?: number;
  submittedAt: string;
  confirmedAt?: string;
  finalizedAt?: string;
  requiredConfirmations: number;
  currentConfirmations: number;
  network: string;
};

export type TransactionConfirmation = {
  transactionId: string;
  txHash: string;
  confirmedAt: string;
  ledgerSequence: number;
};

export type ConfirmTransactionPayload = {
  txHash: string;
  disbursementIntentId: string;
  ledgerSequence?: number;
};

export type TransactionListParams = {
  awardId?: string;
  disbursementIntentId?: string;
  status?: TransactionStatus;
  page?: number;
  pageSize?: number;
};
