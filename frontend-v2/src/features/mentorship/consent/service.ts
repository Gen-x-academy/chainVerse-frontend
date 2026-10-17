/**
 * Mentorship consent ledger (MENTOR-107).
 */

import { apiClient } from '@/lib/api-client';
import type { ConsentPurpose, ConsentRecord, ConsentStatus } from './types';

const PATH = '/mentorship/consent';

export const mentorshipConsentService = {
  list: (userId: string): Promise<ConsentRecord[]> =>
    apiClient.get<ConsentRecord[]>(`${PATH}/${encodeURIComponent(userId)}`),

  grant: (userId: string, purpose: ConsentPurpose, version: number, source: string): Promise<ConsentRecord> =>
    apiClient.post<ConsentRecord>(`${PATH}/${encodeURIComponent(userId)}/grant`, { purpose, version, source }),

  withdraw: (userId: string, purpose: ConsentPurpose, version: number): Promise<ConsentRecord> =>
    apiClient.post<ConsentRecord>(`${PATH}/${encodeURIComponent(userId)}/withdraw`, { purpose, version }),
};
