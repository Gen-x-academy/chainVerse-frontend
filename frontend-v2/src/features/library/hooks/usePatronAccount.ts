'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountService } from '../services/account.service';
import type { AccountAutoRenewal } from '../types/account.types';

export const accountKeys = {
  all: ['library', 'account'] as const,
  summary: (patronId: string) => [...accountKeys.all, 'summary', patronId] as const,
  loans: (patronId: string) => [...accountKeys.all, 'loans', patronId] as const,
  holds: (patronId: string) => [...accountKeys.all, 'holds', patronId] as const,
  fines: (patronId: string) => [...accountKeys.all, 'fines', patronId] as const,
  ledger: (patronId: string) => [...accountKeys.all, 'ledger', patronId] as const,
  notifications: (patronId: string) => [...accountKeys.all, 'notifications', patronId] as const,
  autoRenewal: (patronId: string) => [...accountKeys.all, 'autoRenewal', patronId] as const,
};

function stablePatronId(patronId?: string): string {
  return patronId || 'self';
}

export function useAccountSummary(patronId?: string) {
  return useQuery({
    queryKey: accountKeys.summary(stablePatronId(patronId)),
    queryFn: ({ signal }) => accountService.getSummary(stablePatronId(patronId), signal),
    enabled: Boolean(patronId),
    staleTime: 15 * 1000,
  });
}

export function useCurrentLoans(patronId?: string) {
  return useQuery({
    queryKey: accountKeys.loans(stablePatronId(patronId)),
    queryFn: ({ signal }) => accountService.getCurrentLoans(stablePatronId(patronId), signal),
    enabled: Boolean(patronId),
    staleTime: 15 * 1000,
  });
}

export function useAccountHolds(patronId?: string) {
  return useQuery({
    queryKey: accountKeys.holds(stablePatronId(patronId)),
    queryFn: ({ signal }) => accountService.getHolds(stablePatronId(patronId), signal),
    enabled: Boolean(patronId),
    staleTime: 30 * 1000,
  });
}

export function useOutstandingFines(patronId?: string) {
  return useQuery({
    queryKey: accountKeys.fines(stablePatronId(patronId)),
    queryFn: ({ signal }) => accountService.getOutstandingFines(stablePatronId(patronId), signal),
    enabled: Boolean(patronId),
    staleTime: 30 * 1000,
  });
}

export function useFinesLedger(patronId?: string) {
  return useQuery({
    queryKey: accountKeys.ledger(stablePatronId(patronId)),
    queryFn: ({ signal }) => accountService.getLedger(stablePatronId(patronId), signal),
    enabled: Boolean(patronId),
    staleTime: 30 * 1000,
  });
}

export function useAccountNotifications(patronId?: string) {
  return useQuery({
    queryKey: accountKeys.notifications(stablePatronId(patronId)),
    queryFn: ({ signal }) => accountService.getNotifications(stablePatronId(patronId), signal),
    enabled: Boolean(patronId),
    staleTime: 30 * 1000,
  });
}

export function useAutoRenewal(patronId?: string) {
  return useQuery({
    queryKey: accountKeys.autoRenewal(stablePatronId(patronId)),
    queryFn: ({ signal }) => accountService.getAutoRenewal(stablePatronId(patronId), signal),
    enabled: Boolean(patronId),
    staleTime: 30 * 1000,
  });
}

export function useRenewLoan(patronId?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (loanId: string) => accountService.renewLoan(loanId),
    onSuccess: () => {
      const id = stablePatronId(patronId);
      client.invalidateQueries({ queryKey: accountKeys.loans(id) });
      client.invalidateQueries({ queryKey: accountKeys.summary(id) });
    },
  });
}

export function usePayFines(patronId?: string) {
  const client = useQueryClient();
  const id = stablePatronId(patronId);
  return useMutation({
    mutationFn: () => accountService.payFines(id),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: accountKeys.fines(id) });
      client.invalidateQueries({ queryKey: accountKeys.ledger(id) });
      client.invalidateQueries({ queryKey: accountKeys.summary(id) });
    },
  });
}

export function useUpdateAutoRenewal(patronId?: string) {
  const client = useQueryClient();
  const id = stablePatronId(patronId);
  return useMutation({
    mutationFn: (preferences: AccountAutoRenewal) =>
      accountService.updateAutoRenewal(id, preferences),
    onSuccess: (data) => {
      client.setQueryData(accountKeys.autoRenewal(id), data);
    },
  });
}