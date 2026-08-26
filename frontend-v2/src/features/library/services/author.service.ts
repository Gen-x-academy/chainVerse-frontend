import type { Author } from '../types/author.types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export const authorService = {
  async getAuthor(id: string): Promise<Author> {
    const res = await fetch(`${API_BASE}/authors/${id}`);
    if (!res.ok) throw new Error('Failed to fetch author');
    return res.json();
  },

  async getAuthorBooks(id: string) {
    const res = await fetch(`${API_BASE}/authors/${id}/books`);
    if (!res.ok) throw new Error('Failed to fetch author books');
    return res.json();
  },
};
