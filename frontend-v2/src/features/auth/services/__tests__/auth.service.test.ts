import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { authService } from '../auth.service';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

import { apiClient } from '@/lib/api-client';

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
    // Reset document.cookie
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('login', () => {
    it('calls POST /api/auth/login with credentials', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockAuthResponse);
      const result = await authService.login({ email: 'test@example.com', password: 'pass' });
      expect(apiClient.post).toHaveBeenCalledWith('/api/auth/login', {
        email: 'test@example.com',
        password: 'pass',
      });
      expect(result).toEqual(mockAuthResponse);
    });

    it('propagates errors from apiClient', async () => {
      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Network error'));
      await expect(authService.login({ email: 'a@b.com', password: 'x' })).rejects.toThrow('Network error');
    });
  });

  describe('register', () => {
    it('calls POST /api/auth/register with payload', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockAuthResponse);
      const payload = { name: 'Test User', email: 'test@example.com', password: 'pass' };
      const result = await authService.register(payload);
      expect(apiClient.post).toHaveBeenCalledWith('/api/auth/register', payload);
      expect(result).toEqual(mockAuthResponse);
    });
  });

  describe('getToken', () => {
    it('returns null (token is HttpOnly cookie)', () => {
      expect(authService.getToken()).toBeNull();
    });
  });

  describe('logout', () => {
    it('calls POST /api/auth/logout', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce(undefined);
      await authService.logout();
      expect(apiClient.post).toHaveBeenCalledWith('/api/auth/logout', {});
    });

    it('completes even when logout request fails', async () => {
      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Network error'));
      await expect(authService.logout()).resolves.toBeUndefined();
    });
  });

  describe('isAuthenticated', () => {
    it('returns false when no session cookie', () => {
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('returns true when session cookie is present', () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'session=abc123',
      });
      expect(authService.isAuthenticated()).toBe(true);
    });
  });
});
