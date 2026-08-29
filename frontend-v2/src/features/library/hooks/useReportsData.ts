'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportsService } from '../services/reports.service';
import type { ConditionReport } from '@/components/elibrary/ItemConditionReport';
import type { RepairTicket } from '@/components/elibrary/RepairTracking';
import type { LostItemSummary } from '../types/reports.types';

export interface UseReportsDataOptions {
  enableCondition?: boolean;
  enableLostItem?: boolean;
  enableRepairs?: boolean;
}

const QUERY_KEYS = {
  condition: ['library', 'reports', 'condition'] as const,
  lostItem: ['library', 'reports', 'lost-item'] as const,
  repairs: ['library', 'reports', 'repairs'] as const,
};

/**
 * Aggregates all report-section data fetching and mutations.
 * Each section is only fetched when the caller has the matching permission
 * (controlled by the `enable*` flags).
 *
 * Cached query data for each section is invalidated on successful mutation so
 * stale permission-sensitive data is never served after a role change or logout.
 */
export function useReportsData({
  enableCondition = false,
  enableLostItem = false,
  enableRepairs = false,
}: UseReportsDataOptions = {}) {
  const queryClient = useQueryClient();

  // ── Condition report ─────────────────────────────────────────────────────
  const {
    data: conditionReport,
    isLoading: conditionLoading,
    error: conditionQueryError,
  } = useQuery<ConditionReport | null>({
    queryKey: QUERY_KEYS.condition,
    queryFn: () => reportsService.fetchConditionReport(),
    enabled: enableCondition,
  });

  const conditionMutation = useMutation({
    mutationFn: (updates: Partial<ConditionReport>) =>
      reportsService.updateConditionReport(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.condition });
    },
  });

  // ── Lost item ─────────────────────────────────────────────────────────────
  const {
    data: lostItem,
    isLoading: lostItemLoading,
    error: lostItemQueryError,
  } = useQuery<LostItemSummary | null>({
    queryKey: QUERY_KEYS.lostItem,
    queryFn: () => reportsService.fetchActiveLostItem(),
    enabled: enableLostItem,
  });

  const lostItemMutation = useMutation({
    mutationFn: ({ status, notes }: { status: string; notes: string }) =>
      reportsService.resolveLostItem(status, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lostItem });
    },
  });

  // ── Repair tickets ────────────────────────────────────────────────────────
  const {
    data: repairTickets,
    isLoading: repairLoading,
    error: repairQueryError,
  } = useQuery<RepairTicket[]>({
    queryKey: QUERY_KEYS.repairs,
    queryFn: () => reportsService.fetchRepairTickets(),
    enabled: enableRepairs,
  });

  const createRepairMutation = useMutation({
    mutationFn: (ticket: Omit<RepairTicket, 'id' | 'createdAt' | 'repairLogs'>) =>
      reportsService.createRepairTicket(ticket),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.repairs });
    },
  });

  const updateRepairMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<RepairTicket> }) =>
      reportsService.updateRepairTicket(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.repairs });
    },
  });

  // ── Stable callback wrappers ──────────────────────────────────────────────
  const submitConditionReport = useCallback(
    (updates: Partial<ConditionReport>) => conditionMutation.mutateAsync(updates),
    [conditionMutation],
  );

  const resolveLostItem = useCallback(
    (status: string, notes: string) => lostItemMutation.mutateAsync({ status, notes }),
    [lostItemMutation],
  );

  const createRepairTicket = useCallback(
    (ticket: Omit<RepairTicket, 'id' | 'createdAt' | 'repairLogs'>) =>
      createRepairMutation.mutateAsync(ticket),
    [createRepairMutation],
  );

  const updateRepairTicket = useCallback(
    (id: string, updates: Partial<RepairTicket>) =>
      updateRepairMutation.mutateAsync({ id, updates }),
    [updateRepairMutation],
  );

  return {
    // Data
    conditionReport: conditionReport ?? null,
    conditionLoading,
    conditionError: conditionQueryError ? (conditionQueryError as Error).message : null,

    lostItem: lostItem ?? null,
    lostItemLoading,
    lostItemError: lostItemQueryError ? (lostItemQueryError as Error).message : null,

    repairTickets: repairTickets ?? [],
    repairLoading,
    repairError: repairQueryError ? (repairQueryError as Error).message : null,

    // Mutations
    submitConditionReport,
    resolveLostItem,
    createRepairTicket,
    updateRepairTicket,
  };
}
