import { apiClient } from '../../../lib/api-client';

export type ResetPasswordDto = {
  token: string;
  newPassword: string;
};

export type ResetPasswordResponse = {
  message: string;
};

export const studentResetPasswordService = {
  resetPassword: (dto: ResetPasswordDto) =>
    apiClient.post<ResetPasswordResponse>('/student/reset-password', dto),
};
