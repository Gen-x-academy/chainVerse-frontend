import { apiClient } from '../../../lib/api-client';

export type ForgotPasswordDto = {
  email: string;
};

export type ForgotPasswordResponse = {
  message: string;
};

export const studentForgotPasswordService = {
  forgotPassword: (dto: ForgotPasswordDto) =>
    apiClient.post<ForgotPasswordResponse>('/student/forgot-password', dto),
};
