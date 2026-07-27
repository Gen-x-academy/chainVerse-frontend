import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { authService } from '../auth.service';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

import { apiClient } from '@/src/lib/api-client';

const mockUser = {
  id: '1',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'student' as const,
};

const mockAuthResponse = { user: mockUser, token: 'tok', expiresIn: 3600 };

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Reset document.cookie
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // login
  // ──────────────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('calls POST /auth/login with credentials', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockAuthResponse);
      const result = await authService.login({ email: 'test@example.com', password: 'pass' });
      expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'pass',
      });
      expect(result).toEqual(mockAuthResponse);
    });

    it('throws on network failure', async () => {
      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Network error'));
      await expect(
        authService.login({ email: 'a@b.com', password: 'x' })
      ).rejects.toThrow('Network error');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // register
  // ──────────────────────────────────────────────────────────────────────────

  describe('register', () => {
    it('calls POST /auth/register with payload', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockAuthResponse);
      const payload = { name: 'Test User', email: 'test@example.com', password: 'pass' };
      const result = await authService.register(payload);
      expect(apiClient.post).toHaveBeenCalledWith('/auth/register', payload);
      expect(result).toEqual(mockAuthResponse);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // getToken
  // ──────────────────────────────────────────────────────────────────────────

  describe('getToken', () => {
    it('returns null (token lives in HttpOnly cookie)', () => {
      expect(authService.getToken()).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // logout
  // ──────────────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('calls POST /auth/logout', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce(undefined);
      await authService.logout();
      expect(apiClient.post).toHaveBeenCalledWith('/auth/logout', {});
    });

    it('clears all storage keys', async () => {
      localStorage.setItem('accessToken', 'at');
      localStorage.setItem('refreshToken', 'rt');
      localStorage.setItem('auth_user', JSON.stringify(mockUser));
      localStorage.setItem('token_expiry', '9999999999999');

      vi.mocked(apiClient.post).mockResolvedValueOnce(undefined);
      await authService.logout();

      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
      expect(localStorage.getItem('auth_user')).toBeNull();
      expect(localStorage.getItem('token_expiry')).toBeNull();
    });

    it('still clears storage even when the logout request fails', async () => {
      localStorage.setItem('accessToken', 'at');
      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Network error'));
      await expect(authService.logout()).resolves.toBeUndefined();
      expect(localStorage.getItem('accessToken')).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // isAuthenticated
  // ──────────────────────────────────────────────────────────────────────────

  describe('isAuthenticated', () => {
    it('returns false when no token and no session cookie', () => {
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('returns false when token_expiry is in the past', () => {
      localStorage.setItem('token_expiry', String(Date.now() - 1000));
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('returns true when token_expiry is in the future', () => {
      localStorage.setItem('token_expiry', String(Date.now() + 60_000));
      expect(authService.isAuthenticated()).toBe(true);
    });

    it('returns true when session cookie is present', () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'session=abc123',
      });
      expect(authService.isAuthenticated()).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // getAuthHeaders
  // ──────────────────────────────────────────────────────────────────────────

  describe('getAuthHeaders', () => {
    it('returns Bearer token when accessToken is stored', () => {
      localStorage.setItem('accessToken', 'my-token-123');
      expect(authService.getAuthHeaders()).toEqual({
        Authorization: 'Bearer my-token-123',
      });
    });

    it('returns empty object when no accessToken is stored', () => {
      expect(authService.getAuthHeaders()).toEqual({});
    });
  });
});
