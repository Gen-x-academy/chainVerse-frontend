import { ScholarshipApiError, scholarshipFetch } from './scholarship-api';
import type {
  CreateScholarshipApplicationPayload,
  ScholarshipApplication,
  ScholarshipApplicationListParams,
  ScholarshipAward,
  ScholarshipDisbursement,
  ScholarshipProgram,
  ScholarshipRound,
} from '../types/scholarship.types';

const BASE = '/scholarships';

function buildParams(params?: ScholarshipApplicationListParams): string {
  if (!params) return '';
  const qs = new URLSearchParams();
  if (params.roundId) qs.set('roundId', params.roundId);
  if (params.status) qs.set('status', params.status);
  if (params.studentId) qs.set('studentId', params.studentId);
  const query = qs.toString();
  return query ? `?${query}` : '';
}

export const scholarshipService = {
  getPrograms: (signal?: AbortSignal) =>
    scholarshipFetch<ScholarshipProgram[]>(`${BASE}/programs`, { signal }),

  getRounds: (signal?: AbortSignal) =>
    scholarshipFetch<ScholarshipRound[]>(`${BASE}/rounds`, { signal }),

  listApplications: (params?: ScholarshipApplicationListParams, signal?: AbortSignal) =>
    scholarshipFetch<ScholarshipApplication[]>(
      `${BASE}/applications${buildParams(params)}`,
      { signal }
    ),

  getApplication: (id: string, signal?: AbortSignal) =>
    scholarshipFetch<ScholarshipApplication>(`${BASE}/applications/${encodeURIComponent(id)}`, {
      signal,
    }),

  createApplication: (payload: CreateScholarshipApplicationPayload) =>
    scholarshipFetch<ScholarshipApplication>(`${BASE}/applications`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAwards: (signal?: AbortSignal) =>
    scholarshipFetch<ScholarshipAward[]>(`${BASE}/awards`, { signal }),

  getDisbursements: (signal?: AbortSignal) =>
    scholarshipFetch<ScholarshipDisbursement[]>(`${BASE}/disbursements`, { signal }),
};

export { ScholarshipApiError };
export { scholarshipFallbackRules, scholarshipService } from '../service';
