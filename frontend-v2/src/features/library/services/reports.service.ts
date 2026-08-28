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
  },
};
