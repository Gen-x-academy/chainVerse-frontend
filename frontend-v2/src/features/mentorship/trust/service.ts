import { apiClient } from '@/src/lib/api-client';
import type { StudentTrustProfile } from './types';

const BASE = '/mentorship/trust';

export const trustIndicatorService = {
  getProfile: (studentId: string) =>
    apiClient.get<StudentTrustProfile>(`${BASE}/profiles/${studentId}`),
};
