const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
const ACCESS_TOKEN_KEY = 'accessToken';

export class ScholarshipApiError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'ScholarshipApiError';
  }
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function parseError(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  if (!text) return `Request failed (${response.status})`;
  try {
    const parsed = JSON.parse(text) as { message?: string };
    return parsed.message || text;
  } catch {
    return text;
  }
}

/** Fetch helper with abort + auth for scholarship endpoints (issue #1079). */
export async function scholarshipFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  if (!BASE_URL) {
    throw new ScholarshipApiError('Scholarship features are unavailable until the API is configured', 0);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers as Record<string, string> | undefined) },
  });

  if (!response.ok) {
    const message = await parseError(response);
    throw new ScholarshipApiError(message || `Request failed (${response.status})`, response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}