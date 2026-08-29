/**
 * Reports service — condition reports, repair tickets, and lost-item cases.
 * All calls attach the current access token via apiClient (which reads
 * localStorage) and throw an Error on non-2xx responses.
 */

import { apiClient } from '@/src/lib/api-client';
import type {
  ConditionReport,
  LostItemCase,
  PaginatedResponse,
  RepairTicket,
  CreateRepairTicketPayload,
  UpdateRepairTicketPayload,
  ResolveLostItemPayload,
  UpdateConditionPayload,
} from '../types/reports.types';

const BASE = '/library/reports';

export const reportsService = {
  // ── Condition Reports ──────────────────────────────────────────────────────

  /** Fetch a single condition report for an item. Returns null when 404. */
  getConditionReport(itemId: string): Promise<ConditionReport> {
    return apiClient.get<ConditionReport>(`${BASE}/conditions/${encodeURIComponent(itemId)}`);
  },

  /**
   * Submit a version-aware condition update.
   * The server checks the ETag / If-Match version; callers should propagate
   * 409 Conflict errors to the UI rather than silently retrying.
   */
  updateConditionReport(
    itemId: string,
    payload: UpdateConditionPayload,
    options?: { version?: string }
  ): Promise<ConditionReport> {
    return apiClient.patch<ConditionReport>(
      `${BASE}/conditions/${encodeURIComponent(itemId)}`,
      payload,
      options?.version ? { headers: { 'If-Match': options.version } } : undefined
    );
  },

  // ── Repair Tickets ─────────────────────────────────────────────────────────

  listRepairTickets(signal?: AbortSignal): Promise<PaginatedResponse<RepairTicket>> {
    return apiClient.get<PaginatedResponse<RepairTicket>>(`${BASE}/repairs`, { signal });
  },

  getRepairTicket(ticketId: string): Promise<RepairTicket> {
    return apiClient.get<RepairTicket>(`${BASE}/repairs/${encodeURIComponent(ticketId)}`);
  },

  createRepairTicket(payload: CreateRepairTicketPayload): Promise<RepairTicket> {
    return apiClient.post<RepairTicket>(`${BASE}/repairs`, payload);
  },

  updateRepairTicket(
    ticketId: string,
    payload: UpdateRepairTicketPayload,
    options?: { version?: string }
  ): Promise<RepairTicket> {
    return apiClient.patch<RepairTicket>(
      `${BASE}/repairs/${encodeURIComponent(ticketId)}`,
      payload,
      options?.version ? { headers: { 'If-Match': options.version } } : undefined
    );
  },

  // ── Lost-Item Cases ────────────────────────────────────────────────────────

  listLostItemCases(signal?: AbortSignal): Promise<PaginatedResponse<LostItemCase>> {
    return apiClient.get<PaginatedResponse<LostItemCase>>(`${BASE}/lost-items`, { signal });
  },

  getLostItemCase(caseId: string): Promise<LostItemCase> {
    return apiClient.get<LostItemCase>(`${BASE}/lost-items/${encodeURIComponent(caseId)}`);
  },

  /**
   * Resolve a lost-item case. Version-aware: pass the ETag from the last
   * GET to prevent overwriting a concurrent staff update (409 = conflict).
   */
  resolveLostItem(
    caseId: string,
    payload: ResolveLostItemPayload,
    options?: { version?: string }
  ): Promise<LostItemCase> {
    return apiClient.post<LostItemCase>(
      `${BASE}/lost-items/${encodeURIComponent(caseId)}/resolve`,
      payload,
      options?.version ? { headers: { 'If-Match': options.version } } : undefined
    );
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
