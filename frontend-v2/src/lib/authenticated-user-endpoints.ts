/**
 * Canonical-client endpoints for issue #835.
 * Notifications and profile calls should go through apiClient so they get
 * shared auth headers, timeout, and 401 refresh/retry behavior instead of
 * calling fetch directly.
 */
import { apiClient } from '@/src/lib/api-client';

export function getNotifications() {
  return apiClient.get<unknown[]>('/notifications');
}

export function markNotificationRead(id: string) {
  return apiClient.patch<unknown>(`/notifications/${id}`, { read: true });
}

export function getProfile() {
  return apiClient.get<unknown>('/profile');
}

export function updateProfile(payload: Record<string, unknown>) {
  return apiClient.put<unknown>('/profile', payload);
}
