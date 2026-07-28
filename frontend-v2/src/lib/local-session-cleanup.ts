/**
 * Local-only session teardown for issue #827.
 * api-client's 401 handler called authService.logout(), which issues a
 * remote request through the same pipeline and can recurse on repeated
 * failures. This clears local state only and redirects once.
 */

const SESSION_KEYS = ['accessToken', 'refreshToken', 'auth_user', 'token_expiry'];

let alreadyRedirected = false;

export function clearLocalSession() {
  if (typeof window === 'undefined') return;
  for (const key of SESSION_KEYS) {
    localStorage.removeItem(key);
  }
}

/** Safe to call from multiple concurrent 401s — redirects only once. */
export function redirectToLoginOnce(reason = 'session_expired') {
  clearLocalSession();
  if (typeof window === 'undefined' || alreadyRedirected) return;
  alreadyRedirected = true;
  window.location.href = `/login?reason=${reason}`;
}

/** Reset the redirect guard, e.g. between tests or after a fresh login. */
export function resetRedirectGuard() {
  alreadyRedirected = false;
}
