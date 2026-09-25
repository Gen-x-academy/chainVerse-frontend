import { describe, expect, it } from 'vitest';
import {
  REDACTED_PLACEHOLDER,
  hasLeakedPii,
  redactApplicant,
  redactReviewer,
} from '../blind-review';
import type { ApplicantProfile, ReviewerIdentity } from '../blind-review';

const applicant: ApplicantProfile = {
  id: 'student-1',
  name: 'Jane Doe',
  email: 'jane@example.com',
  institution: 'MIT',
  location: 'Boston',
  profileUrl: 'https://example.com/jane',
  photo: 'https://example.com/jane.jpg',
  courseIds: ['course-1'],
  gradeValue: 90,
  statementOfPurpose: 'I want to learn.',
};

const reviewer: ReviewerIdentity = {
  id: 'r1',
  displayName: 'Dr. Smith',
  email: 'smith@example.com',
  institution: 'Harvard',
};

describe('blind review redaction', () => {
  describe('redactApplicant', () => {
    it('does not redact any field in none mode', () => {
      const redacted = redactApplicant(applicant, 'none');
      expect(redacted.name).toBe(applicant.name);
      expect(redacted.email).toBe(applicant.email);
      expect(redacted.institution).toBe(applicant.institution);
    });

    it('redacts name in single-blind mode', () => {
      expect(redactApplicant(applicant, 'single-blind').name).toBe(REDACTED_PLACEHOLDER);
    });

    it('redacts email in single-blind mode', () => {
      expect(redactApplicant(applicant, 'single-blind').email).toBe(REDACTED_PLACEHOLDER);
    });

    it('redacts profileUrl in single-blind mode', () => {
      expect(redactApplicant(applicant, 'single-blind').profileUrl).toBe(REDACTED_PLACEHOLDER);
    });

    it('removes photo in single-blind mode', () => {
      expect(redactApplicant(applicant, 'single-blind').photo).toBeUndefined();
    });

    it('preserves institution and location in single-blind mode', () => {
      const redacted = redactApplicant(applicant, 'single-blind');
      expect(redacted.institution).toBe(applicant.institution);
      expect(redacted.location).toBe(applicant.location);
    });

    it('redacts institution in double-blind mode', () => {
      expect(redactApplicant(applicant, 'double-blind').institution).toBe(REDACTED_PLACEHOLDER);
    });

    it('redacts location in double-blind mode', () => {
      expect(redactApplicant(applicant, 'double-blind').location).toBe(REDACTED_PLACEHOLDER);
    });

    it('removes photo in double-blind mode', () => {
      expect(redactApplicant(applicant, 'double-blind').photo).toBeUndefined();
    });

    it('preserves grade, courseIds, and statementOfPurpose in all modes', () => {
      for (const mode of ['single-blind', 'double-blind'] as const) {
        const redacted = redactApplicant(applicant, mode);
        expect(redacted.gradeValue).toBe(applicant.gradeValue);
        expect(redacted.courseIds).toEqual(applicant.courseIds);
        expect(redacted.statementOfPurpose).toBe(applicant.statementOfPurpose);
      }
    });

    it('preserves the applicant id in all modes', () => {
      for (const mode of ['none', 'single-blind', 'double-blind'] as const) {
        expect(redactApplicant(applicant, mode).id).toBe(applicant.id);
      }
    });
  });

  describe('redactReviewer', () => {
    it('preserves reviewer identity in none mode', () => {
      const redacted = redactReviewer(reviewer, 'none');
      expect(redacted.displayName).toBe(reviewer.displayName);
    });

    it('preserves reviewer identity in single-blind mode', () => {
      const redacted = redactReviewer(reviewer, 'single-blind');
      expect(redacted.displayName).toBe(reviewer.displayName);
      expect(redacted.email).toBe(reviewer.email);
    });

    it('redacts displayName in double-blind mode', () => {
      expect(redactReviewer(reviewer, 'double-blind').displayName).toBe(REDACTED_PLACEHOLDER);
    });

    it('redacts email in double-blind mode', () => {
      expect(redactReviewer(reviewer, 'double-blind').email).toBe(REDACTED_PLACEHOLDER);
    });

    it('redacts institution in double-blind mode', () => {
      expect(redactReviewer(reviewer, 'double-blind').institution).toBe(REDACTED_PLACEHOLDER);
    });

    it('preserves the reviewer id in double-blind mode for operational traceability', () => {
      expect(redactReviewer(reviewer, 'double-blind').id).toBe(reviewer.id);
    });
  });

  describe('hasLeakedPii', () => {
    it('reports no leak when fields are correctly redacted in single-blind mode', () => {
      expect(hasLeakedPii(redactApplicant(applicant, 'single-blind'), applicant, 'single-blind')).toBe(false);
    });

    it('reports no leak when fields are correctly redacted in double-blind mode', () => {
      expect(hasLeakedPii(redactApplicant(applicant, 'double-blind'), applicant, 'double-blind')).toBe(false);
    });

    it('detects a leak when a redacted field still contains the original value', () => {
      const leaky = { ...redactApplicant(applicant, 'single-blind'), name: applicant.name };
      expect(hasLeakedPii(leaky, applicant, 'single-blind')).toBe(true);
    });

    it('detects a leak when institution is not redacted in double-blind mode', () => {
      const leaky = { ...redactApplicant(applicant, 'double-blind'), institution: applicant.institution };
      expect(hasLeakedPii(leaky, applicant, 'double-blind')).toBe(true);
    });

    it('always reports no leak in none mode regardless of values', () => {
      expect(hasLeakedPii(applicant, applicant, 'none')).toBe(false);
    });
  });
});
