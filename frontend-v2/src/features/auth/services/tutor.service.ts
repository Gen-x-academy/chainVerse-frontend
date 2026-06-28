import crypto from 'crypto';

const PBKDF2_ITERATIONS = 310_000;
const PBKDF2_KEYLEN = 32; // bytes → 64 hex chars
const PBKDF2_DIGEST = 'sha256';

export class TutorService {
  /**
   * Hashes a password using PBKDF2 with a cryptographically random salt.
   * Returns a string in the format `<salt>:<hash>` (both hex-encoded).
   */
  async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await this.pbkdf2(password, salt);
    return `${salt}:${hash}`;
  }

  /**
   * Verifies a plain-text password against a stored PBKDF2 hash.
   *
   * Fix for #391: replaces the vulnerable `hash === verify` string comparison
   * with `crypto.timingSafeEqual` to prevent timing-based side-channel attacks.
   * An attacker measuring response latency can no longer infer correct password
   * characters because the comparison now runs in constant time.
   */
  async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;

    const [salt, hash] = parts;
    if (!salt || !hash) return false;

    const verify = await this.pbkdf2(password, salt);

    const hashBuf = Buffer.from(hash, 'hex');
    const verifyBuf = Buffer.from(verify, 'hex');

    // Buffers must be the same length for timingSafeEqual; a length mismatch
    // itself reveals that the stored hash is malformed (not a password error).
    if (hashBuf.length !== verifyBuf.length) return false;

    return crypto.timingSafeEqual(hashBuf, verifyBuf);
  }

  private pbkdf2(password: string, salt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        password,
        salt,
        PBKDF2_ITERATIONS,
        PBKDF2_KEYLEN,
        PBKDF2_DIGEST,
        (err, derivedKey) => {
          if (err) reject(err);
          else resolve(derivedKey.toString('hex'));
        },
      );
    });
  }
}

export const tutorService = new TutorService();
