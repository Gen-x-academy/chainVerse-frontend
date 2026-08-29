'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reportsService } from '../services/reports.service';
import type {
  CreateRepairTicketPayload,
  ResolveLostItemPayload,
  UpdateConditionPayload,
  UpdateRepairTicketPayload,
} from '../types/reports.types';

// ─── Query key factory ────────────────────────────────────────────────────────

export const reportKeys = {
  all: ['library', 'reports'] as const,

  condition: (itemId: string) => [...reportKeys.all, 'conditions', itemId] as const,

  repairs: () => [...reportKeys.all, 'repairs'] as const,
  repair: (ticketId: string) => [...reportKeys.all, 'repairs', ticketId] as const,

  lostItems: () => [...reportKeys.all, 'lost-items'] as const,
  lostItem: (caseId: string) => [...reportKeys.all, 'lost-items', caseId] as const,
};

// ─── Condition reports ────────────────────────────────────────────────────────

export function useConditionReport(itemId: string) {
  return useQuery({
    queryKey: reportKeys.condition(itemId),
    queryFn: () => reportsService.getConditionReport(itemId),
    enabled: Boolean(itemId),
    staleTime: 30_000,
    retry: (failureCount, error) => {
      // Don't retry 403 / 404 — they won't resolve on their own.
      const status = (error as { statusCode?: number })?.statusCode;
      if (status === 403 || status === 404) return false;
      return failureCount < 2;
    },
  });
}

export function useUpdateConditionReport(itemId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      payload,
      version,
    }: {
      payload: UpdateConditionPayload;
      version?: string;
    }) => reportsService.updateConditionReport(itemId, payload, { version }),
    onSuccess: (updated) => {
      // Replace the stale entry so the activity history refreshes immediately.
      client.setQueryData(reportKeys.condition(itemId), updated);
    },
  });
}

// ─── Repair tickets ───────────────────────────────────────────────────────────

export function useRepairTickets() {
  return useQuery({
    queryKey: reportKeys.repairs(),
    queryFn: ({ signal }) => reportsService.listRepairTickets(signal),
    staleTime: 30_000,
    retry: (failureCount, error) => {
      const status = (error as { statusCode?: number })?.statusCode;
      if (status === 403) return false;
      return failureCount < 2;
    },
  });
}

export function useCreateRepairTicket() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRepairTicketPayload) =>
      reportsService.createRepairTicket(payload),
    onSuccess: () => {
      // Invalidate the list so the new ticket appears without a manual refresh.
      client.invalidateQueries({ queryKey: reportKeys.repairs() });
    },
  });
}

export function useUpdateRepairTicket() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      ticketId,
      payload,
      version,
    }: {
      ticketId: string;
      payload: UpdateRepairTicketPayload;
      version?: string;
    }) => reportsService.updateRepairTicket(ticketId, payload, { version }),
    onSuccess: (updated) => {
      client.setQueryData(reportKeys.repair(updated.id), updated);
      // Also invalidate the list view so statuses stay in sync.
      client.invalidateQueries({ queryKey: reportKeys.repairs() });
    },
  });
}

// ─── Lost-item cases ──────────────────────────────────────────────────────────

export function useLostItemCases() {
  return useQuery({
    queryKey: reportKeys.lostItems(),
    queryFn: ({ signal }) => reportsService.listLostItemCases(signal),
    staleTime: 30_000,
    retry: (failureCount, error) => {
      const status = (error as { statusCode?: number })?.statusCode;
      if (status === 403) return false;
      return failureCount < 2;
    },
  });
}

export function useResolveLostItem(caseId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      payload,
      version,
    }: {
      payload: ResolveLostItemPayload;
      version?: string;
    }) => reportsService.resolveLostItem(caseId, payload, { version }),
    onSuccess: (updated) => {
      // Refresh the individual case and the list.
      client.setQueryData(reportKeys.lostItem(caseId), updated);
      client.invalidateQueries({ queryKey: reportKeys.lostItems() });
    },
  });
}
