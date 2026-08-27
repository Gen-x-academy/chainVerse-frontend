'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookService } from '../services/book.service';
import { isbnService } from '../services/isbn.service';
import type { BookCreatePayload, BookStatus, BookUpdatePayload } from '../types/book.types';

export const bookKeys = {
  all: ['library', 'books'] as const,
  lists: () => [...bookKeys.all, 'list'] as const,
  list: (page: number, pageSize: number) => [...bookKeys.lists(), { page, pageSize }] as const,
  details: () => [...bookKeys.all, 'detail'] as const,
  detail: (id: string) => [...bookKeys.details(), id] as const,
  isbn: (isbn: string) => ['library', 'isbn', isbn] as const,
};

export function useBookList(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: bookKeys.list(page, pageSize),
    queryFn: () => bookService.list(page, pageSize),
  });
}

export function useBook(id: string) {
  return useQuery({
    queryKey: bookKeys.detail(id),
    queryFn: () => bookService.getById(id),
    enabled: Boolean(id),
  });
}

export function useCreateBook() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: BookCreatePayload) => bookService.create(payload),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: bookKeys.lists() });
    },
  });
}

export function useUpdateBook() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      version,
      payload,
    }: {
      id: string;
      version: number;
      payload: BookUpdatePayload;
    }) => bookService.update(id, version, payload),
    onSuccess: (data) => {
      client.setQueryData(bookKeys.detail(data.id), data);
      client.invalidateQueries({ queryKey: bookKeys.lists() });
    },
  });
}

export function useBookStatusTransition() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      version,
      status,
    }: {
      id: string;
      version: number;
      status: BookStatus;
    }) => bookService.transitionStatus(id, version, status),
    onSuccess: (data) => {
      client.setQueryData(bookKeys.detail(data.id), data);
      client.invalidateQueries({ queryKey: bookKeys.lists() });
    },
  });
}

export function useISBNLookup(isbn: string, enabled = false) {
  return useQuery({
    queryKey: bookKeys.isbn(isbn),
    queryFn: () => isbnService.lookup(isbn),
    enabled: enabled && isbn.length >= 10,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
