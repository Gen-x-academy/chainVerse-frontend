import { apiClient } from '@/src/lib/api-client';
import type {
  CatalogMatch,
  CopyDetail,
  DonationIntakePayload,
  DonationIntakeRecord,
  LocationNode,
  LocationSelection,
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
};
