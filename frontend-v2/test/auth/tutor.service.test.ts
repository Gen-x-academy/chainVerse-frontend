import fs from 'fs';
import path from 'path';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TutorService } from '@/src/features/auth/services/tutor.service';

describe('TutorService', () => {
  let service: TutorService;

  beforeEach(() => {
    service = new TutorService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hashPassword', () => {
    it('returns a string in salt:hash format', async () => {
      const result = await service.hashPassword('mypassword');
      const parts = result.split(':');
      expect(parts).toHaveLength(2);
      expect(parts[0]).toHaveLength(32); // 16 random bytes → 32 hex chars
      expect(parts[1]).toHaveLength(64); // 32-byte key → 64 hex chars
    });

    it('produces a different hash on each call (unique salt)', async () => {
      const hash1 = await service.hashPassword('mypassword');
      const hash2 = await service.hashPassword('mypassword');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('returns true for the correct password', async () => {
      const stored = await service.hashPassword('correct-password');
      const result = await service.verifyPassword('correct-password', stored);
      expect(result).toBe(true);
    });

    it('returns false for an incorrect password', async () => {
      const stored = await service.hashPassword('correct-password');
      const result = await service.verifyPassword('wrong-password', stored);
      expect(result).toBe(false);
    });

    it('returns false when storedHash has no colon separator', async () => {
      const result = await service.verifyPassword('password', 'notahash');
      expect(result).toBe(false);
    });

    it('returns false when storedHash is an empty string', async () => {
      const result = await service.verifyPassword('password', '');
      expect(result).toBe(false);
    });

    it('uses crypto.timingSafeEqual — not string === — to prevent timing attacks', () => {
      const servicePath = path.resolve(process.cwd(), 'src/features/auth/services/tutor.service.ts');
      const source = fs.readFileSync(servicePath, 'utf8');

      expect(source).toContain('crypto.timingSafeEqual');
      expect(source).not.toContain('return hash === verify');
    });

    it('returns false when storedHash is malformed', async () => {
      const result = await service.verifyPassword('password', 'no-colon-here');

      expect(result).toBe(false);
    });
  });
});
