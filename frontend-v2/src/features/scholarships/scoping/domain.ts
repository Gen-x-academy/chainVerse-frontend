/**
 * Program Scoping Domain Logic & Validation Engine.
 *
 * Implements validation, query filtering, explicit overlap detection,
 * and application gating rules for cohorts, terms, courses, institutions, and regions.
 *
 * Invariant: Inactive scopes CANNOT receive new applications.
 */

import type {
  ProgramScopeTarget,
  ScopeApplicationAcceptanceResult,
  ScopeOverlapConflict,
  ScopeOverlapEvaluation,
  ScopeQueryParams,
  ScopeValidationError,
  ScopeValidationResult,
  StudentScopeApplicationContext,
} from './types';

/**
 * Validates a program scope target configuration.
 *
 * Enforces:
 * 1. Required programId and name.
 * 2. At least one dimension (cohort, term, course, institution, region) must be targeted.
 * 3. Date ordering: applicationStartDate <= applicationEndDate.
 * 4. Inactive or archived scopes cannot be configured to accept new applications.
 */
export function validateProgramScope(scope: Partial<ProgramScopeTarget>): ScopeValidationResult {
  const errors: ScopeValidationError[] = [];
  const warnings: string[] = [];

  if (!scope.programId || !scope.programId.trim()) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      field: 'programId',
      message: 'Program ID is required.',
    });
  }

  if (!scope.name || !scope.name.trim()) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      field: 'name',
      message: 'Scope name is required.',
    });
  }

  const hasCohort = (scope.cohortIds?.length ?? 0) > 0;
  const hasTerm = (scope.termIds?.length ?? 0) > 0;
  const hasCourse = (scope.courseIds?.length ?? 0) > 0;
  const hasInstitution = (scope.institutionIds?.length ?? 0) > 0;
  const hasRegion = (scope.regions?.length ?? 0) > 0;

  if (!hasCohort && !hasTerm && !hasCourse && !hasInstitution && !hasRegion) {
    errors.push({
      code: 'NO_DIMENSIONS_SPECIFIED',
      field: 'dimensions',
      message: 'At least one scoping dimension (cohort, term, course, institution, or region) must be specified.',
    });
  }

  const validStatuses = ['active', 'inactive', 'archived'];
  if (scope.status && !validStatuses.includes(scope.status)) {
    errors.push({
      code: 'INVALID_STATUS',
      field: 'status',
      message: `Invalid scope status "${scope.status}". Must be active, inactive, or archived.`,
    });
  }

  // Invariant: Inactive scopes cannot accept new applications
  if (scope.status !== 'active' && scope.allowNewApplications === true) {
    errors.push({
      code: 'INACTIVE_SCOPE_ACCEPTING_APPLICATIONS',
      field: 'allowNewApplications',
      message: 'Inactive or archived scopes cannot receive or accept new applications.',
    });
  }

  if (scope.applicationStartDate && scope.applicationEndDate) {
    const start = new Date(scope.applicationStartDate).getTime();
    const end = new Date(scope.applicationEndDate).getTime();

    if (Number.isNaN(start) || Number.isNaN(end)) {
      errors.push({
        code: 'APPLICATION_WINDOW_INVALID',
        field: 'applicationStartDate',
        message: 'Application start or end date is not a valid date format.',
      });
    } else if (start > end) {
      errors.push({
        code: 'INVALID_DATE_RANGE',
        field: 'applicationEndDate',
        message: 'Application start date must be before or equal to the end date.',
      });
    }
  }

  if (scope.status === 'inactive') {
    warnings.push('This scope is inactive and will block all new student applications.');
  }

  if (scope.status === 'archived') {
    warnings.push('This scope is archived. Historical data will be retained in read-only mode.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Evaluates whether a program scope can receive new applications.
 * Invariant: Inactive scopes CANNOT receive new applications.
 */
export function canScopeAcceptApplications(
  scope: ProgramScopeTarget,
  currentTime: Date | string = new Date(),
  studentContext?: StudentScopeApplicationContext
): ScopeApplicationAcceptanceResult {
  const evaluatedAt = new Date().toISOString();
  const now = new Date(currentTime).getTime();

  // 1. Status Check: Inactive scopes cannot receive new applications
  if (scope.status === 'inactive') {
    return {
      canAccept: false,
      reason: 'SCOPE_INACTIVE',
      message: 'Scope is currently inactive. Inactive scopes cannot receive new applications.',
      scopeId: scope.id,
      evaluatedAt,
    };
  }

  // 2. Archived Check
  if (scope.status === 'archived') {
    return {
      canAccept: false,
      reason: 'SCOPE_ARCHIVED',
      message: 'Scope is archived. No new applications are permitted.',
      scopeId: scope.id,
      evaluatedAt,
    };
  }

  // 3. Application Flag Check
  if (!scope.allowNewApplications) {
    return {
      canAccept: false,
      reason: 'APPLICATIONS_DISABLED',
      message: 'Applications are temporarily disabled for this program scope.',
      scopeId: scope.id,
      evaluatedAt,
    };
  }

  // 4. Application Date Window Check
  if (scope.applicationStartDate) {
    const start = new Date(scope.applicationStartDate).getTime();
    if (now < start) {
      return {
        canAccept: false,
        reason: 'APPLICATION_WINDOW_NOT_OPEN',
        message: `Applications have not opened yet. Applications open on ${new Date(scope.applicationStartDate).toLocaleDateString()}.`,
        scopeId: scope.id,
        evaluatedAt,
      };
    }
  }

  if (scope.applicationEndDate) {
    const end = new Date(scope.applicationEndDate).getTime();
    if (now > end) {
      return {
        canAccept: false,
        reason: 'APPLICATION_WINDOW_CLOSED',
        message: `Application deadline passed on ${new Date(scope.applicationEndDate).toLocaleDateString()}.`,
        scopeId: scope.id,
        evaluatedAt,
      };
    }
  }

  // 5. Contextual Scope Fit Checks (if student context provided)
  if (studentContext) {
    if (studentContext.cohortId && scope.cohortIds.length > 0) {
      if (!scope.cohortIds.includes(studentContext.cohortId)) {
        return {
          canAccept: false,
          reason: 'COHORT_NOT_ACTIVE',
          message: 'Applicant cohort does not match the target cohorts for this scope.',
          scopeId: scope.id,
          evaluatedAt,
        };
      }
    }

    if (studentContext.termId && scope.termIds.length > 0) {
      if (!scope.termIds.includes(studentContext.termId)) {
        return {
          canAccept: false,
          reason: 'TERM_CLOSED',
          message: 'Applicant academic term is not included in this program scope.',
          scopeId: scope.id,
          evaluatedAt,
        };
      }
    }

    if (studentContext.courseId && scope.courseIds.length > 0) {
      if (!scope.courseIds.includes(studentContext.courseId)) {
        return {
          canAccept: false,
          reason: 'INELIGIBLE_COURSE',
          message: 'Applicant course is not eligible for this scholarship scope.',
          scopeId: scope.id,
          evaluatedAt,
        };
      }
    }

    if (studentContext.institutionId && scope.institutionIds.length > 0) {
      if (!scope.institutionIds.includes(studentContext.institutionId)) {
        return {
          canAccept: false,
          reason: 'INELIGIBLE_INSTITUTION',
          message: 'Applicant institution is not eligible under this program scope.',
          scopeId: scope.id,
          evaluatedAt,
        };
      }
    }

    if (studentContext.region && scope.regions.length > 0) {
      if (!scope.regions.includes(studentContext.region)) {
        return {
          canAccept: false,
          reason: 'INELIGIBLE_REGION',
          message: `Applicant region "${studentContext.region}" is outside the target geographic scope.`,
          scopeId: scope.id,
          evaluatedAt,
        };
      }
    }
  }

  return {
    canAccept: true,
    message: 'Scope is active and currently accepting new applications.',
    scopeId: scope.id,
    evaluatedAt,
  };
}

/**
 * Checks overlap between two scopes on cohorts, terms, and courses.
 */
function findDimensionOverlap(
  scopeA: ProgramScopeTarget,
  scopeB: ProgramScopeTarget
): {
  overlappingCohortIds: string[];
  overlappingTermIds: string[];
  overlappingCourseIds: string[];
  hasOverlap: boolean;
} {
  const setACohorts = new Set(scopeA.cohortIds);
  const overlappingCohortIds = scopeB.cohortIds.filter((id) => setACohorts.has(id));

  const setATerms = new Set(scopeA.termIds);
  const overlappingTermIds = scopeB.termIds.filter((id) => setATerms.has(id));

  const setACourses = new Set(scopeA.courseIds);
  const overlappingCourseIds = scopeB.courseIds.filter((id) => setACourses.has(id));

  const hasOverlap =
    overlappingCohortIds.length > 0 ||
    overlappingTermIds.length > 0 ||
    overlappingCourseIds.length > 0;

  return {
    overlappingCohortIds,
    overlappingTermIds,
    overlappingCourseIds,
    hasOverlap,
  };
}

/**
 * Evaluates scope overlap for a candidate scope against a set of existing scopes.
 * Overlap behavior is explicit:
 * - 'allow_concurrent': Coexistence permitted; non-blocking notification.
 * - 'disallow_overlap': Overlap with same cohort/term is disallowed; blocks activation.
 * - 'strict_exclusive': Exclusively one program enrollment permitted for the term/cohort.
 */
export function evaluateScopeOverlap(
  targetScope: ProgramScopeTarget,
  existingScopes: ProgramScopeTarget[]
): ScopeOverlapEvaluation {
  const conflicts: ScopeOverlapConflict[] = [];

  for (const existing of existingScopes) {
    if (existing.id === targetScope.id) continue;
    if (existing.status !== 'active') continue; // only active scopes trigger concurrent conflicts

    const { hasOverlap, overlappingCohortIds, overlappingTermIds, overlappingCourseIds } =
      findDimensionOverlap(targetScope, existing);

    if (hasOverlap) {
      const isTargetDisallowed = targetScope.overlapPolicy === 'disallow_overlap';
      const isExistingDisallowed = existing.overlapPolicy === 'disallow_overlap';
      const isTargetExclusive = targetScope.overlapPolicy === 'strict_exclusive';
      const isExistingExclusive = existing.overlapPolicy === 'strict_exclusive';

      const isBlocking =
        isTargetDisallowed || isExistingDisallowed || isTargetExclusive || isExistingExclusive;

      let message = '';
      if (isTargetExclusive || isExistingExclusive) {
        message = `Strict exclusive conflict: Program "${existing.name}" requires exclusive enrollment for overlapping cohort/term.`;
      } else if (isTargetDisallowed || isExistingDisallowed) {
        message = `Disallowed overlap: Program "${existing.name}" does not permit concurrent scopes on the same cohort/term.`;
      } else {
        message = `Informational: Program "${existing.name}" shares overlapping cohorts/terms. Concurrent enrollment allowed.`;
      }

      conflicts.push({
        targetScopeId: targetScope.id,
        conflictingScopeId: existing.id,
        conflictingScopeName: existing.name,
        overlappingCohortIds,
        overlappingTermIds,
        overlappingCourseIds,
        policy: targetScope.overlapPolicy,
        isBlocking,
        message,
      });
    }
  }

  const hasBlockingConflict = conflicts.some((c) => c.isBlocking);

  return {
    hasOverlap: conflicts.length > 0,
    isAllowed: !hasBlockingConflict,
    conflicts,
    resolutionAction: hasBlockingConflict ? 'block' : conflicts.length > 0 ? 'warn' : 'proceed',
    message: hasBlockingConflict
      ? 'Scope has blocking overlap conflicts under current overlap policies.'
      : conflicts.length > 0
        ? 'Scope has concurrent overlaps allowed by policy.'
        : 'No scope overlaps detected.',
  };
}

/**
 * Detects all pairwise overlap conflicts within a collection of scopes.
 */
export function detectScopeOverlaps(scopes: ProgramScopeTarget[]): ScopeOverlapConflict[] {
  const conflicts: ScopeOverlapConflict[] = [];

  for (let i = 0; i < scopes.length; i++) {
    for (let j = i + 1; j < scopes.length; j++) {
      const scopeA = scopes[i];
      const scopeB = scopes[j];

      if (scopeA.status !== 'active' || scopeB.status !== 'active') continue;

      const { hasOverlap, overlappingCohortIds, overlappingTermIds, overlappingCourseIds } =
        findDimensionOverlap(scopeA, scopeB);

      if (hasOverlap) {
        const isBlocking =
          scopeA.overlapPolicy !== 'allow_concurrent' ||
          scopeB.overlapPolicy !== 'allow_concurrent';

        conflicts.push({
          targetScopeId: scopeA.id,
          conflictingScopeId: scopeB.id,
          conflictingScopeName: scopeB.name,
          overlappingCohortIds,
          overlappingTermIds,
          overlappingCourseIds,
          policy: scopeA.overlapPolicy,
          isBlocking,
          message: isBlocking
            ? `Overlap conflict between "${scopeA.name}" and "${scopeB.name}".`
            : `Concurrent overlap permitted between "${scopeA.name}" and "${scopeB.name}".`,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Filters and queries program scopes by search criteria, dimensions, and active/inactive status.
 * Scopes are validated and queryable.
 */
export function filterAndQueryScopes(
  scopes: ProgramScopeTarget[],
  query: ScopeQueryParams = {}
): ProgramScopeTarget[] {
  return scopes.filter((scope) => {
    // 1. Program Filter
    if (query.programId && scope.programId !== query.programId) {
      return false;
    }

    // 2. Status Filter
    if (query.status && query.status !== 'all') {
      if (scope.status !== query.status) return false;
    }

    // 3. Accepting Applications Only
    if (query.acceptingApplicationsOnly) {
      const acceptance = canScopeAcceptApplications(scope);
      if (!acceptance.canAccept) return false;
    }

    // 4. Overlap Policy
    if (query.overlapPolicy && scope.overlapPolicy !== query.overlapPolicy) {
      return false;
    }

    // 5. Cohort Filter
    if (query.cohortId && !scope.cohortIds.includes(query.cohortId)) {
      return false;
    }

    // 6. Term Filter
    if (query.termId && !scope.termIds.includes(query.termId)) {
      return false;
    }

    // 7. Course Filter
    if (query.courseId && !scope.courseIds.includes(query.courseId)) {
      return false;
    }

    // 8. Institution Filter
    if (query.institutionId && !scope.institutionIds.includes(query.institutionId)) {
      return false;
    }

    // 9. Region Filter
    if (query.region && !scope.regions.includes(query.region)) {
      return false;
    }

    // 10. Search Query
    if (query.search && query.search.trim()) {
      const term = query.search.toLowerCase().trim();
      const matchName = scope.name.toLowerCase().includes(term);
      const matchDesc = (scope.description ?? '').toLowerCase().includes(term);
      const matchProgram = (scope.programName ?? '').toLowerCase().includes(term);
      const matchCohorts = scope.cohortIds.some((c) => c.toLowerCase().includes(term));
      const matchTerms = scope.termIds.some((t) => t.toLowerCase().includes(term));
      const matchCourses = scope.courseIds.some((cr) => cr.toLowerCase().includes(term));

      if (!matchName && !matchDesc && !matchProgram && !matchCohorts && !matchTerms && !matchCourses) {
        return false;
      }
    }

    return true;
  });
}
