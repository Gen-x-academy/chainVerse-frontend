import type { ISBNLookupResult } from '../types/book.types';
import { BookServiceError } from './book.service';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

function normalizeIsbn(raw: string): string {
  return raw.replace(/[-\s]/g, '');
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export const isbnService = {
  async lookup(rawIsbn: string): Promise<ISBNLookupResult> {
    if (!BASE_URL) {
      throw new BookServiceError('API is not configured', 500, 'unknown');
    }

    const isbn = normalizeIsbn(rawIsbn);
    if (isbn.length !== 10 && isbn.length !== 13) {
      throw new BookServiceError('ISBN must be 10 or 13 digits', 400, 'validation', {
        fieldErrors: { isbn: 'ISBN must be 10 or 13 digits' },
      });
    }

    const res = await fetch(`${BASE_URL}/library/isbn/${isbn}/lookup`, {
      headers: getAuthHeaders(),
    });

    if (res.status === 404) {
      throw new BookServiceError('No metadata found for this ISBN', 404, 'not_found');
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new BookServiceError(body || 'ISBN lookup failed', res.status, 'unknown');
    }

    return res.json() as Promise<ISBNLookupResult>;
  },

  normalizeIsbn,
};
