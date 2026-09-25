// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  canScopeAcceptApplications,
  detectScopeOverlaps,
  evaluateScopeOverlap,
  filterAndQueryScopes,
  validateProgramScope,
} from '@/src/features/scholarships/scoping/domain';
import { mockProgramScopes } from '@/src/features/scholarships/scoping/fixtures';
import type { ProgramScopeTarget } from '@/src/features/scholarships/scoping/types';

describe('Program Scoping Domain Logic & Validation', () => {
  const validBaseScope: ProgramScopeTarget = {
    id: 'scope-test-1',
    programId: 'prog-1',
    programName: 'Stellar Fellows',
    name: 'Fall 2026 African Engineering Scope',
    description: 'Targeted support for African engineering students in Fall 2026.',
    cohortIds: ['cohort-2026-alpha'],
    termIds: ['term-2026-fall'],
    courseIds: ['course-bc-101'],
    institutionIds: ['inst-chainverse-acad'],
    regions: ['africa'],
    status: 'active',
    overlapPolicy: 'allow_concurrent',
    allowNewApplications: true,
    applicationStartDate: '2026-08-01T00:00:00.000Z',
    applicationEndDate: '2026-11-30T23:59:59.000Z',
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
  };

  describe('validateProgramScope', () => {
    it('passes for a fully valid scope target', () => {
      const result = validateProgramScope(validBaseScope);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects scopes without a programId', () => {
      const result = validateProgramScope({ ...validBaseScope, programId: '' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'programId')).toBe(true);
    });

    it('rejects scopes without a name', () => {
      const result = validateProgramScope({ ...validBaseScope, name: '   ' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'name')).toBe(true);
    });

    it('rejects scopes with no scoping dimensions specified', () => {
      const result = validateProgramScope({
        ...validBaseScope,
        cohortIds: [],
        termIds: [],
        courseIds: [],
        institutionIds: [],
        regions: [],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'NO_DIMENSIONS_SPECIFIED')).toBe(true);
    });

    it('rejects invalid application date ranges where start is after end', () => {
      const result = validateProgramScope({
        ...validBaseScope,
        applicationStartDate: '2026-12-01T00:00:00.000Z',
        applicationEndDate: '2026-10-01T00:00:00.000Z',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_DATE_RANGE')).toBe(true);
    });

    it('rejects inactive or archived scopes that claim to accept new applications', () => {
      const result = validateProgramScope({
        ...validBaseScope,
        status: 'inactive',
        allowNewApplications: true,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INACTIVE_SCOPE_ACCEPTING_APPLICATIONS')).toBe(
        true
      );
    });

    it('accepts inactive scopes when allowNewApplications is false and issues warning', () => {
      const result = validateProgramScope({
        ...validBaseScope,
        status: 'inactive',
        allowNewApplications: false,
      });
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('inactive and will block all new student applications');
    });
  });

  describe('canScopeAcceptApplications (Inactive Scope Gating)', () => {
    it('accepts applications for an active scope within the application window', () => {
      const now = new Date('2026-09-15T12:00:00.000Z');
      const result = canScopeAcceptApplications(validBaseScope, now);
      expect(result.canAccept).toBe(true);
      expect(result.message).toContain('active and currently accepting');
    });

    it('rejects applications when scope status is inactive', () => {
      const inactiveScope: ProgramScopeTarget = {
        ...validBaseScope,
        status: 'inactive',
        allowNewApplications: false,
      };
      const result = canScopeAcceptApplications(inactiveScope);
      expect(result.canAccept).toBe(false);
      expect(result.reason).toBe('SCOPE_INACTIVE');
      expect(result.message).toContain('Inactive scopes cannot receive new applications');
    });

    it('rejects applications when scope status is archived', () => {
      const archivedScope: ProgramScopeTarget = {
        ...validBaseScope,
        status: 'archived',
        allowNewApplications: false,
      };
      const result = canScopeAcceptApplications(archivedScope);
      expect(result.canAccept).toBe(false);
      expect(result.reason).toBe('SCOPE_ARCHIVED');
    });

    it('rejects applications when allowNewApplications is explicitly toggled off', () => {
      const disabledScope: ProgramScopeTarget = {
        ...validBaseScope,
        status: 'active',
        allowNewApplications: false,
      };
      const result = canScopeAcceptApplications(disabledScope);
      expect(result.canAccept).toBe(false);
      expect(result.reason).toBe('APPLICATIONS_DISABLED');
    });

    it('rejects applications before the application start date', () => {
      const beforeWindow = new Date('2026-07-01T00:00:00.000Z');
      const result = canScopeAcceptApplications(validBaseScope, beforeWindow);
      expect(result.canAccept).toBe(false);
      expect(result.reason).toBe('APPLICATION_WINDOW_NOT_OPEN');
    });

    it('rejects applications after the application end date', () => {
      const afterWindow = new Date('2026-12-05T00:00:00.000Z');
      const result = canScopeAcceptApplications(validBaseScope, afterWindow);
      expect(result.canAccept).toBe(false);
      expect(result.reason).toBe('APPLICATION_WINDOW_CLOSED');
    });

    it('rejects applications when student cohort does not match target cohorts', () => {
      const now = new Date('2026-09-15T12:00:00.000Z');
      const result = canScopeAcceptApplications(validBaseScope, now, {
        studentId: 'student-1',
        cohortId: 'cohort-2026-other',
      });
      expect(result.canAccept).toBe(false);
      expect(result.reason).toBe('COHORT_NOT_ACTIVE');
    });

    it('rejects applications when student term does not match target terms', () => {
      const now = new Date('2026-09-15T12:00:00.000Z');
      const result = canScopeAcceptApplications(validBaseScope, now, {
        studentId: 'student-1',
        cohortId: 'cohort-2026-alpha',
        termId: 'term-2025-spring',
      });
      expect(result.canAccept).toBe(false);
      expect(result.reason).toBe('TERM_CLOSED');
    });

    it('rejects applications when student region does not match target region', () => {
      const now = new Date('2026-09-15T12:00:00.000Z');
      const result = canScopeAcceptApplications(validBaseScope, now, {
        studentId: 'student-1',
        region: 'north-america',
      });
      expect(result.canAccept).toBe(false);
      expect(result.reason).toBe('INELIGIBLE_REGION');
    });
  });

  describe('Scope Overlap Evaluation & Explicit Policies', () => {
    const existingScope: ProgramScopeTarget = {
      ...validBaseScope,
      id: 'existing-scope-1',
      name: 'Existing Stellar Fellowship Scope',
      status: 'active',
      cohortIds: ['cohort-2026-alpha'],
      termIds: ['term-2026-fall'],
      overlapPolicy: 'disallow_overlap',
    };

    it('permits concurrent overlap when both scopes use allow_concurrent policy', () => {
      const targetScope: ProgramScopeTarget = {
        ...validBaseScope,
        id: 'target-scope-1',
        cohortIds: ['cohort-2026-alpha'],
        termIds: ['term-2026-fall'],
        overlapPolicy: 'allow_concurrent',
      };
      const existingConcurrent: ProgramScopeTarget = {
        ...existingScope,
        overlapPolicy: 'allow_concurrent',
      };

      const result = evaluateScopeOverlap(targetScope, [existingConcurrent]);
      expect(result.hasOverlap).toBe(true);
      expect(result.isAllowed).toBe(true);
      expect(result.resolutionAction).toBe('warn');
      expect(result.conflicts[0].isBlocking).toBe(false);
    });

    it('blocks overlap when either scope configures disallow_overlap policy', () => {
      const targetScope: ProgramScopeTarget = {
        ...validBaseScope,
        id: 'target-scope-2',
        cohortIds: ['cohort-2026-alpha'],
        termIds: ['term-2026-fall'],
        overlapPolicy: 'allow_concurrent',
      };

      const result = evaluateScopeOverlap(targetScope, [existingScope]);
      expect(result.hasOverlap).toBe(true);
      expect(result.isAllowed).toBe(false);
      expect(result.resolutionAction).toBe('block');
      expect(result.conflicts[0].isBlocking).toBe(true);
      expect(result.conflicts[0].message).toContain('Disallowed overlap');
    });

    it('strictly blocks overlap when strict_exclusive policy is configured', () => {
      const targetScope: ProgramScopeTarget = {
        ...validBaseScope,
        id: 'target-scope-3',
        cohortIds: ['cohort-2026-alpha'],
        termIds: ['term-2026-fall'],
        overlapPolicy: 'strict_exclusive',
      };

      const result = evaluateScopeOverlap(targetScope, [existingScope]);
      expect(result.hasOverlap).toBe(true);
      expect(result.isAllowed).toBe(false);
      expect(result.resolutionAction).toBe('block');
      expect(result.conflicts[0].message).toContain('Strict exclusive conflict');
    });

    it('detects no conflicts when scopes target completely disjoint cohorts and terms', () => {
      const disjointScope: ProgramScopeTarget = {
        ...validBaseScope,
        id: 'target-scope-4',
        cohortIds: ['cohort-2027-spring'],
        termIds: ['term-2027-spring'],
        courseIds: ['course-other'],
        overlapPolicy: 'strict_exclusive',
      };

      const result = evaluateScopeOverlap(disjointScope, [existingScope]);
      expect(result.hasOverlap).toBe(false);
      expect(result.isAllowed).toBe(true);
      expect(result.resolutionAction).toBe('proceed');
    });

    it('detectScopeOverlaps returns pairwise conflicts across scope collections', () => {
      const scopeA: ProgramScopeTarget = {
        ...validBaseScope,
        id: 'scope-a',
        cohortIds: ['cohort-x'],
        termIds: ['term-y'],
        overlapPolicy: 'disallow_overlap',
        status: 'active',
      };
      const scopeB: ProgramScopeTarget = {
        ...validBaseScope,
        id: 'scope-b',
        cohortIds: ['cohort-x'],
        termIds: ['term-y'],
        overlapPolicy: 'disallow_overlap',
        status: 'active',
      };

      const conflicts = detectScopeOverlaps([scopeA, scopeB]);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].isBlocking).toBe(true);
    });
  });

  describe('filterAndQueryScopes', () => {
    it('filters scopes by status', () => {
      const active = filterAndQueryScopes(mockProgramScopes, { status: 'active' });
      expect(active.every((s) => s.status === 'active')).toBe(true);

      const inactive = filterAndQueryScopes(mockProgramScopes, { status: 'inactive' });
      expect(inactive.every((s) => s.status === 'inactive')).toBe(true);
    });

    it('filters scopes accepting applications only', () => {
      const accepting = filterAndQueryScopes(mockProgramScopes, {
        acceptingApplicationsOnly: true,
      });
      for (const scope of accepting) {
        expect(scope.status).toBe('active');
        expect(scope.allowNewApplications).toBe(true);
      }
    });

    it('filters scopes by cohort ID', () => {
      const cohortFiltered = filterAndQueryScopes(mockProgramScopes, {
        cohortId: 'cohort-2026-alpha',
      });
      expect(cohortFiltered.length).toBeGreaterThan(0);
      expect(cohortFiltered.every((s) => s.cohortIds.includes('cohort-2026-alpha'))).toBe(true);
    });

    it('filters scopes by term ID', () => {
      const termFiltered = filterAndQueryScopes(mockProgramScopes, {
        termId: 'term-2027-spring',
      });
      expect(termFiltered.length).toBeGreaterThan(0);
      expect(termFiltered.every((s) => s.termIds.includes('term-2027-spring'))).toBe(true);
    });

    it('filters scopes by geographic region', () => {
      const regionFiltered = filterAndQueryScopes(mockProgramScopes, { region: 'africa' });
      expect(regionFiltered.length).toBeGreaterThan(0);
      expect(regionFiltered.every((s) => s.regions.includes('africa'))).toBe(true);
    });

    it('searches by keyword matching name or description', () => {
      const searchResults = filterAndQueryScopes(mockProgramScopes, { search: 'DeFi' });
      expect(searchResults.length).toBeGreaterThan(0);
      expect(
        searchResults.some(
          (s) =>
            s.name.toLowerCase().includes('defi') ||
            (s.description ?? '').toLowerCase().includes('defi')
        )
      ).toBe(true);
    });
  });
});
