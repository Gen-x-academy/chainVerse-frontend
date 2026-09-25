import { describe, expect, it } from 'vitest';
import { detectConflicts, hasActiveConflict } from '../conflict';
import type { ConflictRecord } from '../conflict';

const baseRecord: ConflictRecord = {
  id: 'c1',
  reviewerId: 'r1',
  reviewerName: 'Alice',
  applicationId: 'app-1',
  conflictType: 'declared-relationship',
  description: 'Declared relationship.',
  status: 'detected',
  detectedAt: '',
  updatedAt: '',
};

describe('conflict of interest detection', () => {
  describe('detectConflicts', () => {
    it('returns no conflicts when there is no overlap', () => {
      expect(detectConflicts({ reviewerId: 'r1' })).toHaveLength(0);
    });

    it('detects a declared relationship conflict', () => {
      const conflicts = detectConflicts({ reviewerId: 'r1', declaredRelationshipIds: ['r1'] });
      expect(conflicts.some((c) => c.conflictType === 'declared-relationship')).toBe(true);
    });

    it('does not flag a declared relationship when the reviewer is not in the list', () => {
      const conflicts = detectConflicts({ reviewerId: 'r1', declaredRelationshipIds: ['r2'] });
      expect(conflicts.some((c) => c.conflictType === 'declared-relationship')).toBe(false);
    });

    it('detects an applicant relationship conflict', () => {
      const conflicts = detectConflicts({
        reviewerId: 'r1',
        applicationApplicantId: 'student-1',
        reviewerApplicantIds: ['student-1'],
      });
      expect(conflicts.some((c) => c.conflictType === 'applicant-relation')).toBe(true);
    });

    it('does not flag an applicant conflict when the applicant is not known to the reviewer', () => {
      const conflicts = detectConflicts({
        reviewerId: 'r1',
        applicationApplicantId: 'student-1',
        reviewerApplicantIds: ['student-2'],
      });
      expect(conflicts.some((c) => c.conflictType === 'applicant-relation')).toBe(false);
    });

    it('detects a sponsor affiliation conflict', () => {
      const conflicts = detectConflicts({
        reviewerId: 'r1',
        applicationSponsorIds: ['sponsor-x'],
        reviewerSponsorIds: ['sponsor-x'],
      });
      expect(conflicts.some((c) => c.conflictType === 'sponsor-relation')).toBe(true);
    });

    it('detects an institution conflict', () => {
      const conflicts = detectConflicts({
        reviewerId: 'r1',
        applicationInstitutionId: 'uni-1',
        reviewerInstitutionIds: ['uni-1'],
      });
      expect(conflicts.some((c) => c.conflictType === 'institution-relation')).toBe(true);
    });

    it('detects a course connection conflict', () => {
      const conflicts = detectConflicts({
        reviewerId: 'r1',
        applicationCourseIds: ['course-a'],
        reviewerCourseIds: ['course-a'],
      });
      expect(conflicts.some((c) => c.conflictType === 'course-relation')).toBe(true);
    });

    it('can detect multiple conflict types at once', () => {
      const conflicts = detectConflicts({
        reviewerId: 'r1',
        declaredRelationshipIds: ['r1'],
        applicationInstitutionId: 'uni-1',
        reviewerInstitutionIds: ['uni-1'],
      });
      expect(conflicts.length).toBe(2);
    });
  });

  describe('hasActiveConflict', () => {
    it('identifies a detected conflict as blocking access', () => {
      expect(hasActiveConflict('r1', 'app-1', [baseRecord])).toBe(true);
    });

    it('identifies an acknowledged conflict as blocking access', () => {
      expect(
        hasActiveConflict('r1', 'app-1', [{ ...baseRecord, status: 'acknowledged' }])
      ).toBe(true);
    });

    it('does not block access for override-approved conflicts', () => {
      expect(
        hasActiveConflict('r1', 'app-1', [{ ...baseRecord, status: 'override-approved' }])
      ).toBe(false);
    });

    it('does not block access for cleared conflicts', () => {
      expect(
        hasActiveConflict('r1', 'app-1', [{ ...baseRecord, status: 'cleared' }])
      ).toBe(false);
    });

    it('does not block a different reviewer on the same application', () => {
      expect(hasActiveConflict('r2', 'app-1', [baseRecord])).toBe(false);
    });

    it('does not block the same reviewer on a different application', () => {
      expect(hasActiveConflict('r1', 'app-2', [baseRecord])).toBe(false);
    });

    it('returns false when the records list is empty', () => {
      expect(hasActiveConflict('r1', 'app-1', [])).toBe(false);
    });
  });
});
