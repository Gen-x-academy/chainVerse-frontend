export type IntentStatus = 'pending' | 'processing' | 'executed' | 'failed' | 'cancelled';

export type DisbursementCurrency = 'XLM' | 'USDC';

export type DisbursementIntent = {
  id: string;
  intentKey: string;
  awardId: string;
  installmentId: string;
  recipientId: string;
  recipientWalletAddress: string;
  amount: string;
  currency: DisbursementCurrency;
  status: IntentStatus;
  createdAt: string;
  executedAt?: string;
  externalTxId?: string;
};

export type CreateIntentPayload = {
  intentKey: string;
  awardId: string;
  installmentId: string;
  recipientId: string;
  recipientWalletAddress: string;
  amount: string;
  currency: DisbursementCurrency;
};

export type CreateIntentResult = {
  intent: DisbursementIntent;
  isNew: boolean;
};

export type ChallengeStatus = 'pending' | 'signed' | 'verified' | 'expired' | 'failed';

export type WalletChallenge = {
  challengeId: string;
  walletAddress: string;
  challengeText: string;
  issuedAt: string;
  expiresAt: string;
  status: ChallengeStatus;
};

export type SubmitSignaturePayload = {
  challengeId: string;
  walletAddress: string;
  signature: string;
  publicKey: string;
};

export type WalletValidationResult = {
  verified: boolean;
  walletAddress: string;
  verifiedAt?: string;
  paymentsOnHold: boolean;
  holdReason?: string;
};

export type UpdateWalletAddressPayload = {
  recipientId: string;
  newWalletAddress: string;
};
