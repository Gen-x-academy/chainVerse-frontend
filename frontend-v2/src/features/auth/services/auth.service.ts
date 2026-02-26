import type { AuthResponse, LoginPayload, RegisterPayload } from '../types/auth.types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
const TOKEN_KEY = 'auth_token';

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  if (!API_BASE_URL) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL is not set');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Request failed');
  }

  return response.json() as Promise<T>;
};

export const authService = {
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const data = await request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    authService.setToken(data.token);
    return data;
  },

  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    const data = await request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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
    const token = authService.getToken();
    return !!token;
  },
};
