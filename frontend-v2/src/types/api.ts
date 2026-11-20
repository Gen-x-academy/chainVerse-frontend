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
  | 'workspace.notes.read'
  | 'workspace.notes.write'
  | 'workspace.notes.archive'
  | 'workspace.activity.read'
  | 'workspace.rubrics.read'
  | 'workspace.rubrics.write'
  | 'workspace.rubrics.publish'
  | 'workspace.reviews.blinded.read'
  | 'workspace.reviews.blinded.export';

// ─── Collaborative project notes (CAPSTONE-066) ──────────────────────────────

/**
 * Lifecycle states for a shared project note. Transitions are validated by the
 * backend; the frontend only renders the states it is allowed to see.
 */
export type NoteStatus = 'draft' | 'active' | 'archived';

/** Visibility of a note within the tenant. Never crosses tenant boundaries. */
export type NoteVisibility = 'project' | 'private';

/** Kind of resource a note links to. Links carry ids only, never payloads. */
export type NoteLinkKind = 'decision' | 'review' | 'sourceControl' | 'note';

/**
 * A link from a note to another workspace resource. Only the target id and kind
 * are stored so private content is never duplicated into the note graph.
 */
export interface NoteLink {
  id: string;
  kind: NoteLinkKind;
  targetId: string;
  createdAt: string;
}

/**
 * A single revision of a note. `body` is only present when the caller is
 * authorized to read note content; audit-safe projections omit it entirely.
 */
export interface NoteRevision {
  id: string;
  noteId: string;
  revision: number;
  title: string;
  body?: string;
  authorId: string;
  createdAt: string;
  /** Optimistic-concurrency token used to reject stale edits. */
  etag: string;
}

/**
 * A collaborative project note. The list projection omits `body`; the detail
 * projection includes the latest revision when authorized.
 */
export interface Note {
  id: string;
  projectId: string;
  title: string;
  status: NoteStatus;
  visibility: NoteVisibility;
  currentRevision: number;
  links: NoteLink[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  /** Present only on the detail projection for authorized readers. */
  latestRevision?: NoteRevision;
}

export interface CreateNotePayload {
  projectId: string;
  title: string;
  body: string;
  visibility: NoteVisibility;
  links?: Array<Pick<NoteLink, 'kind' | 'targetId'>>;
}

export interface UpdateNotePayload {
  title?: string;
  body?: string;
  visibility?: NoteVisibility;
  links?: Array<Pick<NoteLink, 'kind' | 'targetId'>>;
  /** Required to detect stale edits; mismatches surface a NoteConflict. */
  expectedRevision: number;
}

export interface ArchiveNotePayload {
  expectedRevision: number;
  reason?: string;
}

/**
 * Stable, actionable conflict surfaced when a note edit is based on a stale
 * revision. Contains no note body so it is safe to log and display.
 */
export interface NoteConflict {
  code: 'NOTE_STALE_REVISION' | 'NOTE_ARCHIVED' | 'NOTE_NOT_FOUND';
  message: string;
  noteId: string;
  expectedRevision: number;
  currentRevision: number;
}

// ─── Project activity feed (CAPSTONE-072) ────────────────────────────────────

/**
 * Activity event types. Each maps to a permission-filtered projection; private
 * payloads are never copied into the feed.
 */
export type ActivityEventType =
  | 'note.created'
  | 'note.updated'
  | 'note.archived'
  | 'decision.created'
  | 'decision.superseded'
  | 'review.assigned'
  | 'review.submitted'
  | 'rubric.published';

/**
 * A single activity event. `summary` is a short, privacy-safe description; it
 * never contains note bodies, reviewer identities, or private comments.
 */
export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  /** Actor id only; display names are resolved separately when authorized. */
  actorId: string;
  occurredAt: string;
  summary: string;
  /** Deep link into the workspace route for the affected resource. */
  deepLink: string;
  resourceId: string;
  isRead: boolean;
}

/** Cursor-paginated activity page. Cursors are opaque and stable. */
export interface ActivityPage {
  data: ActivityEvent[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ActivityReadState {
  lastReadAt: string;
  unreadCount: number;
}

export interface ActivityFilters {
  types?: ActivityEventType[];
  actorId?: string;
  since?: string;
  until?: string;
  unreadOnly?: boolean;
}

// ─── Configurable review rubrics (CAPSTONE-074) ──────────────────────────────

export type RubricVisibility = 'reviewers' | 'authors' | 'public';

export type RubricAggregationRule = 'weightedMean' | 'weightedSum' | 'median';

export interface RubricScoreRange {
  min: number;
  max: number;
  step: number;
}

/**
 * A single rubric criterion. `guidance` is reviewer-facing and is never copied
 * into audit records.
 */
export interface RubricCriterion {
  id: string;
  label: string;
  weight: number;
  guidance?: string;
  scoreRange: RubricScoreRange;
  requiredComment: boolean;
}

/**
 * An immutable, versioned rubric snapshot. Editing a rubric creates a new
 * version; published versions are read-only.
 */
export interface RubricVersion {
  id: string;
  rubricId: string;
  version: number;
  criteria: RubricCriterion[];
  aggregationRule: RubricAggregationRule;
  visibility: RubricVisibility;
  publishedAt?: string;
  createdAt: string;
}

export interface Rubric {
  id: string;
  projectId: string;
  name: string;
  currentVersion: number;
  versions: RubricVersion[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRubricPayload {
  projectId: string;
  name: string;
  criteria: Array<Omit<RubricCriterion, 'id'>>;
  aggregationRule: RubricAggregationRule;
  visibility: RubricVisibility;
}

export interface PublishRubricPayload {
  /** Required to detect stale publishes against a newer draft. */
  expectedVersion: number;
}

// ─── Blinded review modes (CAPSTONE-076) ─────────────────────────────────────

export type BlindingMode = 'none' | 'singleBlind' | 'doubleBlind';

/**
 * Configuration controlling which identity fields are hidden. Deny-by-default:
 * any field not explicitly listed as visible is hidden.
 */
export interface BlindingConfig {
  mode: BlindingMode;
  /** Fields that remain visible to the caller; everything else is hidden. */
  visibleFields: Array<'reviewerId' | 'authorId' | 'reviewerName'>;
  enabledAt: string;
}

/**
 * A privacy-safe label standing in for a hidden identity. Deterministic per
 * project so the same hidden actor is stable within a project.
 */
export interface BlindedIdentityLabel {
  label: string;
  /** True when the underlying identity is hidden from the caller. */
  isBlinded: boolean;
}

/**
 * A blinded projection of a review. Identity fields are replaced with
 * BlindedIdentityLabel values and private comments are omitted entirely.
 */
export interface BlindedReviewProjection {
  id: string;
  projectId: string;
  reviewer: BlindedIdentityLabel;
  author: BlindedIdentityLabel;
  recommendation: string;
  submittedAt: string;
  /** Private reviewer comments are never included in blinded projections. */
}

/**
 * Request payload for a blinded export. Exports contain only blinded
 * projections and are audit-safe by construction.
 */
export interface BlindedExportPayload {
  projectId: string;
  format: 'csv' | 'json';
  includeComments: false;
}
