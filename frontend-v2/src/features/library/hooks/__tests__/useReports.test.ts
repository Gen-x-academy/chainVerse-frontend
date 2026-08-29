import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useConditionReport,
  useUpdateConditionReport,
  useRepairTickets,
  useCreateRepairTicket,
  useUpdateRepairTicket,
  useLostItemCases,
  useResolveLostItem,
  reportKeys,
} from '../useReports';
import { reportsService } from '../../services/reports.service';
import type {
  ConditionReport,
  LostItemCase,
  PaginatedResponse,
  RepairTicket,
  UpdateConditionPayload,
} from '../../types/reports.types';

// ─── Service mock ─────────────────────────────────────────────────────────────

vi.mock('../../services/reports.service', () => ({
  reportsService: {
    getConditionReport: vi.fn(),
    updateConditionReport: vi.fn(),
    listRepairTickets: vi.fn(),
    getRepairTicket: vi.fn(),
    createRepairTicket: vi.fn(),
    updateRepairTicket: vi.fn(),
    listLostItemCases: vi.fn(),
    getLostItemCase: vi.fn(),
    resolveLostItem: vi.fn(),
  },
}));

// ─── Test wrapper ─────────────────────────────────────────────────────────────

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const stubConditionReport: ConditionReport = {
  itemId: 'item-001',
  title: 'The Great Gatsby',
  currentCondition: 'good',
  repairStatus: 'not-needed',
  notes: '',
  evidence: [],
  activityHistory: [],
};

const stubRepairTicket: RepairTicket = {
  id: 'ticket-001',
  itemId: 'item-001',
  itemTitle: 'The Great Gatsby',
  issueDescription: 'Torn cover',
  priority: 'medium',
  status: 'scheduled',
  createdAt: '2026-01-01T00:00:00Z',
  repairLogs: [],
  evidence: [],
};

const stubLostItemCase: LostItemCase = {
  id: 'case-001',
  itemId: 'item-001',
  itemTitle: '1984',
  replacementCost: 29.99,
  status: 'disputed',
  activityHistory: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function paginatedOf<T>(items: T[]): PaginatedResponse<T> {
  return { data: items, total: items.length, nextCursor: null, prevCursor: null };
}

// ─── Query key factory ────────────────────────────────────────────────────────

describe('reportKeys', () => {
  it('produces distinct keys for different item IDs', () => {
    expect(reportKeys.condition('item-001')).not.toEqual(reportKeys.condition('item-002'));
  });

  it('repairs and lost-items keys do not overlap', () => {
    expect(reportKeys.repairs()).not.toEqual(reportKeys.lostItems());
  });
});

// ─── useConditionReport ───────────────────────────────────────────────────────

describe('useConditionReport', () => {
  beforeEach(() => vi.mocked(reportsService.getConditionReport).mockReset());

  it('returns data on success', async () => {
    vi.mocked(reportsService.getConditionReport).mockResolvedValue(stubConditionReport);

    const { result } = renderHook(() => useConditionReport('item-001'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(stubConditionReport);
  });

  it('surfaces an error on failure', async () => {
    vi.mocked(reportsService.getConditionReport).mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useConditionReport('item-001'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Not found');
  });

  it('does not fetch when itemId is empty', () => {
    renderHook(() => useConditionReport(''), { wrapper: makeWrapper() });
    expect(reportsService.getConditionReport).not.toHaveBeenCalled();
  });
});

// ─── useUpdateConditionReport ─────────────────────────────────────────────────

describe('useUpdateConditionReport', () => {
  beforeEach(() => vi.mocked(reportsService.updateConditionReport).mockReset());

  it('updates the cache entry on success', async () => {
    const updated = { ...stubConditionReport, currentCondition: 'worn' as const };
    vi.mocked(reportsService.updateConditionReport).mockResolvedValue(updated);

    const { result } = renderHook(() => useUpdateConditionReport('item-001'), {
      wrapper: makeWrapper(),
    });

    const payload: UpdateConditionPayload = {
      currentCondition: 'worn',
      repairStatus: 'not-needed',
      notes: 'Worn spine',
    };

    await result.current.mutateAsync({ payload });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(reportsService.updateConditionReport).toHaveBeenCalledWith(
      'item-001',
      payload,
      expect.objectContaining({})
    );
  });

  it('exposes an error when the mutation fails', async () => {
    vi.mocked(reportsService.updateConditionReport).mockRejectedValue(
      new Error('Conflict')
    );

    const { result } = renderHook(() => useUpdateConditionReport('item-001'), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        payload: { currentCondition: 'good', repairStatus: 'not-needed', notes: '' },
      })
    ).rejects.toThrow('Conflict');

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('forwards the version header for optimistic conflict detection', async () => {
    vi.mocked(reportsService.updateConditionReport).mockResolvedValue(stubConditionReport);

    const { result } = renderHook(() => useUpdateConditionReport('item-001'), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({
      payload: { currentCondition: 'good', repairStatus: 'not-needed', notes: '' },
      version: 'W/"abc123"',
    });

    expect(reportsService.updateConditionReport).toHaveBeenCalledWith(
      'item-001',
      expect.anything(),
      { version: 'W/"abc123"' }
    );
  });
});

// ─── useRepairTickets ─────────────────────────────────────────────────────────

describe('useRepairTickets', () => {
  beforeEach(() => vi.mocked(reportsService.listRepairTickets).mockReset());

  it('returns the tickets list on success', async () => {
    vi.mocked(reportsService.listRepairTickets).mockResolvedValue(
      paginatedOf([stubRepairTicket])
    );

    const { result } = renderHook(() => useRepairTickets(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toEqual([stubRepairTicket]);
  });

  it('surfaces a 403 error without retrying', async () => {
    const authError = Object.assign(new Error('Forbidden'), { statusCode: 403 });
    vi.mocked(reportsService.listRepairTickets).mockRejectedValue(authError);

    const { result } = renderHook(() => useRepairTickets(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(reportsService.listRepairTickets).toHaveBeenCalledTimes(1); // no retries
  });
});

// ─── useCreateRepairTicket ────────────────────────────────────────────────────

describe('useCreateRepairTicket', () => {
  beforeEach(() => {
    vi.mocked(reportsService.createRepairTicket).mockReset();
    vi.mocked(reportsService.listRepairTickets).mockReset();
  });

  it('calls createRepairTicket and invalidates the list', async () => {
    vi.mocked(reportsService.createRepairTicket).mockResolvedValue(stubRepairTicket);
    vi.mocked(reportsService.listRepairTickets).mockResolvedValue(
      paginatedOf([stubRepairTicket])
    );

    const { result } = renderHook(() => useCreateRepairTicket(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({
      itemId: 'item-001',
      itemTitle: 'The Great Gatsby',
      issueDescription: 'Torn cover',
      priority: 'medium',
      status: 'scheduled',
      evidence: [],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(reportsService.createRepairTicket).toHaveBeenCalledOnce();
  });

  it('exposes an error on failure', async () => {
    vi.mocked(reportsService.createRepairTicket).mockRejectedValue(
      new Error('Validation failed')
    );

    const { result } = renderHook(() => useCreateRepairTicket(), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        itemId: 'item-001',
        itemTitle: '',
        issueDescription: '',
        priority: 'low',
        status: 'scheduled',
        evidence: [],
      })
    ).rejects.toThrow('Validation failed');
  });
});

// ─── useUpdateRepairTicket ────────────────────────────────────────────────────

describe('useUpdateRepairTicket', () => {
  beforeEach(() => vi.mocked(reportsService.updateRepairTicket).mockReset());

  it('updates the cache and invalidates the list', async () => {
    const updated = { ...stubRepairTicket, status: 'completed' as const };
    vi.mocked(reportsService.updateRepairTicket).mockResolvedValue(updated);
    vi.mocked(reportsService.listRepairTickets).mockResolvedValue(paginatedOf([updated]));

    const { result } = renderHook(() => useUpdateRepairTicket(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({ ticketId: 'ticket-001', payload: { status: 'completed' } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

// ─── useLostItemCases ─────────────────────────────────────────────────────────

describe('useLostItemCases', () => {
  beforeEach(() => vi.mocked(reportsService.listLostItemCases).mockReset());

  it('returns case list on success', async () => {
    vi.mocked(reportsService.listLostItemCases).mockResolvedValue(
      paginatedOf([stubLostItemCase])
    );

    const { result } = renderHook(() => useLostItemCases(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toEqual([stubLostItemCase]);
  });

  it('surfaces a 403 without retrying', async () => {
    const authError = Object.assign(new Error('Forbidden'), { statusCode: 403 });
    vi.mocked(reportsService.listLostItemCases).mockRejectedValue(authError);

    const { result } = renderHook(() => useLostItemCases(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(reportsService.listLostItemCases).toHaveBeenCalledTimes(1);
  });
});

// ─── useResolveLostItem ───────────────────────────────────────────────────────

describe('useResolveLostItem', () => {
  beforeEach(() => {
    vi.mocked(reportsService.resolveLostItem).mockReset();
    vi.mocked(reportsService.listLostItemCases).mockReset();
  });

  it('resolves the case and updates the cache', async () => {
    const resolved = { ...stubLostItemCase, status: 'paid' as const };
    vi.mocked(reportsService.resolveLostItem).mockResolvedValue(resolved);
    vi.mocked(reportsService.listLostItemCases).mockResolvedValue(paginatedOf([resolved]));

    const { result } = renderHook(() => useResolveLostItem('case-001'), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({ payload: { status: 'paid', notes: 'Fee collected' } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(reportsService.resolveLostItem).toHaveBeenCalledWith(
      'case-001',
      { status: 'paid', notes: 'Fee collected' },
      expect.objectContaining({})
    );
  });

  it('forwards a version header for conflict detection', async () => {
    const resolved = { ...stubLostItemCase, status: 'found' as const };
    vi.mocked(reportsService.resolveLostItem).mockResolvedValue(resolved);
    vi.mocked(reportsService.listLostItemCases).mockResolvedValue(paginatedOf([resolved]));

    const { result } = renderHook(() => useResolveLostItem('case-001'), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({
      payload: { status: 'found', notes: 'Returned' },
      version: 'W/"xyz"',
    });

    expect(reportsService.resolveLostItem).toHaveBeenCalledWith(
      'case-001',
      expect.anything(),
      { version: 'W/"xyz"' }
    );
  });

  it('exposes an error on rejection', async () => {
    vi.mocked(reportsService.resolveLostItem).mockRejectedValue(new Error('Conflict'));

    const { result } = renderHook(() => useResolveLostItem('case-001'), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.mutateAsync({ payload: { status: 'disputed', notes: 'Filed' } })
    ).rejects.toThrow('Conflict');

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
