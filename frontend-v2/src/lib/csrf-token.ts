/**
 * CSRF protection helper for issue #832.
 * Pairs a random token stored in a readable cookie with a matching request
 * header so the server can reject cross-origin, cookie-authenticated
 * mutations that don't echo the token back.
 */

const CSRF_HEADER = 'X-CSRF-Token';
const CSRF_COOKIE = 'csrf_token';

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function ensureCsrfCookie(): string {
  let token = readCookie(CSRF_COOKIE);
  if (!token) {
    token = generateCsrfToken();
    document.cookie = `${CSRF_COOKIE}=${token}; Path=/; SameSite=Strict; Secure`;
  }
  return token;
}

export function withCsrfHeader(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set(CSRF_HEADER, ensureCsrfCookie());
  return { ...init, headers, credentials: 'same-origin' };
}
