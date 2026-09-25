// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildApplicationWindow,
  computeUtcInstant,
  determineWindowStatus,
  evaluateDeadlineChange,
  evaluateSubmissionTiming,
  isValidTimeZone,
  validateApplicationWindow,
} from '@/src/features/scholarships/windows/domain';
import { mockSubmittedApplications } from '@/src/features/scholarships/windows/fixtures';
import type {
  ApplicationWindow,
  CreateWindowPayload,
} from '@/src/features/scholarships/windows/types';

describe('Application Windows & Deterministic Boundary Engine', () => {
  const basePayload: CreateWindowPayload = {
    programId: 'prog-stellar-2026',
    name: 'Fall 2026 African Engineering Window',
    openDate: '2026-08-01',
    openTime: '09:00',
    closeDate: '2026-11-30',
    closeTime: '23:59',
    timeZone: 'Africa/Nairobi',
    gracePeriodMinutes: 30,
    lateSubmissionPolicy: 'strict_reject',
  };

  describe('1. Deterministic Timezone-to-UTC Boundary Computation', () => {
    it('converts Africa/Nairobi (UTC+3) local date and time to deterministic UTC', () => {
      // 2026-11-30 23:59 in Nairobi (UTC+3) is 2026-11-30 20:59:00.000Z
      const utc = computeUtcInstant('2026-11-30', '23:59', 'Africa/Nairobi');
      expect(utc).toBe('2026-11-30T20:59:00.000Z');
    });

    it('converts UTC local date and time to identical UTC instant', () => {
      const utc = computeUtcInstant('2026-10-15', '12:00', 'UTC');
      expect(utc).toBe('2026-10-15T12:00:00.000Z');
    });

    it('converts America/New_York (EDT, UTC-4 in August) to deterministic UTC', () => {
      // 2026-08-01 09:00 in New York (EDT, UTC-4) is 2026-08-01 13:00:00.000Z
      const utc = computeUtcInstant('2026-08-01', '09:00', 'America/New_York');
      expect(utc).toBe('2026-08-01T13:00:00.000Z');
    });

    it('validates IANA timezones and rejects invalid strings', () => {
      expect(isValidTimeZone('UTC')).toBe(true);
      expect(isValidTimeZone('Africa/Nairobi')).toBe(true);
      expect(isValidTimeZone('Invalid/Timezone_X')).toBe(false);
    });
  });

  describe('2. Boundary Range Validation & Failure Invariants', () => {
    it('passes for a valid boundary range configuration', () => {
      const result = validateApplicationWindow(basePayload);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when opening instant is after or equal to closing deadline instant', () => {
      const invalidPayload: CreateWindowPayload = {
        ...basePayload,
        openDate: '2026-12-01',
        openTime: '10:00',
        closeDate: '2026-11-30',
        closeTime: '23:59',
      };
      const result = validateApplicationWindow(invalidPayload);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'OPEN_AFTER_CLOSE')).toBe(true);
    });

    it('fails on negative grace period values', () => {
      const negativeGracePayload: CreateWindowPayload = {
        ...basePayload,
        gracePeriodMinutes: -15,
      };
      const result = validateApplicationWindow(negativeGracePayload);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'NEGATIVE_GRACE_PERIOD')).toBe(true);
    });

    it('fails when late submission cutoff is before deadline and grace period', () => {
      const badLatePayload: CreateWindowPayload = {
        ...basePayload,
        lateSubmissionPolicy: 'allow_with_penalty',
        lateCutoffDate: '2026-11-30',
        lateCutoffTime: '23:00', // earlier than closeTime 23:59
      };
      const result = validateApplicationWindow(badLatePayload);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_LATE_CUTOFF')).toBe(true);
    });
  });

  describe('3. Window Status & Timing Evaluation', () => {
    const window = buildApplicationWindow(basePayload);

    it('classifies UPCOMING before opening boundary', () => {
      const beforeOpen = new Date('2026-07-15T00:00:00.000Z');
      expect(determineWindowStatus(window, beforeOpen)).toBe('UPCOMING');

      const timing = evaluateSubmissionTiming(beforeOpen, window);
      expect(timing.accepted).toBe(false);
      expect(timing.classification).toBe('REJECTED_BEFORE_OPEN');
    });

    it('classifies OPEN between opening and closing boundary', () => {
      const duringOpen = new Date('2026-09-15T12:00:00.000Z');
      expect(determineWindowStatus(window, duringOpen)).toBe('OPEN');

      const timing = evaluateSubmissionTiming(duringOpen, window);
      expect(timing.accepted).toBe(true);
      expect(timing.classification).toBe('ON_TIME');
    });

    it('classifies GRACE_PERIOD and accepts in-flight submissions within grace minutes', () => {
      // closeInstantUtc is 2026-11-30T20:59:00.000Z. Grace period is 30 mins (until 21:29:00.000Z)
      const inGrace = new Date('2026-11-30T21:15:00.000Z');
      expect(determineWindowStatus(window, inGrace)).toBe('GRACE_PERIOD');

      const timing = evaluateSubmissionTiming(inGrace, window);
      expect(timing.accepted).toBe(true);
      expect(timing.classification).toBe('GRACE_PERIOD');
      expect(timing.message).toContain('30-minute grace period');
    });

    it('rejects submissions past grace period under strict_reject policy', () => {
      const pastGrace = new Date('2026-11-30T21:45:00.000Z');
      expect(determineWindowStatus(window, pastGrace)).toBe('CLOSED');

      const timing = evaluateSubmissionTiming(pastGrace, window);
      expect(timing.accepted).toBe(false);
      expect(timing.classification).toBe('REJECTED_PAST_DEADLINE');
    });

    it('accepts late submissions with penalty under allow_with_penalty policy', () => {
      const penaltyWindow = buildApplicationWindow({
        ...basePayload,
        lateSubmissionPolicy: 'allow_with_penalty',
        latePenaltyPercent: 10,
        lateCutoffDate: '2026-12-05',
        lateCutoffTime: '23:59',
      });

      const inLateWindow = new Date('2026-12-02T12:00:00.000Z');
      expect(determineWindowStatus(penaltyWindow, inLateWindow)).toBe('LATE_WINDOW');

      const timing = evaluateSubmissionTiming(inLateWindow, penaltyWindow);
      expect(timing.accepted).toBe(true);
      expect(timing.classification).toBe('LATE_ACCEPTED');
      expect(timing.message).toContain('10% review penalty');
    });

    it('evaluates waiver token requirements under requires_waiver policy', () => {
      const waiverWindow = buildApplicationWindow({
        ...basePayload,
        lateSubmissionPolicy: 'requires_waiver',
        lateCutoffDate: '2026-12-05',
        lateCutoffTime: '23:59',
      });

      const lateInstant = new Date('2026-12-02T12:00:00.000Z');

      // Without waiver -> rejected
      const noWaiver = evaluateSubmissionTiming(lateInstant, waiverWindow);
      expect(noWaiver.accepted).toBe(false);
      expect(noWaiver.classification).toBe('REJECTED_LATE_POLICY');

      // With waiver token -> accepted
      const withWaiver = evaluateSubmissionTiming(lateInstant, waiverWindow, 'WAIVER-TOKEN-APPROVED-99');
      expect(withWaiver.accepted).toBe(true);
      expect(withWaiver.classification).toBe('LATE_ACCEPTED');
    });
  });

  describe('4. Deadline Modification & Historical Invariance (Grandfathering)', () => {
    it('guarantees that shortening a deadline does NOT silently invalidate submitted applications', () => {
      const currentWindow = buildApplicationWindow(basePayload);

      // Current close is 2026-11-30T20:59:00.000Z.
      // Suppose an administrator moves the deadline earlier to 2026-11-25.
      const proposedEarlierCloseUtc = computeUtcInstant('2026-11-25', '23:59', 'Africa/Nairobi');

      const assessment = evaluateDeadlineChange(
        currentWindow,
        proposedEarlierCloseUtc,
        mockSubmittedApplications
      );

      expect(assessment.isShortened).toBe(true);
      expect(assessment.safeToApply).toBe(true); // Safe because of grandfathering protection

      // Applications submitted between Nov 25 and Nov 30 must be identified and protected
      expect(assessment.affectedApplicationsCount).toBeGreaterThan(0);
      expect(assessment.grandfatheredApplicationIds).toEqual(
        expect.arrayContaining(['app-sub-102', 'app-sub-103'])
      );
      expect(assessment.warningMessage).toContain('grandfathered and will NOT be invalidated');
    });

    it('handles deadline extension without affected grandfathered applications', () => {
      const currentWindow = buildApplicationWindow(basePayload);
      const proposedLaterCloseUtc = computeUtcInstant('2026-12-31', '23:59', 'Africa/Nairobi');

      const assessment = evaluateDeadlineChange(
        currentWindow,
        proposedLaterCloseUtc,
        mockSubmittedApplications
      );

      expect(assessment.isExtended).toBe(true);
      expect(assessment.affectedApplicationsCount).toBe(0);
    });
  });
});
