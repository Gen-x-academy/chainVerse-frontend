/**
 * Scholarship domain types
 *
 * Ownership  : Frontend Platform team
 * Privacy    : Application data (essays, financial info) is PII — never log raw payloads.
 * Migration  : v1 — initial schema. Any field rename requires a codemod + API versioning.
 * Ops impact : ScholarshipStore is ephemeral (no persistence); page-reload fetches fresh data.
 */

import { z } from 'zod';

// ─── Enumerations ────────────────────────────────────────────────────────────

/** Lifecycle states an application moves through. */
export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'WAITLISTED'
  | 'AWARDED'
  | 'WITHDRAWN';

/** Lifecycle states for an active award. */
export type AwardStatus =
  | 'PENDING_ACCEPTANCE'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'REVOKED';

/** Individual milestone progress states. */
export type MilestoneStatus =
  | 'LOCKED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'VERIFIED'
  | 'FAILED';

/** Payment states tied to each milestone or lump-sum disbursement. */
export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED';

/** Who can see/apply for this scholarship. */
export type ScholarshipVisibility = 'PUBLIC' | 'INVITE_ONLY' | 'CLOSED';

/** Funding source. */
export type SponsorType = 'CORPORATE' | 'DAO' | 'INDIVIDUAL' | 'PROTOCOL';

// ─── Core domain models ───────────────────────────────────────────────────────

export interface Sponsor {
  id: string;
  name: string;
  type: SponsorType;
  logoUrl?: string;
  walletAddress: string;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  /** 0-based sequence index */
  order: number;
  /** Amount released on verification, in wei-equivalent integer string */
  payoutAmount: string;
  currency: string;
  status: MilestoneStatus;
  dueDate?: string; // ISO-8601
  completedAt?: string; // ISO-8601
}

export interface Payment {
  id: string;
  awardId: string;
  milestoneId?: string; // undefined for lump-sum awards
  /** Integer string representing wei-equivalent amount */
  amount: string;
  currency: string;
  status: PaymentStatus;
  txHash?: string;
  createdAt: string;
  completedAt?: string;
}

export interface Scholarship {
  id: string;
  title: string;
  description: string;
  sponsor: Sponsor;
  /** Total budget pool in wei-equivalent integer string */
  totalBudget: string;
  /** Remaining unallocated budget */
  remainingBudget: string;
  currency: string;
  maxAwardees: number;
  currentAwardees: number;
  visibility: ScholarshipVisibility;
  milestones: Milestone[];
  applicationDeadline: string; // ISO-8601
  createdAt: string;
  updatedAt: string;
  tags: string[];
  /** Minimum GPA or score requirement, if applicable */
  minimumScore?: number;
}

export interface Application {
  id: string;
  scholarshipId: string;
  studentId: string;
  status: ApplicationStatus;
  /** Plain-text or markdown essay */
  essay: string;
  /** Optional supporting URL (e.g., GitHub, portfolio) */
  portfolioUrl?: string;
  /** Self-reported GPA on a 0–4.0 scale */
  gpa?: number;
  reviewNotes?: string; // admin-only field; never expose in student UI
  submittedAt?: string;
  decidedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Award {
  id: string;
  scholarshipId: string;
  applicationId: string;
  studentId: string;
  status: AwardStatus;
  /** Total awarded amount */
  totalAmount: string;
  currency: string;
  milestones: Milestone[];
  payments: Payment[];
  awardedAt: string;
  completedAt?: string;
}

// ─── State-machine event union types ──────────────────────────────────────────

export type ApplicationEvent =
  | { type: 'SAVE_DRAFT' }
  | { type: 'SUBMIT' }
  | { type: 'BEGIN_REVIEW' }
  | { type: 'APPROVE' }
  | { type: 'REJECT'; reason: string }
  | { type: 'WAITLIST' }
  | { type: 'PROMOTE_FROM_WAITLIST' }
  | { type: 'AWARD' }
  | { type: 'WITHDRAW' };

export type AwardEvent =
  | { type: 'ACCEPT' }
  | { type: 'DECLINE' }
  | { type: 'ACTIVATE' }
  | { type: 'COMPLETE' }
  | { type: 'REVOKE'; reason: string };

export type MilestoneEvent =
  | { type: 'UNLOCK' }
  | { type: 'START' }
  | { type: 'SUBMIT_PROOF'; proofUrl: string }
  | { type: 'VERIFY' }
  | { type: 'FAIL'; reason: string };

export type PaymentEvent =
  | { type: 'INITIATE' }
  | { type: 'PROCESS' }
  | { type: 'CONFIRM'; txHash: string }
  | { type: 'FAIL'; errorCode: string }
  | { type: 'REFUND' };

// ─── Zod validation schemas ───────────────────────────────────────────────────

export const applicationFormSchema = z.object({
  scholarshipId: z.string().min(1, 'Scholarship is required'),
  essay: z
    .string()
    .min(100, 'Essay must be at least 100 characters')
    .max(5000, 'Essay must not exceed 5000 characters'),
  portfolioUrl: z
    .string()
    .url('Must be a valid URL')
    .optional()
    .or(z.literal('')),
  gpa: z
    .number()
    .min(0, 'GPA cannot be negative')
    .max(4.0, 'GPA cannot exceed 4.0')
    .optional(),
  consent: z
    .boolean()
    .refine((v) => v === true, 'You must consent to the terms'),
});

export type ApplicationFormData = z.infer<typeof applicationFormSchema>;

// ─── API response wrappers ────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  field?: string;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

// ─── Store slice shape ────────────────────────────────────────────────────────

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface ScholarshipStoreState {
  scholarships: Scholarship[];
  selectedScholarship: Scholarship | null;
  applications: Application[];
  selectedApplication: Application | null;
  awards: Award[];
  selectedAward: Award | null;
  scholarshipsStatus: LoadingState;
  applicationStatus: LoadingState;
  awardStatus: LoadingState;
  error: string | null;
}
