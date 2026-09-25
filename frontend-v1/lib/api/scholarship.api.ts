/**
 * Scholarship API Service
 *
 * All calls route through a single `apiFetch` helper that:
 *  - Prepends NEXT_PUBLIC_API_URL (falls back to mock handler in dev)
 *  - Attaches the auth token from localStorage (auth-storage)
 *  - Throws a typed ApiError on non-2xx responses
 *
 * During the current mock-data phase every function is backed by the
 * mock data module so the UI works end-to-end without a live backend.
 * Replace individual functions with real fetch calls once endpoints exist.
 */

import type {
  ScholarshipProgram,
  ScholarshipApplication,
  ReviewItem,
  DisbursementRecord,
  ScholarshipFilters,
  ApplicationFilters,
  CreateProgramPayload,
  SubmitApplicationPayload,
  ReviewDecisionPayload,
  InitiateDisbursementPayload,
  ScholarshipStatus,
} from "@/types/scholarship.types";
import type { AdminStats } from "@/store/scholarshipStore";
import {
  mockPrograms,
  mockApplications,
  mockReviewQueue,
  mockDisbursements,
  mockAdminStats,
  generateId,
  nowIso,
} from "@/lib/mock-data/scholarshipData";

// ─── API Error ────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Auth token helper ────────────────────────────────────────────────────────

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("auth-storage");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { user?: { id?: string } } };
    return parsed?.state?.user?.id ?? null;
  } catch {
    return null;
  }
}

// ─── Base fetch wrapper ───────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, body || res.statusText);
  }
  return res.json() as Promise<T>;
}

// ─── Mock delay (simulates network latency in dev) ────────────────────────────

function mockDelay(ms = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Programs ─────────────────────────────────────────────────────────────────

async function getPrograms(
  filters: ScholarshipFilters = {}
): Promise<ScholarshipProgram[]> {
  if (BASE_URL) {
    return apiFetch<ScholarshipProgram[]>("/api/scholarships");
  }
  await mockDelay();
  let results = [...mockPrograms];
  if (filters.status && filters.status !== "all") {
    results = results.filter((p) => p.status === filters.status);
  }
  if (filters.category && filters.category !== "all") {
    results = results.filter((p) => p.category === filters.category);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.sponsorName.toLowerCase().includes(q)
    );
  }
  return results;
}

async function getProgramById(id: string): Promise<ScholarshipProgram> {
  if (BASE_URL) {
    return apiFetch<ScholarshipProgram>(`/api/scholarships/${id}`);
  }
  await mockDelay();
  const program = mockPrograms.find((p) => p.id === id);
  if (!program) throw new ApiError(404, `Scholarship program ${id} not found`);
  return program;
}

async function createProgram(
  payload: CreateProgramPayload
): Promise<ScholarshipProgram> {
  if (BASE_URL) {
    return apiFetch<ScholarshipProgram>("/api/scholarships", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
  await mockDelay(600);
  const program: ScholarshipProgram = {
    id: generateId(),
    ...payload,
    eligibilityCriteria: payload.eligibilityCriteria
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    requiredDocuments: payload.requiredDocuments
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    status: "draft",
    sponsorId: "sponsor-current",
    sponsorName: "Current Sponsor",
    awardedCount: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  mockPrograms.unshift(program);
  return program;
}

async function updateProgramStatus(
  id: string,
  status: ScholarshipStatus
): Promise<ScholarshipProgram> {
  if (BASE_URL) {
    return apiFetch<ScholarshipProgram>(`/api/scholarships/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }
  await mockDelay();
  const idx = mockPrograms.findIndex((p) => p.id === id);
  if (idx === -1) throw new ApiError(404, `Program ${id} not found`);
  mockPrograms[idx] = { ...mockPrograms[idx], status, updatedAt: nowIso() };
  return mockPrograms[idx];
}

// ─── Applications ─────────────────────────────────────────────────────────────

async function getMyApplications(): Promise<ScholarshipApplication[]> {
  if (BASE_URL) {
    return apiFetch<ScholarshipApplication[]>("/api/scholarships/my-applications");
  }
  await mockDelay();
  return mockApplications.filter((a) => a.applicantId === "student-current");
}

async function getApplicationById(
  id: string
): Promise<ScholarshipApplication> {
  if (BASE_URL) {
    return apiFetch<ScholarshipApplication>(`/api/scholarships/applications/${id}`);
  }
  await mockDelay();
  const app = mockApplications.find((a) => a.id === id);
  if (!app) throw new ApiError(404, `Application ${id} not found`);
  return app;
}

async function submitApplication(
  payload: SubmitApplicationPayload
): Promise<ScholarshipApplication> {
  if (BASE_URL) {
    return apiFetch<ScholarshipApplication>("/api/scholarships/apply", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
  await mockDelay(700);
  const program = mockPrograms.find((p) => p.id === payload.scholarshipId);
  if (!program) throw new ApiError(404, "Scholarship not found");
  if (program.status !== "open")
    throw new ApiError(400, "This scholarship is not currently accepting applications");
  const app: ScholarshipApplication = {
    id: generateId(),
    scholarshipId: payload.scholarshipId,
    scholarshipTitle: program.title,
    applicantId: "student-current",
    applicantName: "Current Student",
    applicantEmail: "student@example.com",
    status: "submitted",
    statement: payload.statement,
    financialNeed: payload.financialNeed,
    documents: [],
    submittedAt: nowIso(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  mockApplications.unshift(app);
  return app;
}

async function withdrawApplication(id: string): Promise<void> {
  if (BASE_URL) {
    await apiFetch(`/api/scholarships/applications/${id}`, { method: "DELETE" });
    return;
  }
  await mockDelay();
  const idx = mockApplications.findIndex((a) => a.id === id);
  if (idx === -1) throw new ApiError(404, `Application ${id} not found`);
  mockApplications.splice(idx, 1);
}

// ─── Review ───────────────────────────────────────────────────────────────────

async function getReviewQueue(): Promise<ReviewItem[]> {
  if (BASE_URL) {
    return apiFetch<ReviewItem[]>("/api/scholarships/review-queue");
  }
  await mockDelay();
  return [...mockReviewQueue];
}

async function submitReviewDecision(
  payload: ReviewDecisionPayload
): Promise<void> {
  if (BASE_URL) {
    await apiFetch(`/api/scholarships/applications/${payload.applicationId}/review`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return;
  }
  await mockDelay(500);
  const qIdx = mockReviewQueue.findIndex(
    (r) => r.applicationId === payload.applicationId
  );
  if (qIdx !== -1) mockReviewQueue.splice(qIdx, 1);
  const aIdx = mockApplications.findIndex(
    (a) => a.id === payload.applicationId
  );
  if (aIdx !== -1) {
    const nextStatus =
      payload.decision === "approve"
        ? "approved"
        : payload.decision === "reject"
        ? "rejected"
        : "under_review";
    mockApplications[aIdx] = {
      ...mockApplications[aIdx],
      status: nextStatus,
      reviewDecision: payload.decision,
      reviewerNotes: payload.notes,
      reviewedAt: nowIso(),
      updatedAt: nowIso(),
    };
  }
}

// ─── Disbursements ────────────────────────────────────────────────────────────

async function getDisbursements(): Promise<DisbursementRecord[]> {
  if (BASE_URL) {
    return apiFetch<DisbursementRecord[]>("/api/scholarships/disbursements");
  }
  await mockDelay();
  return [...mockDisbursements];
}

async function initiateDisbursement(
  payload: InitiateDisbursementPayload
): Promise<DisbursementRecord> {
  if (BASE_URL) {
    return apiFetch<DisbursementRecord>("/api/scholarships/disbursements", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
  await mockDelay(600);
  const app = mockApplications.find((a) => a.id === payload.applicationId);
  if (!app) throw new ApiError(404, "Application not found");
  const program = mockPrograms.find((p) => p.id === app.scholarshipId);
  const record: DisbursementRecord = {
    id: generateId(),
    applicationId: payload.applicationId,
    applicantId: app.applicantId,
    applicantName: app.applicantName,
    scholarshipTitle: app.scholarshipTitle,
    sponsorName: program?.sponsorName ?? "Unknown Sponsor",
    amount: program?.awardAmount ?? 0,
    currency: program?.currency ?? "XLM",
    walletAddress: payload.walletAddress,
    status: "pending",
    scheduledDate: payload.scheduledDate,
    createdAt: nowIso(),
  };
  mockDisbursements.unshift(record);
  return record;
}

async function markDisbursementPaid(
  id: string,
  txHash: string
): Promise<DisbursementRecord> {
  if (BASE_URL) {
    return apiFetch<DisbursementRecord>(`/api/scholarships/disbursements/${id}/paid`, {
      method: "PATCH",
      body: JSON.stringify({ txHash }),
    });
  }
  await mockDelay();
  const idx = mockDisbursements.findIndex((d) => d.id === id);
  if (idx === -1) throw new ApiError(404, `Disbursement ${id} not found`);
  mockDisbursements[idx] = {
    ...mockDisbursements[idx],
    status: "paid",
    txHash,
    processedDate: nowIso(),
  };
  return mockDisbursements[idx];
}

// ─── Admin ────────────────────────────────────────────────────────────────────

async function getAdminStats(): Promise<AdminStats> {
  if (BASE_URL) {
    return apiFetch<AdminStats>("/api/scholarships/admin/stats");
  }
  await mockDelay();
  return { ...mockAdminStats };
}

async function getAllApplications(
  filters: ApplicationFilters = {}
): Promise<ScholarshipApplication[]> {
  if (BASE_URL) {
    return apiFetch<ScholarshipApplication[]>("/api/scholarships/admin/applications");
  }
  await mockDelay();
  let results = [...mockApplications];
  if (filters.status && filters.status !== "all") {
    results = results.filter((a) => a.status === filters.status);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(
      (a) =>
        a.applicantName.toLowerCase().includes(q) ||
        a.scholarshipTitle.toLowerCase().includes(q)
    );
  }
  return results;
}

// ─── Exported service object ──────────────────────────────────────────────────

export const scholarshipApi = {
  // Programs
  getPrograms,
  getProgramById,
  createProgram,
  updateProgramStatus,
  // Applications
  getMyApplications,
  getApplicationById,
  submitApplication,
  withdrawApplication,
  // Review
  getReviewQueue,
  submitReviewDecision,
  // Disbursements
  getDisbursements,
  initiateDisbursement,
  markDisbursementPaid,
  // Admin
  getAdminStats,
  getAllApplications,
};
