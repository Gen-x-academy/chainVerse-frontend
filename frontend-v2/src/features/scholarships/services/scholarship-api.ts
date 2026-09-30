/**
 * Scholarship API client (issue #1218).
 *
 * This module no longer reads `accessToken` from `localStorage` directly.
 * Token retrieval is handled by the caller (e.g. `apiClient` auth layer)
 * via the `token` parameter of `scholarshipFetch`. This separation ensures
 * the scholarship service is agnostic to how the token is obtained.
 *
 * Issue #1227: `authFetch` is the wrapper the feature actually uses. It reads
 * the token from the auth store and forwards it, because every call site was
 * previously passing no token at all and shipping unauthenticated requests.
 */

import { useAuthStore } from '@/src/store/authStore';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

/**
 * `RequestInit['body']` is typed as `BodyInit`, which excludes a plain object,
 * but `scholarshipFetch` serialises the body itself. Widening it here keeps
 * call sites free of casts and stops a pre-stringified payload from being
 * double-encoded.
 */
export type ScholarshipRequestInit = Omit<RequestInit, 'body'> & { body?: unknown };

/**
 * A non-2xx scholarship response. Carries the status so callers can branch on
 * 401/403/409 without re-parsing the message.
 */
export class ScholarshipApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ScholarshipApiError';
    this.status = status;
  }
}

/**
 * Authenticated scholarship request.
 *
 * The token is read at call time, never captured at module load: the auth store
 * is persisted, so during module evaluation it has not rehydrated yet and would
 * hand back `null`.
 *
 * Pass `init.body` as a plain object. `scholarshipFetch` serialises it, so
 * pre-stringifying here would double-encode the payload and the server would
 * receive a JSON string instead of an object.
 */
export function authFetch<T>(
  path: string,
  init: ScholarshipRequestInit = {},
): Promise<T> {
  return scholarshipFetch<T>(
    path,
    init as RequestInit,
    useAuthStore.getState().token ?? undefined,
  );
}

/** Fetch helper with abort + auth for scholarship endpoints (issue #1079). */
export async function scholarshipFetch<T>(
  path: string,
  init: RequestInit = {},
  token?: string
): Promise<T> {
  if (!BASE_URL) {
    throw new Error('Scholarship features are unavailable until the API is configured');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });

    if (response.status === 401) {
      // Attempt token refresh once
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
      if (refreshToken) {
        try {
          const res = await fetch(`${BASE_URL}/student/refresh-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
          if (res.ok) {
            const data = await res.json() as { accessToken?: string };
            if (data.accessToken) {
              // Note: token write is handled by the auth layer, not this module
              localStorage.setItem('accessToken', data.accessToken);
              // Retry the request with the new token
              return scholarshipFetch(path, init, data.accessToken);
            }
          }
        } catch {
          // refresh failed
        }
      }
      // Clear tokens and redirect to login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        try {
          const { authService } = await import('@/src/features/auth/services/auth.service');
          authService.logout();
          window.location.href = '/login?reason=session_expired';
        } catch {
          // ignore logout errors
        }
      }
      throw new Error('Session expired');
    }

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new ScholarshipApiError(
        message || `Request failed with status ${response.status}`,
        response.status,
      );
    }

    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timeoutId);
  }
}