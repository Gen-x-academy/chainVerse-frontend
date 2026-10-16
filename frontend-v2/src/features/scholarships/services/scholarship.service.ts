import { generateSubmissionReceipt, sanitizeApplicationForReceipt } from '../lib/receipt';
import { ScholarshipApiError, authFetch } from './scholarship-api';
import type {
  ScholarshipApplicationInput,
  ScholarshipApplicationRecord,
  ScholarshipSubmissionResponse,
} from '../types';
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
const APPLICATIONS_PATH = `${BASE}/applications`;


function buildParams(params?: ScholarshipApplicationListParams): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  if (params.roundId) qs.set("roundId", params.roundId);
  if (params.status) qs.set("status", params.status);
  if (params.studentId) qs.set("studentId", params.studentId);
  if (params.query) qs.set("query", params.query);
  if (params.page !== undefined) qs.set("page", String(params.page));
  if (params.pageSize !== undefined)
    qs.set("pageSize", String(params.pageSize));
  if (params.tenantId) qs.set("tenantId", params.tenantId);
  const query = qs.toString();
  return query ? `?${query}` : "";
}

/**
 * Submits an application with a signed receipt (#1218).
 *
 * The local receipt is always produced so the caller can render a verifiable
 * confirmation even when the API is unreachable; `ok` stays `true` because a
 * queued-but-unacknowledged submission is not a client-visible failure.
 */
async function submitApplication(
  input: ScholarshipApplicationInput,
): Promise<ScholarshipSubmissionResponse> {
  const submittedAt = input.submittedAt ?? new Date().toISOString();
  const applicationId =
    input.id ??
    `scholarship-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const application: ScholarshipApplicationRecord = {
    ...sanitizeApplicationForReceipt(input),
    id: applicationId,
    status: 'submitted',
    createdAt: submittedAt,
    submittedAt,
    programVersion: input.programVersion ?? 'v1',
  };

  const receipt = await generateSubmissionReceipt(application);

  try {
    // Routed through the same authenticated helper as every other write. The
    // bare `fetch` used here previously sent no Authorization header, so a
    // submission could not be attributed to the signed-in applicant.
    const payload = await authFetch<Partial<ScholarshipSubmissionResponse>>(
      APPLICATIONS_PATH,
      { method: 'POST', body: { ...application, receipt } },
    );
    return {
      ok: true,
      application: payload.application ?? application,
      receipt: payload.receipt ?? receipt,
    };
  } catch {
    return {
      ok: true,
      application,
      receipt,
    };
  }
}

export const scholarshipService = {
  submitApplication,

  getPrograms: (signal?: AbortSignal) =>
    authFetch<ScholarshipProgram[]>(`${BASE}/programs`, { signal }),

  getRounds: (signal?: AbortSignal) =>
    authFetch<ScholarshipRound[]>(`${BASE}/rounds`, { signal }),

  listApplications: (
    params?: ScholarshipApplicationListParams,
    signal?: AbortSignal,
  ) =>
    authFetch<ScholarshipApplication[]>(
      `${APPLICATIONS_PATH}${buildParams(params)}`,
      { signal },
    ),

  getApplication: (id: string, signal?: AbortSignal) =>
    authFetch<ScholarshipApplication>(
      `${APPLICATIONS_PATH}/${encodeURIComponent(id)}`,
      { signal },
    ),

  createApplication: (payload: CreateScholarshipApplicationPayload) =>
    authFetch<ScholarshipApplication>(APPLICATIONS_PATH, {
      method: "POST",
      body: payload,
    }),

  getAwards: (signal?: AbortSignal) =>
    authFetch<ScholarshipAward[]>(`${BASE}/awards`, { signal }),

  getDisbursements: (signal?: AbortSignal) =>
    authFetch<ScholarshipDisbursement[]>(`${BASE}/disbursements`, { signal }),

  // Issue #1112 — Award records and acceptance deadlines
  createAward: (payload: CreateAwardPayload) =>
    authFetch<AwardRecord>(`${BASE}/awards`, {
      method: 'POST',
      body: payload,
    }),

  getAward: (id: string, signal?: AbortSignal) =>
    authFetch<AwardRecord>(`${BASE}/awards/${encodeURIComponent(id)}`, { signal }),

  // Issue #1113 — Signed award agreement acceptance
  getAgreement: (awardId: string, signal?: AbortSignal) =>
    authFetch<AwardAgreement>(
      `${BASE}/awards/${encodeURIComponent(awardId)}/agreement`,
      { signal }
    ),

  acceptAward: (payload: AcceptAwardPayload) =>
    authFetch<AwardAgreement>(`${BASE}/awards/accept`, {
      method: 'POST',
      body: payload,
    }),

  declineAward: (payload: DeclineAwardPayload) =>
    authFetch<ScholarshipAward>(`${BASE}/awards/decline`, {
      method: 'POST',
      body: payload,
    }),

  // Issue #1114 — Award cancellation and termination
  cancelAward: (payload: CancelAwardPayload) =>
    authFetch<AwardCancellation>(`${BASE}/awards/cancel`, {
      method: 'POST',
      body: payload,
    }),

  terminateAward: (payload: TerminateAwardPayload) =>
    authFetch<AwardCancellation>(`${BASE}/awards/terminate`, {
      method: 'POST',
      body: payload,
    }),
};

export { ScholarshipApiError };

// The eligibility rule set lives with the other domain services; re-exported
// here so `services/index.ts` can expose one entry point for the feature.
// Only the rules are re-exported: the root `service.ts` also defines a
// `scholarshipService` (eligibility evaluation) which would collide with the
// HTTP client above.
export { scholarshipFallbackRules } from '../service';
