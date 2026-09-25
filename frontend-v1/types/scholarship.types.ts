// ─── Scholarship Domain Types ─────────────────────────────────────────────────
// Owner: Platform team
// Privacy: Application data may contain PII (applicant statements, financial info)
// Migration: Additive – no existing tables affected

// ─── Enums / Literals ─────────────────────────────────────────────────────────

export type ScholarshipStatus =
  | "draft"
  | "open"
  | "closed"
  | "awarded"
  | "cancelled";

export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "shortlisted"
  | "approved"
  | "rejected"
  | "disbursed";

export type ReviewDecision = "approve" | "reject" | "request_info";

export type PaymentStatus = "pending" | "processing" | "paid" | "failed";

export type ScholarshipCategory =
  | "merit"
  | "need_based"
  | "diversity"
  | "stem"
  | "open";

export type UserRole =
  | "student"
  | "sponsor"
  | "reviewer"
  | "finance"
  | "admin"
  | null;

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface ScholarshipProgram {
  id: string;
  title: string;
  description: string;
  category: ScholarshipCategory;
  status: ScholarshipStatus;
  sponsorId: string;
  sponsorName: string;
  sponsorLogoUrl?: string;
  totalBudget: number;
  awardAmount: number;
  currency: string; // "XLM" | "USD"
  maxRecipients: number;
  awardedCount: number;
  eligibilityCriteria: string[];
  requiredDocuments: string[];
  openDate: string; // ISO date string
  closeDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScholarshipApplication {
  id: string;
  scholarshipId: string;
  scholarshipTitle: string;
  applicantId: string;
  applicantName: string;
  applicantEmail: string;
  status: ApplicationStatus;
  statement: string; // personal statement – contains PII
  financialNeed?: string; // optional – sensitive PII
  documents: ApplicationDocument[];
  submittedAt?: string;
  reviewedAt?: string;
  reviewerId?: string;
  reviewerNotes?: string;
  reviewDecision?: ReviewDecision;
  disbursementId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationDocument {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  uploadedAt: string;
}

export interface ReviewItem {
  applicationId: string;
  applicantName: string;
  applicantEmail: string;
  scholarshipTitle: string;
  scholarshipId: string;
  submittedAt: string;
  statement: string;
  financialNeed?: string;
  documents: ApplicationDocument[];
  currentStatus: ApplicationStatus;
}

export interface DisbursementRecord {
  id: string;
  applicationId: string;
  applicantId: string;
  applicantName: string;
  scholarshipTitle: string;
  sponsorName: string;
  amount: number;
  currency: string;
  walletAddress: string;
  status: PaymentStatus;
  txHash?: string;
  scheduledDate: string;
  processedDate?: string;
  createdAt: string;
}

// ─── Form Payloads ────────────────────────────────────────────────────────────

export interface CreateProgramPayload {
  title: string;
  description: string;
  category: ScholarshipCategory;
  totalBudget: number;
  awardAmount: number;
  currency: string;
  maxRecipients: number;
  eligibilityCriteria: string;
  requiredDocuments: string;
  openDate: string;
  closeDate: string;
}

export interface SubmitApplicationPayload {
  scholarshipId: string;
  statement: string;
  financialNeed?: string;
}

export interface ReviewDecisionPayload {
  applicationId: string;
  decision: ReviewDecision;
  notes: string;
}

export interface InitiateDisbursementPayload {
  applicationId: string;
  walletAddress: string;
  scheduledDate: string;
}

// ─── API Response Wrappers ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Store State Slices ───────────────────────────────────────────────────────

export interface ScholarshipFilters {
  status?: ScholarshipStatus | "all";
  category?: ScholarshipCategory | "all";
  search?: string;
}

export interface ApplicationFilters {
  status?: ApplicationStatus | "all";
  search?: string;
}
