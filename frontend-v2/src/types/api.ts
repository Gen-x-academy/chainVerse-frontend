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

// ─── Workspace (CAPSTONE-070/071/073/075) ─────────────────────────────────────

export type {
  Decision,
  DecisionApprover,
  DecisionEvidenceLink,
  DecisionStatus,
  DecisionSupersession,
  CreateDecisionPayload,
  SupersedeDecisionPayload,
  SourceControlConnection,
  SourceControlProvider,
  SourceControlConnectionStatus,
  SourceControlReference,
  SourceControlReferenceKind,
  CreateSourceControlConnectionPayload,
  LinkSourceControlReferencePayload,
  ReviewQueueItem,
  ReviewQueueFilters,
  ReviewQueuePriority,
  ReviewAssignment,
  ReviewConflictDeclaration,
  IndependentReview,
  ReviewCriterionScore,
  ReviewRecommendation,
  ReviewConfidence,
  ReviewSubmissionLink,
  SubmitIndependentReviewPayload,
  WorkspaceErrorCode,
  WorkspaceError,
  WorkspacePaginatedEnvelope,
  WorkspacePageMeta,
} from './workspaceContracts';

/**
 * Roles recognised by the workspace surfaces. Authorization is deny-by-default:
 * any capability not explicitly granted to a role is refused by the navigation
 * guard and by the API layer.
 */
export type WorkspaceRole = 'reviewer' | 'approver' | 'admin';

/**
 * Capabilities checked by the role-aware navigation guard. Each maps to one or
 * more workspace routes; unknown capabilities are treated as denied.
 */
export type WorkspaceCapability =
  | 'workspace.decisions.read'
  | 'workspace.decisions.write'
  | 'workspace.decisions.approve'
  | 'workspace.decisions.supersede'
  | 'workspace.sourceControl.read'
  | 'workspace.sourceControl.connect'
  | 'workspace.sourceControl.revoke'
  | 'workspace.reviewQueue.read'
  | 'workspace.reviewQueue.assign'
  | 'workspace.reviewQueue.declareConflict'
  | 'workspace.reviews.read'
  | 'workspace.reviews.submit'
  | 'projects.timeline.read'
  | 'projects.timeline.write'
  | 'projects.workspace.read'
  | 'projects.members.read'
  | 'projects.members.write'
  | 'projects.resources.read'
  | 'projects.resources.write';

// ─── Projects: shared primitives (CAPSTONE-063/065/068) ───────────────────────

/**
 * Lifecycle states a project moves through. Transitions are validated by the
 * backend; the frontend only renders the states it is allowed to see.
 */
export type ProjectLifecycleState =
  | 'draft'
  | 'proposed'
  | 'active'
  | 'paused'
  | 'completed'
  | 'archived';

/**
 * Roles a member can hold inside a single project. Deny-by-default: unknown
 * roles grant no capability.
 */
export type ProjectMemberRole = 'owner' | 'lead' | 'contributor' | 'reviewer' | 'observer';

/**
 * Optimistic-concurrency token. Every mutation must echo the version it was
 * based on so stale writes are rejected with a stable conflict error.
 */
export interface ProjectVersionRef {
  version: number;
  etag: string;
}

/** Stable, actionable error codes surfaced by project endpoints. */
export type ProjectErrorCode =
  | 'project.not_found'
  | 'project.forbidden'
  | 'project.lifecycle_invalid'
  | 'project.version_conflict'
  | 'project.membership_duplicate'
  | 'project.resource_duplicate'
  | 'project.resource_integrity_failed'
  | 'project.resource_access_denied';

export interface ProjectError {
  code: ProjectErrorCode;
  message: string;
  /** Correlation id for support; never contains private payloads. */
  requestId?: string;
}

// ─── Projects: timeline & roadmap (CAPSTONE-063) ──────────────────────────────

export type TimelineEntryKind =
  | 'objective'
  | 'task'
  | 'milestone'
  | 'decision'
  | 'review'
  | 'funding'
  | 'charter_change';

export type TimelineEntryStatus =
  | 'planned'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'cancelled';

/**
 * A single timeline/roadmap entry. Sensitive fields (funding amounts, private
 * decision bodies, reviewer identities) are intentionally omitted; only the
 * minimized summary is exposed.
 */
export interface TimelineEntry {
  id: string;
  projectId: string;
  kind: TimelineEntryKind;
  title: string;
  summary?: string;
  status: TimelineEntryStatus;
  /** ISO-8601 timestamp; used for stable chronological ordering. */
  startsAt?: string;
  dueAt?: string;
  completedAt?: string;
  /** Monotonic ordering key so equal timestamps render deterministically. */
  order: number;
  version: number;
  /** Reference to the underlying record (decision, review, etc.). */
  sourceRef?: string;
  updatedAt: string;
}

export interface TimelineResponse {
  projectId: string;
  entries: TimelineEntry[];
  /** Version of the whole timeline; used to detect stale renders. */
  timelineVersion: number;
  generatedAt: string;
}

export interface TimelineFilters {
  kinds?: TimelineEntryKind[];
  statuses?: TimelineEntryStatus[];
  from?: string;
  to?: string;
}

// ─── Projects: collaboration workspace (CAPSTONE-065) ─────────────────────────

export interface ProjectOverview {
  id: string;
  name: string;
  description?: string;
  lifecycleState: ProjectLifecycleState;
  /** Role of the requesting user within this project. */
  viewerRole: ProjectMemberRole;
  version: number;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  /** Opaque user reference; email/identity fields are not exposed here. */
  userId: string;
  displayName: string;
  role: ProjectMemberRole;
  joinedAt: string;
  version: number;
}

export interface ProjectObjective {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TimelineEntryStatus;
  order: number;
  version: number;
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  dueAt?: string;
  status: TimelineEntryStatus;
  order: number;
  version: number;
}

export interface ProjectActivityItem {
  id: string;
  projectId: string;
  /** Coarse event type only; no private payload is included. */
  eventType:
    | 'member_joined'
    | 'member_role_changed'
    | 'objective_updated'
    | 'milestone_updated'
    | 'resource_added'
    | 'decision_recorded'
    | 'review_submitted';
  actorDisplayName?: string;
  occurredAt: string;
}

export interface ProjectNextAction {
  id: string;
  projectId: string;
  label: string;
  /** Route hint the UI may navigate to; never contains secrets. */
  targetRoute?: string;
  dueAt?: string;
  priority: 'low' | 'normal' | 'high';
}

export interface ProjectWorkspaceResponse {
  overview: ProjectOverview;
  members: ProjectMember[];
  objectives: ProjectObjective[];
  milestones: ProjectMilestone[];
  /** Resource summaries only; full library is fetched separately. */
  resourceCount: number;
  activity: ProjectActivityItem[];
  nextActions: ProjectNextAction[];
  generatedAt: string;
}

export interface AddProjectMemberPayload {
  userId: string;
  role: ProjectMemberRole;
  /** Idempotency key so retries cannot duplicate membership. */
  idempotencyKey: string;
}

export interface UpdateProjectMemberRolePayload {
  role: ProjectMemberRole;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface RemoveProjectMemberPayload {
  expectedVersion: number;
  idempotencyKey: string;
}

// ─── Projects: resource library (CAPSTONE-068) ────────────────────────────────

export type ProjectResourceKind = 'file' | 'dataset' | 'link' | 'citation';

export type ProjectResourceAccessPolicy = 'project_members' | 'project_reviewers' | 'project_leads';

export interface ProjectResourceIntegrity {
  /** Lowercase hex digest; algorithm identifies the hash family. */
  digest: string;
  algorithm: 'sha256' | 'sha512';
  /** ISO-8601 timestamp of the last successful verification. */
  verifiedAt?: string;
  verified: boolean;
}

export interface ProjectResourceVersion {
  version: number;
  createdAt: string;
  /** Opaque storage reference; never a signed URL or credential. */
  storageRef: string;
  sizeBytes?: number;
  integrity: ProjectResourceIntegrity;
}

export interface ProjectResourceLicense {
  id: string;
  name: string;
  /** SPDX identifier when available. */
  spdxId?: string;
  url?: string;
}

export interface ProjectResourceCitation {
  title: string;
  authors?: string[];
  year?: number;
  doi?: string;
  url?: string;
}

export interface ProjectResource {
  id: string;
  projectId: string;
  kind: ProjectResourceKind;
  title: string;
  description?: string;
  /** External URL for link resources; omitted for private files. */
  url?: string;
  license?: ProjectResourceLicense;
  citation?: ProjectResourceCitation;
  accessPolicy: ProjectResourceAccessPolicy;
  currentVersion: ProjectResourceVersion;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectResourceListResponse {
  projectId: string;
  resources: ProjectResource[];
  total: number;
  page: number;
  limit: number;
}

export interface ProjectResourceFilters {
  kinds?: ProjectResourceKind[];
  accessPolicies?: ProjectResourceAccessPolicy[];
  query?: string;
}

export interface CreateProjectResourcePayload {
  kind: ProjectResourceKind;
  title: string;
  description?: string;
  url?: string;
  licenseId?: string;
  citation?: ProjectResourceCitation;
  accessPolicy: ProjectResourceAccessPolicy;
  /** Idempotency key so retries cannot duplicate resources. */
  idempotencyKey: string;
}

export interface AddProjectResourceVersionPayload {
  storageRef: string;
  sizeBytes?: number;
  integrity: ProjectResourceIntegrity;
  expectedVersion: number;
  idempotencyKey: string;
}
