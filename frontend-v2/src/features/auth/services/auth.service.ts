import { apiClient } from '@/lib/api-client';
import type { AuthResponse, LoginPayload, RegisterPayload } from '../types/auth.types';

const TOKEN_KEY = 'auth_token';

export const authService = {
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const data = await apiClient.post<AuthResponse>('/api/auth/login', payload);
    authService.setToken(data.token);
    return data;
  },

  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    const data = await apiClient.post<AuthResponse>('/api/auth/register', payload);
    authService.setToken(data.token);
    return data;
  },

  getToken: (): string | null => {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken: (token: string): void => {
    localStorage.setItem(TOKEN_KEY, token);
  },

  logout: (): void => {
    localStorage.removeItem(TOKEN_KEY);
  },

  getAuthHeaders: (): Record<string, string> => {
    const token = authService.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  isAuthenticated: (): boolean => {
    return !!authService.getToken();
  },
};
