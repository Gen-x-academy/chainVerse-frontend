import { apiClient } from '@/src/lib/api-client';
import type { AuthResponse, RefreshTokenResponse } from '@/src/types/api';

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

export const authApiService = {
  login: (dto: LoginDto): Promise<AuthResponse> =>
    apiClient.post<AuthResponse>('/student/login', dto),

  register: (dto: RegisterDto): Promise<{ message: string }> =>
    apiClient.post<{ message: string }>('/student/create', dto),

  logout: (): Promise<void> =>
    apiClient.post<void>('/student/logout', {}),

  refreshToken: (refreshToken: string): Promise<RefreshTokenResponse> =>
    apiClient.post<RefreshTokenResponse>('/student/refresh-token', { refreshToken }),

  forgotPassword: (dto: ForgotPasswordDto): Promise<{ message: string }> =>
    apiClient.post<{ message: string }>('/student/forgot-password', dto),

  resetPassword: (dto: ResetPasswordDto): Promise<{ message: string }> =>
    apiClient.post<{ message: string }>('/student/reset-password', dto),
};
