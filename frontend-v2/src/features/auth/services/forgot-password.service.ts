import { apiClient } from '@/src/lib/api-client';

export type ForgotPasswordRequestDto = {
  email: string;
};

export type ForgotPasswordVerifyDto = {
  email: string;
  code: string;
};

export type ForgotPasswordConfirmDto = {
  email: string;
  code: string;
  password: string;
};

export type ForgotPasswordResponse = {
  message: string;
};

export const forgotPasswordService = {
  request: (dto: ForgotPasswordRequestDto) =>
    apiClient.post<ForgotPasswordResponse>('/api/auth/password-reset/request', dto),

  verify: (dto: ForgotPasswordVerifyDto) =>
    apiClient.post<ForgotPasswordResponse>('/api/auth/password-reset/verify', dto),

  confirm: (dto: ForgotPasswordConfirmDto) =>
    apiClient.post<ForgotPasswordResponse>('/api/auth/password-reset/confirm', dto),
};
