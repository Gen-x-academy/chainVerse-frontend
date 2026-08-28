import { apiClient } from '@/src/lib/api-client';
import type { ConditionReport } from '@/components/elibrary/ItemConditionReport';
import type { RepairTicket } from '@/components/elibrary/RepairTracking';
import type { LostItemSummary } from '../types/reports.types';

export class ReportsError extends Error {
  constructor(
    message: string,
    public readonly code: 'forbidden' | 'validation' | 'not-found' | 'unknown',
  ) {
    super(message);
    this.name = 'ReportsError';
  }
}

function mapError(err: unknown): ReportsError {
  const message = err instanceof Error ? err.message : 'Unknown error';
  if (message.includes('403') || message.toLowerCase().includes('forbidden')) {
    return new ReportsError('You do not have permission for reports.', 'forbidden');
  }
  if (message.includes('404')) {
    return new ReportsError('Record not found.', 'not-found');
  }
  if (message.includes('400')) {
    return new ReportsError('Validation failed.', 'validation');
  }
  return new ReportsError(message, 'unknown');
}

export const reportsService = {
  async fetchConditionReport(): Promise<ConditionReport | null> {
    try {
      return await apiClient.get<ConditionReport>('/library/reports/condition');
    } catch (err) {
      if (err instanceof Error && err.message.includes('404')) return null;
      throw mapError(err);
    }
  },

  async updateConditionReport(updates: Partial<ConditionReport>): Promise<void> {
    try {
      await apiClient.patch('/library/reports/condition', updates);
    } catch (err) {
      throw mapError(err);
    }
  },

  async fetchActiveLostItem(): Promise<LostItemSummary | null> {
    try {
      return await apiClient.get<LostItemSummary>('/library/reports/lost-items/active');
    } catch (err) {
      if (err instanceof Error && err.message.includes('404')) return null;
      throw mapError(err);
    }
  },

  async resolveLostItem(status: string, notes: string): Promise<void> {
    try {
      await apiClient.post('/library/reports/lost-items/resolve', { status, notes });
    } catch (err) {
      throw mapError(err);
    }
  },

  async fetchRepairTickets(): Promise<RepairTicket[]> {
    try {
      return await apiClient.get<RepairTicket[]>('/library/reports/repairs');
    } catch (err) {
      throw mapError(err);
    }
  },

  async createRepairTicket(
    ticket: Omit<RepairTicket, 'id' | 'createdAt' | 'repairLogs'>,
  ): Promise<RepairTicket> {
    try {
      return await apiClient.post<RepairTicket>('/library/reports/repairs', ticket);
    } catch (err) {
      throw mapError(err);
    }
  },

  async updateRepairTicket(id: string, updates: Partial<RepairTicket>): Promise<RepairTicket> {
    try {
      return await apiClient.patch<RepairTicket>(`/library/reports/repairs/${id}`, updates);
    } catch (err) {
      throw mapError(err);
    }
  },
};
