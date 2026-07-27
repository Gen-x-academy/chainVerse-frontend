import { apiClient } from '@/src/lib/api-client';
import type { AuthResponse } from '../types/auth.types';

export interface GoogleAuthPayload {
  idToken: string;
}

export const googleAuthService = {
  register: async (payload: GoogleAuthPayload): Promise<AuthResponse> => {
    return apiClient.post<AuthResponse>('/auth/google/register', payload);
  },

  login: async (payload: GoogleAuthPayload): Promise<AuthResponse> => {
    return apiClient.post<AuthResponse>('/auth/google/login', payload);
  },
};
