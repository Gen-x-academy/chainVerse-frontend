import { libraryFetch } from './library-api';
import type { ArchivedBook, ArchivedBooksResponse } from '../types/archive.types';

export const archiveService = {
  listArchived: (page = 1, limit = 20, signal?: AbortSignal) =>
    libraryFetch<ArchivedBooksResponse>(
      `/library/catalog/archived?page=${page}&limit=${limit}`,
      { signal }
    ),

  restore: (bookId: string) =>
    libraryFetch<ArchivedBook>(`/library/catalog/${bookId}/restore`, { method: 'POST' }),
};
