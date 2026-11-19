/**
 * Centralised HTTP client for all API requests.
 * Reads NEXT_PUBLIC_API_BASE_URL from environment; every service should
 * import from here instead of constructing its own fetch wrapper.
 *
 * On 401 responses the client attempts to refresh the access token once
 * via POST /student/refresh-token before redirecting to /login.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export type RequestOptions = Omit<RequestInit, "body"> & {
  /** Bearer token to include in the Authorization header. */
  token?: string;
  body?: unknown;
  /**
   * Idempotency key for mutating requests. When provided it is sent as the
   * `Idempotency-Key` header so concurrent/retried mutations cannot duplicate
   * side effects (notes, discussion posts, review finalization, revisions).
   */
  idempotencyKey?: string;
};

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Stable machine-readable error code from the server, when available. */
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

/**
 * Raised on 409 responses. Carries the server's stable error code and the
 * current server-side version so callers can render actionable conflict
 * states (e.g. "this proposal was updated, reload and retry").
 */
export class ApiConflictError extends ApiClientError {
  constructor(
    message: string,
    public readonly code: string,
    /** Current version of the resource on the server, when provided. */
    public readonly currentVersion?: number | string,
    /** Optional structured conflict details (never contains private payloads). */
    public readonly details?: Record<string, unknown>,
  ) {
    super(409, message, code);
    this.name = "ApiConflictError";
  }
}

/** Parses an error response body into a message, code and conflict metadata. */
async function parseErrorBody(
  response: Response,
): Promise<{
  message: string;
  code?: string;
  currentVersion?: number | string;
  details?: Record<string, unknown>;
}> {
  const text = await response.text().catch(() => "");
  if (!text) {
    return { message: `Request failed with status ${response.status}` };
  }
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const message =
      typeof parsed.message === "string"
        ? parsed.message
        : typeof parsed.error === "string"
          ? parsed.error
          : text;
    const code =
      typeof parsed.code === "string"
        ? parsed.code
        : typeof parsed.errorCode === "string"
          ? parsed.errorCode
          : undefined;
    const rawVersion = parsed.currentVersion ?? parsed.version;
    const currentVersion =
      typeof rawVersion === "number" || typeof rawVersion === "string"
        ? rawVersion
        : undefined;
    const details =
      parsed.details && typeof parsed.details === "object"
        ? (parsed.details as Record<string, unknown>)
        : undefined;
    return { message, code, currentVersion, details };
  } catch {
    return { message: text };
  }
}
=======

const REFRESH_TOKEN_KEY = "refreshToken";
const ACCESS_TOKEN_KEY = "accessToken";

/** Attempts to exchange a stored refresh token for a new access token. */
async function attemptTokenRefresh(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE_URL}/student/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { accessToken?: string };
    if (data.accessToken) {
      localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  isRetry = false,
): Promise<T> {
  if (!BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  }

  const {
    token,
    body,
    headers: extraHeaders,
    idempotencyKey,
    ...init
  } = options;

  // Include stored access token when available (falls back to explicit token option)
  const storedToken =
    typeof window !== "undefined"
      ? localStorage.getItem(ACCESS_TOKEN_KEY)
      : null;
  const bearerToken = token ?? storedToken ?? undefined;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extraHeaders as Record<string, string> | undefined),
    ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
    ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
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
      if (typeof window !== "undefined") {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        const { authService } =
          await import("@/src/features/auth/services/auth.service");
        authService.logout();
        window.location.href = "/login?reason=session_expired";
      }
      throw new Error("Session expired");
    }

    if (!response.ok) {
      const { message, code, currentVersion, details } =
        await parseErrorBody(response);
      if (response.status === 409) {
        throw new ApiConflictError(
          message,
          code ?? "CONFLICT",
          currentVersion,
          details,
        );
      }
      throw new ApiClientError(response.status, message, code);
    }

    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),

  post: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),

  put: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),

  patch: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),

  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
};

/**
 * Generates a client-side idempotency key for a mutating request. Callers
 * should create the key once per user intent (not per retry) and reuse it
 * across retries so the server can deduplicate side effects.
 */
export function createIdempotencyKey(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export const authedClient = apiClient;
