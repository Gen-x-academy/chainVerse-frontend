import { describe, expect, it } from 'vitest';
import {
  accessibleScholarshipAreas,
  canAccessScholarshipArea,
} from '../scholarshipRoles';

describe('scholarshipRoles', () => {
  describe('canAccessScholarshipArea', () => {
    it('rejects actors with no recognized role', () => {
      expect(canAccessScholarshipArea(undefined, 'apply')).toBe(false);
      expect(canAccessScholarshipArea('guest', 'hub')).toBe(false);
    });

    it.each([
      ['student', 'apply', true],
      ['student', 'applications', false],
      ['student', 'manage', false],
      ['reviewer', 'applications', true],
      ['reviewer', 'apply', false],
      ['sponsor', 'awards', true],
      ['sponsor', 'manage', false],
      ['finance', 'awards', true],
      ['finance', 'applications', true],
      ['administrator', 'manage', true],
      ['administrator', 'applications', true],
    ])('%s -> %s is %s', (role, area, expected) => {
      expect(canAccessScholarshipArea(role, area as Parameters<typeof canAccessScholarshipArea>[1])).toBe(
        expected
      );
    });
  });

  describe('accessibleScholarshipAreas', () => {
    it('excludes hub and returns only granted areas', () => {
      expect(accessibleScholarshipAreas('student')).toEqual(['apply']);
      expect(accessibleScholarshipAreas('administrator')).toEqual([
        'applications',
        'awards',
        'manage',
      ]);
      expect(accessibleScholarshipAreas()).toEqual([]);
    });
  });
});