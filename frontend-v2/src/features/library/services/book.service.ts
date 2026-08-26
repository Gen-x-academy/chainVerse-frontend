import type {
  Book,
  BookCreatePayload,
  BookStatus,
  BookUpdatePayload,
  BookConflictPayload,
  BookValidationError,
} from '../types/book.types';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

export class BookServiceError extends Error {
  readonly status: number;
  readonly code: 'validation' | 'conflict' | 'not_found' | 'forbidden' | 'unknown';
  readonly fieldErrors?: Record<string, string>;
  readonly conflict?: BookConflictPayload;

  constructor(
    message: string,
    status: number,
    code: BookServiceError['code'],
    extras?: { fieldErrors?: Record<string, string>; conflict?: BookConflictPayload }
  ) {
    super(message);
    this.name = 'BookServiceError';
    this.status = status;
    this.code = code;
    this.fieldErrors = extras?.fieldErrors;
    this.conflict = extras?.conflict;
  }
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function parseErrorResponse(res: Response): Promise<BookServiceError> {
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    /* non-JSON body */
  }

  if (res.status === 422) {
    const fieldErrors = (body.fieldErrors ?? body.errors ?? {}) as Record<string, string>;
    return new BookServiceError(
      (body.message as string) ?? 'Validation failed',
      422,
      'validation',
      { fieldErrors }
    );
  }

  if (res.status === 409) {
    const conflict: BookConflictPayload = {
      status: 409,
      message: (body.message as string) ?? 'Record was modified by another user',
      serverVersion: body.serverVersion as number,
      serverRecord: body.serverRecord as Book,
      clientVersion: body.clientVersion as number,
    };
    return new BookServiceError(conflict.message, 409, 'conflict', { conflict });
  }

  if (res.status === 404) {
    return new BookServiceError('Book not found', 404, 'not_found');
  }

  if (res.status === 403) {
    return new BookServiceError('You do not have permission for this action', 403, 'forbidden');
  }

  return new BookServiceError(
    (body.message as string) ?? `Request failed (${res.status})`,
    res.status,
    'unknown'
  );
}

async function libraryFetch<T>(
  path: string,
  init: RequestInit & { version?: number } = {}
): Promise<T> {
  if (!BASE_URL) {
    throw new BookServiceError('API is not configured', 500, 'unknown');
  }

  const { version, headers: extraHeaders, ...rest } = init;
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    ...(extraHeaders as Record<string, string> | undefined),
  };
  if (version !== undefined) {
    headers['If-Match'] = String(version);
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...rest, headers });
  if (!res.ok) throw await parseErrorResponse(res);

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const bookService = {
  list: (page = 1, pageSize = 20) =>
    libraryFetch<{ data: Book[]; total: number }>(
      `/library/books?page=${page}&pageSize=${pageSize}`
    ),

  getById: (id: string) => libraryFetch<Book>(`/library/books/${id}`),

  create: (payload: BookCreatePayload) =>
    libraryFetch<Book>('/library/books', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (id: string, version: number, payload: BookUpdatePayload) =>
    libraryFetch<Book>(`/library/books/${id}`, {
      method: 'PATCH',
      version,
      body: JSON.stringify(payload),
    }),

  transitionStatus: (id: string, version: number, status: BookStatus) =>
    libraryFetch<Book>(`/library/books/${id}/status`, {
      method: 'POST',
      version,
      body: JSON.stringify({ status }),
    }),
};

export type { BookValidationError, BookConflictPayload };
