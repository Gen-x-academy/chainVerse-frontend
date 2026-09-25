/**
 * Scoping types for Scholarships and Programs (cohort and academic-term scoping).
 *
 * Supports associating a scholarship or sponsorship program with one or more:
 * - Cohorts (e.g. Alpha 2026, Beta 2026)
 * - Academic Terms (e.g. Fall 2026, Spring 2027)
 * - Courses (e.g. BC-101, DEFI-201)
 * - Institutions (e.g. Universities, Academies, Bootcamps)
 * - Geographic Regions (e.g. Africa, Asia, Europe, North America)
 */

export type GeographicRegion =
  | 'africa'
  | 'asia'
  | 'europe'
  | 'north-america'
  | 'south-america'
  | 'oceania';

export type CohortStatus = 'active' | 'inactive' | 'upcoming' | 'completed';

export interface AcademicCohort {
  id: string;
  name: string;
  code: string;
  startDate: string; // ISO-8601
  endDate: string; // ISO-8601
  status: CohortStatus;
  capacity?: number;
  enrolledCount?: number;
  institutionId?: string;
  description?: string;
}

export type AcademicTermStatus = 'active' | 'inactive' | 'closed';

export interface AcademicTerm {
  id: string;
  name: string;
  code: string; // e.g. "FA26", "SP27"
  academicYear: string; // e.g. "2026-2027"
  startDate: string; // ISO-8601
  endDate: string; // ISO-8601
  status: AcademicTermStatus;
  censusDate?: string; // ISO-8601
}

export interface AcademicCourse {
  id: string;
  code: string;
  title: string;
  institutionId?: string;
  department?: string;
  credits?: number;
  status: 'active' | 'inactive';
}

export interface AcademicInstitution {
  id: string;
  name: string;
  code: string;
  region: GeographicRegion | string;
  country?: string;
  status: 'active' | 'inactive';
  accreditationStatus?: string;
}

export interface AcademicRegion {
  id: string;
  code: string;
  name: string;
  status: 'active' | 'inactive';
}

/**
 * Explicit overlap behavior policy when a student or program has concurrent scopes.
 * - 'allow_concurrent': Multiple active scopes/programs can overlap without blocking.
 * - 'disallow_overlap': Scopes targeting the same cohort/term cannot overlap; blocking conflict.
 * - 'strict_exclusive': Exclusively one active scholarship enrollment is permitted for this cohort/term.
 */
export type ScopeOverlapPolicy = 'allow_concurrent' | 'disallow_overlap' | 'strict_exclusive';

export type ScopeStatus = 'active' | 'inactive' | 'archived';

/**
 * Association linking a scholarship program to specific cohorts, terms, courses, institutions, or regions.
 */
export interface ProgramScopeTarget {
  id: string;
  programId: string;
  programName?: string;
  name: string;
  description?: string;
  cohortIds: string[];
  termIds: string[];
  courseIds: string[];
  institutionIds: string[];
  regions: string[];
  status: ScopeStatus;
  overlapPolicy: ScopeOverlapPolicy;
  /** Inactive scopes cannot receive new applications; this flag mirrors or gates application intake. */
  allowNewApplications: boolean;
  applicationStartDate?: string;
  applicationEndDate?: string;
  maxApplicationsPerStudent?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type ScopeValidationErrorCode =
  | 'MISSING_REQUIRED_FIELD'
  | 'NO_DIMENSIONS_SPECIFIED'
  | 'INVALID_DATE_RANGE'
  | 'APPLICATION_WINDOW_INVALID'
  | 'INACTIVE_SCOPE_ACCEPTING_APPLICATIONS'
  | 'INVALID_STATUS';

export interface ScopeValidationError {
  code: ScopeValidationErrorCode;
  field: string;
  message: string;
}

export interface ScopeValidationResult {
  valid: boolean;
  errors: ScopeValidationError[];
  warnings: string[];
}

export type ApplicationRejectionReason =
  | 'SCOPE_INACTIVE'
  | 'SCOPE_ARCHIVED'
  | 'APPLICATIONS_DISABLED'
  | 'APPLICATION_WINDOW_NOT_OPEN'
  | 'APPLICATION_WINDOW_CLOSED'
  | 'COHORT_NOT_ACTIVE'
  | 'TERM_CLOSED'
  | 'OVERLAP_DISALLOWED'
  | 'STRICT_EXCLUSIVE_VIOLATION'
  | 'INELIGIBLE_REGION'
  | 'INELIGIBLE_INSTITUTION'
  | 'INELIGIBLE_COURSE';

export interface ScopeApplicationAcceptanceResult {
  canAccept: boolean;
  reason?: ApplicationRejectionReason;
  message: string;
  scopeId: string;
  evaluatedAt: string;
}

export interface ScopeOverlapConflict {
  targetScopeId: string;
  conflictingScopeId: string;
  conflictingScopeName: string;
  overlappingCohortIds: string[];
  overlappingTermIds: string[];
  overlappingCourseIds: string[];
  policy: ScopeOverlapPolicy;
  isBlocking: boolean;
  message: string;
}

export interface ScopeOverlapEvaluation {
  hasOverlap: boolean;
  isAllowed: boolean;
  conflicts: ScopeOverlapConflict[];
  resolutionAction: 'proceed' | 'warn' | 'block';
  message: string;
}

export interface ScopeQueryParams {
  search?: string;
  programId?: string;
  cohortId?: string;
  termId?: string;
  courseId?: string;
  institutionId?: string;
  region?: string;
  status?: 'all' | 'active' | 'inactive' | 'archived';
  acceptingApplicationsOnly?: boolean;
  overlapPolicy?: ScopeOverlapPolicy;
}

export interface ScopingReferenceData {
  cohorts: AcademicCohort[];
  terms: AcademicTerm[];
  courses: AcademicCourse[];
  institutions: AcademicInstitution[];
  regions: AcademicRegion[];
}

export interface CreateProgramScopePayload {
  programId: string;
  programName?: string;
  name: string;
  description?: string;
  cohortIds: string[];
  termIds: string[];
  courseIds: string[];
  institutionIds: string[];
  regions: string[];
  status: ScopeStatus;
  overlapPolicy: ScopeOverlapPolicy;
  allowNewApplications: boolean;
  applicationStartDate?: string;
  applicationEndDate?: string;
  maxApplicationsPerStudent?: number;
}

export interface UpdateProgramScopePayload extends Partial<CreateProgramScopePayload> {
  id: string;
}

export interface StudentScopeApplicationContext {
  studentId: string;
  cohortId?: string;
  termId?: string;
  courseId?: string;
  institutionId?: string;
  region?: string;
  activeEnrollmentScopeIds?: string[];
}
