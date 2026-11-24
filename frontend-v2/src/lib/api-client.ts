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
   * Stable key sent as the `Idempotency-Key` header on mutating requests
   * (POST/PUT/PATCH/DELETE) so retries cannot duplicate side effects.
   */
  idempotencyKey?: string;
  /**
   * Expected resource version sent as `If-Match` for optimistic concurrency.
   * A mismatch surfaces as an {@link ApiConflictError}.
   */
  expectedVersion?: string | number;
};

export class ApiClientError extends Error {
  /** Stable, actionable error code from the server when available. */
  public readonly code?: string;

  constructor(
    public readonly status: number,
    message: string,
    code?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
  }
}

/**
 * Raised for optimistic-concurrency failures (HTTP 409 or 412).
 * Carries the server's current version so callers can render a conflict state
 * and offer a refresh/merge path.
 */
export class ApiConflictError extends ApiClientError {
  constructor(
    status: number,
    message: string,
    public readonly currentVersion?: string | number,
    code?: string,
  ) {
    super(status, message, code);
    this.name = "ApiConflictError";
  }
}

/** Generates a stable idempotency key, falling back when crypto is unavailable. */
export function newIdempotencyKey(): string {
  if (
    typeof globalThis !== "undefined" &&
    typeof globalThis.crypto?.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  // Fallback: RFC 4122 v4-shaped key from Math.random (non-cryptographic).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type ParsedErrorBody = {
  message?: string;
  code?: string;
  currentVersion?: string | number;
  version?: string | number;
};

/** Parses a JSON error body, tolerating non-JSON responses. */
async function parseErrorBody(response: Response): Promise<ParsedErrorBody> {
  const text = await response.text().catch(() => "");
  if (!text) return {};
  try {
    const parsed = JSON.parse(text) as ParsedErrorBody;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return { message: text };
  }
}

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
    expectedVersion,
    ...init
  } = options;

  // Include stored access token when available (falls back to explicit token option)
  const storedToken =
    typeof window !== "undefined"
      ? localStorage.getItem(ACCESS_TOKEN_KEY)
      : null;
  const bearerToken = token ?? storedToken ?? undefined;

  const method = (init.method ?? "GET").toUpperCase();
  const isMutating = MUTATING_METHODS.has(method);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extraHeaders as Record<string, string> | undefined),
    ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
    ...(isMutating && idempotencyKey
      ? { "Idempotency-Key": idempotencyKey }
      : {}),
    ...(expectedVersion !== undefined && expectedVersion !== null
      ? { "If-Match": String(expectedVersion) }
      : {}),
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
      const parsed = await parseErrorBody(response);
      const message =
        parsed.message || `Request failed with status ${response.status}`;
      if (response.status === 409 || response.status === 412) {
        throw new ApiConflictError(
          response.status,
          message,
          parsed.currentVersion ?? parsed.version,
          parsed.code,
        );
      }
      throw new ApiClientError(response.status, message, parsed.code);
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
