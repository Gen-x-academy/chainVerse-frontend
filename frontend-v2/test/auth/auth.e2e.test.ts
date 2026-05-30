import { vi, describe, it, expect, beforeEach } from 'vitest';
import { authService } from '@/src/features/auth/services/auth.service';

vi.mock('@/lib/api-client', () => ({
  apiClient: { post: vi.fn() },
}));

import { apiClient } from '@/lib/api-client';

const mockResponse = {
  user: { id: '1', email: 'student@test.com', firstName: 'A', lastName: 'B', role: 'student' as const },
  token: 'tok123',
  expiresIn: 3600,
};

describe('Auth flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(document, 'cookie', { writable: true, value: '' });
  });

  it('register: calls POST /api/auth/register', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponse);
    const result = await authService.register({ name: 'A B', email: 'student@test.com', password: 'pass' });
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/register', expect.any(Object));
    expect(result.token).toBe('tok123');
  });

  it('login: calls POST /api/auth/login', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponse);
    const result = await authService.login({ email: 'student@test.com', password: 'pass' });
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/login', expect.any(Object));
    expect(result.user.role).toBe('student');
  });

  it('protected route: unauthenticated returns false', () => {
    expect(authService.isAuthenticated()).toBe(false);
  });

  it('logout: completes even on network failure', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Network error'));
    await expect(authService.logout()).resolves.toBeUndefined();
  });
});