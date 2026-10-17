/**
 * Mentorship consent ledger (MENTOR-107).
 */

export type ConsentPurpose =
  | 'matching'
  | 'calendar'
  | 'recording'
  | 'analytics'
  | 'credentials'
  | 'research';

export type ConsentStatus = 'granted' | 'withdrawn';

export type ConsentRecord = {
  id: string;
  userId: string;
  purpose: ConsentPurpose;
  status: ConsentStatus;
  version: number;
  source: string;
  grantedAt?: string;
  withdrawnAt?: string;
  createdAt: string;
  updatedAt: string;
};
