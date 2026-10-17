import { apiClient } from '@/src/lib/api-client';
import type { MentorshipAnalyticsSnapshot } from './types';

export const mentorshipProgramAnalyticsService = {
  getSnapshot: (params: {
    tenantId: string;
    programId?: string;
    cohortId?: string;
  }): Promise<MentorshipAnalyticsSnapshot> => {
    const query = new URLSearchParams({ tenantId: params.tenantId });
    if (params.programId) query.set('programId', params.programId);
    if (params.cohortId) query.set('cohortId', params.cohortId);
    return apiClient.get<MentorshipAnalyticsSnapshot>(
      `/mentorship/analytics/snapshot?${query.toString()}`
    );
  },
};

export * from './types';
