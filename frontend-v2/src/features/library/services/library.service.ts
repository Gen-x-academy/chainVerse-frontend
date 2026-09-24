import { apiClient } from '@/src/lib/api-client';
import type {
  BorrowingPolicy,
  CatalogMatch,
  CheckoutEligibility,
  CopyDetail,
  DonationIntakePayload,
  DonationIntakeRecord,
  LocationNode,
  LocationSelection,
  PatronSummary,
  PhysicalCheckoutPayload,
  PhysicalCheckoutResult,
  ScanMode,
  StocktakeSession,
} from '../types/library.types';

const BASE = '/library';

export const libraryService = {
  searchCatalogMatches(query: { isbn?: string; title?: string; author?: string }) {
    const params = new URLSearchParams();
    if (query.isbn) params.set('isbn', query.isbn);
    if (query.title) params.set('title', query.title);
    if (query.author) params.set('author', query.author);
    return apiClient.get<CatalogMatch[]>(`${BASE}/donations/catalog-matches?${params}`);
  },

  submitDonationIntake(payload: DonationIntakePayload) {
    return apiClient.post<DonationIntakeRecord>(`${BASE}/donations/intake`, payload);
  },

  lookupByBarcode(barcode: string) {
    return apiClient.get<CopyDetail>(`${BASE}/copies/${encodeURIComponent(barcode)}`);
  },

  checkoutCopy(copyId: string, patronId: string) {
    return apiClient.post<{ success: boolean; dueDate?: string }>(`${BASE}/circulation/checkout`, {
      copyId,
      patronId,
    });
  },

  returnCopy(copyId: string) {
    return apiClient.post<{ success: boolean }>(`${BASE}/circulation/return`, { copyId });
  },

  recordScan(mode: ScanMode, barcode: string) {
    return apiClient.post<{ copy: CopyDetail; duplicate?: boolean }>(`${BASE}/circulation/scan`, {
      mode,
      barcode,
    });
  },

  getLocationTree() {
    return apiClient.get<LocationNode[]>(`${BASE}/locations/tree`);
  },

  validateLocation(selection: LocationSelection) {
    return apiClient.post<{ valid: boolean; label: string }>(`${BASE}/locations/validate`, selection);
  },

  startStocktake(location: LocationSelection) {
    return apiClient.post<StocktakeSession>(`${BASE}/stocktake/sessions`, { location });
  },

  getStocktakeSession(sessionId: string) {
    return apiClient.get<StocktakeSession>(`${BASE}/stocktake/sessions/${sessionId}`);
  },

  /** Returns the signed-in staff member's resumable active session, if any. */
  getCurrentStocktakeSession() {
    return apiClient.get<StocktakeSession | null>(`${BASE}/stocktake/sessions/current`);
  },

  recordStocktakeScan(sessionId: string, barcode: string, idempotencyKey: string) {
    return apiClient.post<StocktakeSession & { duplicate?: boolean }>(`${BASE}/stocktake/sessions/${sessionId}/scan`, {
      barcode,
      idempotencyKey,
    });
  },

  completeStocktake(sessionId: string, discrepanciesReviewed: boolean) {
    return apiClient.post<StocktakeSession>(`${BASE}/stocktake/sessions/${sessionId}/complete`, {
      discrepanciesReviewed,
    });
  },

  // ─── Physical circulation (issue #951) ──────────────────────────────────────

  /** Staff patron search; normalises paginated or array responses. */
  async searchPatrons(query: string) {
    const params = new URLSearchParams();
    if (query.trim()) params.set('search', query.trim());
    const qs = params.toString();
    const result = await apiClient.get<PatronSummary[] | { data: PatronSummary[] }>(
      `${BASE}/patrons${qs ? `?${qs}` : ''}`,
    );
    return Array.isArray(result) ? result : result.data;
  },

  getPatronProfile(userId: string) {
    return apiClient.get<PatronSummary>(`${BASE}/patrons/${encodeURIComponent(userId)}`);
  },

  getPatronPolicy(userId: string) {
    return apiClient.get<BorrowingPolicy>(`${BASE}/patrons/${encodeURIComponent(userId)}/policy`);
  },

  getPatronEligibility(userId: string) {
    return apiClient.get<CheckoutEligibility>(
      `${BASE}/patrons/${encodeURIComponent(userId)}/checkout-eligibility`,
    );
  },

  /** Atomic physical-copy checkout by barcode. */
  checkoutPhysical(payload: PhysicalCheckoutPayload) {
    return apiClient.post<PhysicalCheckoutResult>(`${BASE}/circulation/physical/checkout`, payload);
  },
};
