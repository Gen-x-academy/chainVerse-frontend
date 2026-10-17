import { apiClient } from '@/src/lib/api-client';
import type { MentorDashboardData } from './types';

export const mentorOperationsDashboardService = {
  getDashboard: (params: { mentorId: string; tenantId: string }): Promise<MentorDashboardData> => {
    const query = new URLSearchParams(params);
    return apiClient.get<MentorDashboardData>(`/mentorship/operations/dashboard?${query.toString()}`);
  },
};

export * from './types';
