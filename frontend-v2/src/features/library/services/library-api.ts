import { parseRateLimit, nextBackoffDelayMs } from '../utils/rateLimitBackoff';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
const ACCESS_TOKEN_KEY = 'accessToken';

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export class LibraryApiError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'LibraryApiError';
  }
}

/** Fetch helper with abort support and 429 backoff for library endpoints. */
export async function libraryFetch<T>(
  path: string,
  init: RequestInit = {},
  attempt = 0
): Promise<T> {
  if (!BASE_URL) {
    throw new LibraryApiError('NEXT_PUBLIC_API_BASE_URL is not configured', 0);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers as Record<string, string> | undefined) },
  });

  const rateLimit = parseRateLimit(response);
  if (rateLimit && attempt < 3) {
    const delay = nextBackoffDelayMs(rateLimit, attempt);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return libraryFetch<T>(path, init, attempt + 1);
  }

  if (response.status === 404) {
    throw new LibraryApiError('Not found', 404);
  }

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new LibraryApiError(message || `Request failed (${response.status})`, response.status);
  }

  return response.json() as Promise<T>;
}
