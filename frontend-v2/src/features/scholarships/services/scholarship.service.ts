import { ScholarshipApiError, scholarshipFetch } from './scholarship-api';
import type {
  AcceptAwardPayload,
  AwardAgreement,
  AwardCancellation,
  AwardRecord,
  CancelAwardPayload,
  CreateAwardPayload,
  CreateScholarshipApplicationPayload,
  DeclineAwardPayload,
  ScholarshipApplication,
  ScholarshipApplicationListParams,
  ScholarshipAward,
  ScholarshipDisbursement,
  ScholarshipProgram,
  ScholarshipRound,
  TerminateAwardPayload,
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

  // Issue #1112 — Award records and acceptance deadlines
  createAward: (payload: CreateAwardPayload) =>
    scholarshipFetch<AwardRecord>(`${BASE}/awards`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAward: (id: string, signal?: AbortSignal) =>
    scholarshipFetch<AwardRecord>(`${BASE}/awards/${encodeURIComponent(id)}`, { signal }),

  // Issue #1113 — Signed award agreement acceptance
  getAgreement: (awardId: string, signal?: AbortSignal) =>
    scholarshipFetch<AwardAgreement>(
      `${BASE}/awards/${encodeURIComponent(awardId)}/agreement`,
      { signal }
    ),

  acceptAward: (payload: AcceptAwardPayload) =>
    scholarshipFetch<AwardAgreement>(`${BASE}/awards/accept`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  declineAward: (payload: DeclineAwardPayload) =>
    scholarshipFetch<ScholarshipAward>(`${BASE}/awards/decline`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Issue #1114 — Award cancellation and termination
  cancelAward: (payload: CancelAwardPayload) =>
    scholarshipFetch<AwardCancellation>(`${BASE}/awards/cancel`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  terminateAward: (payload: TerminateAwardPayload) =>
    scholarshipFetch<AwardCancellation>(`${BASE}/awards/terminate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export { ScholarshipApiError };
export { scholarshipFallbackRules, scholarshipService } from '../service';
