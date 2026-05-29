import { apiClient } from '@/lib/api-client';
import type { AuthResponse } from '../types/auth.types';

export interface GoogleAuthPayload {
  idToken: string;
}

export const googleAuthService = {
  register: async (payload: GoogleAuthPayload): Promise<AuthResponse> => {
    return apiClient.post<AuthResponse>('/api/auth/google/register', payload);
  },

  login: async (payload: GoogleAuthPayload): Promise<AuthResponse> => {
    return apiClient.post<AuthResponse>('/api/auth/google/login', payload);
  },
};
