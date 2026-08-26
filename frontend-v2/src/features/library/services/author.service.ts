import { libraryFetch } from './library-api';
import type { Author, AuthorBooksResponse, AuthorSummary } from '../types/author.types';

export const authorService = {
  getAuthor: (id: string) => libraryFetch<Author>(`/library/authors/${id}`),

  getAuthorBooks: (id: string, page = 1, limit = 12) =>
    libraryFetch<AuthorBooksResponse>(
      `/library/authors/${id}/books?page=${page}&limit=${limit}`
    ),

  searchAuthors: (query: string, page = 1, limit = 12) =>
    libraryFetch<{ data: AuthorSummary[]; total: number; page: number; limit: number }>(
      `/library/authors?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
    ),
};
