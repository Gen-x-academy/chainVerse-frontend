import { libraryFetch } from './library-api';
import type { LoanActivityResponse } from '../types/loan.types';

export const loanService = {
  getActivity: (patronId?: string, signal?: AbortSignal) => {
    const qs = patronId ? `?patronId=${encodeURIComponent(patronId)}` : '';
    return libraryFetch<LoanActivityResponse>(`/library/loans/activity${qs}`, { signal });
  },
};
