import { apiClient } from '@/src/lib/api-client';
import type { Notification, NotificationListResponse, PaginationParams } from '@/src/types/api';

export const notificationsApiService = {
  list: (params: PaginationParams = {}): Promise<NotificationListResponse> =>
    apiClient.get<NotificationListResponse>(
      `/notification?page=${params.page ?? 1}&limit=${params.limit ?? 20}`
    ),

  markRead: (id: string): Promise<Notification> =>
    apiClient.patch<Notification>(`/notification/${id}/read`, {}),

  markAllRead: (): Promise<{ message: string }> =>
    apiClient.patch<{ message: string }>('/notification/read-all', {}),
};
