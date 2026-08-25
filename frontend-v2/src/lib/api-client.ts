/**
 * Centralised HTTP client for all API requests.
 * Reads NEXT_PUBLIC_API_BASE_URL from environment; every service should
 * import from here instead of constructing its own fetch wrapper.
 *
 * On 401 responses the client attempts to refresh the access token once
 * via POST /student/refresh-token before redirecting to /login.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

export type RequestOptions = Omit<RequestInit, 'body'> & {
  /** Bearer token to include in the Authorization header. */
  token?: string;
  body?: unknown;
};

const REFRESH_TOKEN_KEY = 'refreshToken';
const ACCESS_TOKEN_KEY = 'accessToken';

/** Attempts to exchange a stored refresh token for a new access token. */
async function attemptTokenRefresh(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE_URL}/student/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json() as { accessToken?: string };
    if (data.accessToken) {
      localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  if (!BASE_URL) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL is not configured');
  }

  const { token, body, headers: extraHeaders, ...init } = options;

  // Include stored access token when available (falls back to explicit token option)
  const storedToken = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
  const bearerToken = token ?? storedToken ?? undefined;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extraHeaders as Record<string, string> | undefined),
    ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (response.status === 401 && !isRetry) {
      const refreshed = await attemptTokenRefresh();
      if (refreshed) {
        // Retry the original request once with the new access token
        return request<T>(path, options, true);
      }
      // Refresh failed — clear tokens and redirect to login
      if (typeof window !== 'undefined') {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        const { authService } = await import('@/src/features/auth/services/auth.service');
        authService.logout();
        window.location.href = '/login?reason=session_expired';
      }
      throw new Error('Session expired');
    }

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new Error(message || `Request failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),

  put: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),

  patch: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),

  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};

export const authedClient = apiClient;
