import { libraryFetch } from './library-api';
import type {
  AccountAutoRenewal,
  AccountFine,
  AccountHold,
  AccountLedgerEntry,
  AccountLoan,
  AccountNotification,
  AccountSummary,
  PayFinesResult,
  RenewLoanResult,
} from '../types/account.types';

/**
 * Patron library account service (issue #1057).
 *
 * All routes are authenticated; the API base is derived from
 * `NEXT_PUBLIC_API_BASE_URL` via `libraryFetch`.
 */
export const accountService = {
  getSummary: (patronId: string, signal?: AbortSignal) =>
    libraryFetch<AccountSummary>(
      `/library/patrons/${encodeURIComponent(patronId)}/account/summary`,
      { signal }
    ),

  getCurrentLoans: (patronId: string, signal?: AbortSignal) =>
    libraryFetch<AccountLoan[]>(`/library/loans/current?patronId=${encodeURIComponent(patronId)}`, {
      signal,
    }),

  getHolds: (patronId: string, signal?: AbortSignal) =>
    libraryFetch<AccountHold[]>('/library/holds/current', { signal }),

  getOutstandingFines: (patronId: string, signal?: AbortSignal) =>
    libraryFetch<AccountFine[]>('/library/fines/outstanding', { signal }),

  getLedger: (patronId: string, signal?: AbortSignal) =>
    libraryFetch<AccountLedgerEntry[]>('/library/fines/ledger', { signal }),

  getNotifications: (patronId: string, signal?: AbortSignal) =>
    libraryFetch<AccountNotification[]>('/library/notifications', { signal }),

  getAutoRenewal: (patronId: string, signal?: AbortSignal) =>
    libraryFetch<AccountAutoRenewal>('/library/account/preferences/auto-renewal', { signal }),

  renewLoan: (loanId: string) =>
    libraryFetch<RenewLoanResult>(`/library/loans/${encodeURIComponent(loanId)}/renew`, {
      method: 'POST',
    }),

  payFines: (patronId: string) =>
    libraryFetch<PayFinesResult>('/library/fines/pay', {
      method: 'POST',
      body: JSON.stringify({ patronId }),
    }),

  updateAutoRenewal: (patronId: string, preferences: AccountAutoRenewal) =>
    libraryFetch<AccountAutoRenewal>('/library/account/preferences/auto-renewal', {
      method: 'PATCH',
      body: JSON.stringify({ patronId, preferences }),
    }),
};