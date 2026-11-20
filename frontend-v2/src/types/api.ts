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
  | 'workspace.reviews.submit';
