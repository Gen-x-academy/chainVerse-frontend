import { vi, describe, it, expect, beforeEach } from 'vitest';
import { StudentAuthService } from '@/src/features/auth/services/student-auth.service';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { apiClient } from '@/src/lib/api-client';

describe('StudentAuthService', () => {
  let service: StudentAuthService;

  beforeEach(() => {
    service = new StudentAuthService();
    vi.clearAllMocks();
  });

  describe('verifyJwt', () => {
    it('throws on invalid JWT format', () => {
      expect(() => service.verifyJwt('not.a.jwt.token.extra')).toThrow();
    });

    it('throws on expired token', () => {
      // exp in the past
      const payload = { sub: '1', exp: Math.floor(Date.now() / 1000) - 100 };
      const encoded = btoa(JSON.stringify(payload));
      const token = `header.${encoded}.sig`;
      expect(() => service.verifyJwt(token)).toThrow();
    });
  });

  describe('refreshToken', () => {
    it('throws when refresh token is invalid', async () => {
      await expect(
        service.refreshToken({ refreshToken: 'bad.token', studentId: '1' })
      ).rejects.toThrow();
    });

    it('returns access token on valid refresh', async () => {
      const payload = { sub: '1', family: 'f1', exp: Math.floor(Date.now() / 1000) + 3600 };
      const encoded = btoa(JSON.stringify(payload));
      const token = `header.${encoded}.sig`;
      vi.mocked(apiClient.post).mockResolvedValueOnce({ accessToken: 'new-token', expiresIn: 3600 });
      const result = await service.refreshToken({ refreshToken: token, studentId: '1' });
      expect(result.accessToken).toBe('new-token');
    });
  });
});