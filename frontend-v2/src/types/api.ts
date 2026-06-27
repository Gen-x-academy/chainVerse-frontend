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
