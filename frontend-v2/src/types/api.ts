/**
 * Typed API response shapes that mirror the ChainVerse backend contracts.
 * Import these instead of using `any` for API call return types.
 */

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface Student {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'student';
  isEmailVerified: boolean;
  profileImage?: string;
  bio?: string;
  avatarUrl?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  student: Student;
}

export interface RefreshTokenResponse {
  accessToken: string;
  expiresIn: number;
}

// ─── Courses ──────────────────────────────────────────────────────────────────

export interface Course {
  id: string;
  title: string;
  description: string;
  price: number;
  thumbnailUrl?: string;
  instructorId: string;
  instructor?: string;
  category?: string;
  level?: string;
  rating?: number;
  studentCount?: number;
}

export interface CourseListResponse {
  data: Course[];
  total: number;
  page: number;
  limit: number;
}

// ─── Enrollment ───────────────────────────────────────────────────────────────

export interface EnrollmentRecord {
  id: string;
  courseId: string;
  studentId: string;
  enrolledAt: string;
  progress: number;
  completed: boolean;
}

export interface EnrollmentListResponse {
  data: EnrollmentRecord[];
  total: number;
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  bio?: string;
  avatarUrl?: string;
  isEmailVerified: boolean;
}

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  bio?: string;
  avatarUrl?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
  createdAt: string;
  link?: string;
}

export interface NotificationListResponse {
  data: Notification[];
  total: number;
  unreadCount: number;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
}

// ─── Workspace: Researcher Notes (CAPSTONE-067) ───────────────────────────────

/**
 * Owner-only private researcher note. Never included in team views, reviews,
 * analytics content, or general logs. `version` supports optimistic concurrency.
 */
export interface ResearcherNote {
  id: string;
  projectId: string;
  ownerId: string;
  version: number;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResearcherNoteListResponse {
  data: ResearcherNote[];
  total: number;
}

export interface CreateResearcherNotePayload {
  body: string;
}

export interface UpdateResearcherNotePayload {
  body: string;
  /** Version the client last observed; stale versions are rejected with 409. */
  expectedVersion: number;
}

// ─── Workspace: Discussion Threads (CAPSTONE-069) ─────────────────────────────

export type DiscussionThreadStatus = 'open' | 'resolved' | 'locked';

export interface DiscussionAttachment {
  id: string;
  messageId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  /** Signed, short-lived download URL; never a public ledger reference. */
  downloadUrl?: string;
  createdAt: string;
}

export interface DiscussionMessage {
  id: string;
  threadId: string;
  authorId: string;
  authorDisplayName: string;
  body: string;
  /** Stable ordering: monotonically increasing sequence within a thread. */
  sequence: number;
  parentMessageId?: string;
  mentions: string[];
  attachments: DiscussionAttachment[];
  createdAt: string;
  editedAt?: string;
}

export interface DiscussionThread {
  id: string;
  projectId: string;
  title: string;
  status: DiscussionThreadStatus;
  createdBy: string;
  /** Stable ordering: monotonically increasing sequence within a project. */
  sequence: number;
  messageCount: number;
  lastMessageAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  /** Retention deadline after which the thread is purged. */
  retentionUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiscussionThreadListResponse {
  data: DiscussionThread[];
  total: number;
}

export interface DiscussionMessageListResponse {
  data: DiscussionMessage[];
  total: number;
}

export interface CreateDiscussionThreadPayload {
  title: string;
  body: string;
  mentions?: string[];
}

export interface CreateDiscussionMessagePayload {
  body: string;
  parentMessageId?: string;
  mentions?: string[];
  attachmentIds?: string[];
}

export interface ResolveDiscussionThreadPayload {
  /** Version the client last observed; stale versions are rejected with 409. */
  expectedVersion: number;
  resolutionNote?: string;
}

// ─── Workspace: Review Aggregation (CAPSTONE-077) ─────────────────────────────

export type ReviewQuorumStatus = 'pending' | 'met' | 'failed';
export type ReviewTieTreatment = 'none' | 'unresolved' | 'chair-decides' | 'average';
export type ReviewMissingReviewHandling = 'exclude' | 'block' | 'neutral';

export interface ReviewerContribution {
  reviewerId: string;
  reviewerDisplayName: string;
  /** Raw score submitted by the reviewer, if any. */
  score?: number;
  weight: number;
  submittedAt?: string;
  /** True when the reviewer was expected but did not submit. */
  missing: boolean;
}

export interface ReviewAggregation {
  id: string;
  projectId: string;
  proposalVersion: number;
  contributions: ReviewerContribution[];
  quorumRequired: number;
  quorumStatus: ReviewQuorumStatus;
  missingReviews: string[];
  missingReviewHandling: ReviewMissingReviewHandling;
  calibrationPolicy: string;
  tieTreatment: ReviewTieTreatment;
  /** Explainable aggregate; undefined until finalized. */
  aggregateScore?: number;
  /** Human-readable explanation of how the aggregate was computed. */
  explanation: string;
  finalized: boolean;
  finalizedAt?: string;
  /** Version the client last observed; stale versions are rejected with 409. */
  version: number;
}

export interface FinalizeReviewAggregationPayload {
  expectedVersion: number;
  tieTreatment?: ReviewTieTreatment;
}

// ─── Workspace: Proposal Revisions (CAPSTONE-078) ─────────────────────────────

export type RevisionRequestStatus =
  | 'requested'
  | 'acknowledged'
  | 'resubmitted'
  | 'accepted'
  | 'declined'
  | 'expired';

export interface RevisionChangeItem {
  id: string;
  /** Section or field of the proposal the change applies to. */
  target: string;
  description: string;
  required: boolean;
}

export interface RevisionResubmissionRules {
  /** Whether a full resubmission is required (vs. a diff). */
  requireFullResubmission: boolean;
  /** Maximum number of resubmission attempts allowed. */
  maxAttempts: number;
  /** Whether the requester must re-review the resubmission. */
  requiresReReview: boolean;
}

export interface RevisionRequest {
  id: string;
  projectId: string;
  /** Exact proposal version this request is pinned to. */
  proposalVersion: number;
  requestedBy: string;
  assignedTo: string;
  changeItems: RevisionChangeItem[];
  deadline: string;
  status: RevisionRequestStatus;
  resubmissionRules: RevisionResubmissionRules;
  attempts: number;
  respondedAt?: string;
  /** Version the client last observed; stale versions are rejected with 409. */
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface RevisionRequestListResponse {
  data: RevisionRequest[];
  total: number;
}

export interface CreateRevisionRequestPayload {
  proposalVersion: number;
  assignedTo: string;
  changeItems: Array<Omit<RevisionChangeItem, 'id'>>;
  deadline: string;
  resubmissionRules: RevisionResubmissionRules;
}

export interface RespondRevisionRequestPayload {
  expectedVersion: number;
  status: Extract<RevisionRequestStatus, 'acknowledged' | 'resubmitted' | 'declined'>;
  responseNote?: string;
}

// ─── Workspace: Conflict / Idempotency ────────────────────────────────────────

/** Typed payload surfaced for HTTP 409 responses. */
export interface ConflictErrorPayload {
  message: string;
  statusCode: 409;
  /** Stable, actionable error code (e.g. `STALE_VERSION`, `DUPLICATE_REQUEST`). */
  code: string;
  /** Current server-side version, when the conflict is a stale write. */
  currentVersion?: number;
}
