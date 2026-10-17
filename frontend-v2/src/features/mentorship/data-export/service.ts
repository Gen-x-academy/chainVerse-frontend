/**
 * Mentorship data export (MENTOR-108).
 */

import { apiClient } from '@/lib/api-client';
import type { MentorshipExportBundle, MentorshipExportRequest } from './types';

const PATH = '/mentorship/export';

export const mentorshipExportService = {
  request: (userId: string): Promise<MentorshipExportRequest> =>
    apiClient.post<MentorshipExportRequest>(`${PATH}/${encodeURIComponent(userId)}/request`, {}),

  get: (userId: string, requestId: string): Promise<MentorshipExportRequest> =>
    apiClient.get<MentorshipExportRequest>(`${PATH}/${encodeURIComponent(userId)}/requests/${encodeURIComponent(requestId)}`),

  download: (downloadUrl: string): Promise<MentorshipExportBundle> =>
    apiClient.get<MentorshipExportBundle>(downloadUrl),
};
