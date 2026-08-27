import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useLibraryQuery } from '../useLibraryQuery';
import { catalogService } from '../../services/catalog.service';

vi.mock('../../services/catalog.service', () => ({
  catalogService: { search: vi.fn() },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe('useLibraryQuery', () => {
  beforeEach(() => {
    vi.mocked(catalogService.search).mockReset();
  });

  it('passes abort signal to catalog service for cancellation', async () => {
    vi.mocked(catalogService.search).mockResolvedValue({
      data: [],
      nextCursor: null,
      prevCursor: null,
      total: 0,
    });

    renderHook(() => useLibraryQuery({ query: 'react', limit: 24 }), { wrapper });

    await waitFor(() => expect(catalogService.search).toHaveBeenCalled());
    const [, signal] = vi.mocked(catalogService.search).mock.calls[0];
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it('uses distinct query keys per filter set to avoid stale cache bleed', async () => {
    vi.mocked(catalogService.search).mockResolvedValue({
      data: [{ id: '1', title: 'A' }],
      nextCursor: null,
      prevCursor: null,
      total: 1,
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = renderHook(
      ({ query }) => useLibraryQuery({ query, limit: 24 }),
      {
        wrapper: ({ children }) =>
          React.createElement(QueryClientProvider, { client }, children),
        initialProps: { query: 'alpha' },
      }
    );

    await waitFor(() => expect(catalogService.search).toHaveBeenCalledTimes(1));
    rerender({ query: 'beta' });
    await waitFor(() => expect(catalogService.search).toHaveBeenCalledTimes(2));
  });
});
