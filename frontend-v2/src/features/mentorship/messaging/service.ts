/**
 * Engagement-scoped messaging (MENTOR-101).
 */

import { apiClient } from '@/lib/api-client';
import type { Message } from './types';

const PATH = (engagementId: string) => `/mentorship/engagements/${encodeURIComponent(engagementId)}/messages`;

export const mentorshipMessagingService = {
  list: (engagementId: string, page = 0): Promise<Message[]> =>
    apiClient.get<Message[]>(`${PATH(engagementId)}?page=${page}`),

  send: (engagementId: string, content: string, attachments: string[] = []): Promise<Message> =>
    apiClient.post<Message>(PATH(engagementId), { content, attachments }),
};
