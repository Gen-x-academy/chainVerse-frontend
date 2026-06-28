import { apiClient } from '@/src/lib/api-client';
import type { Profile, UpdateProfilePayload, ChangePasswordPayload } from '@/src/types/api';

export const profileApiService = {
  get: (): Promise<Profile> =>
    apiClient.get<Profile>('/student/profile'),

  update: (payload: UpdateProfilePayload): Promise<Profile> =>
    apiClient.patch<Profile>('/student-account-settings/profile', payload),

  changePassword: (payload: ChangePasswordPayload): Promise<{ message: string }> =>
    apiClient.post<{ message: string }>('/student-account-settings/change-password', payload),
};
