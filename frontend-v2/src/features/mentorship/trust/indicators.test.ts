import { describe, expect, it } from 'vitest';
import { buildMentorshipEvent } from '../analytics';
import { computeTrustIndicators } from './indicators';

const EMPTY_ACTIVITY = {};

describe('computeTrustIndicators', () => {
  it('is deterministic for the same activity input', () => {
    const first = computeTrustIndicators('student-1', {
      completedPrograms: 2,
      certificatesIssued: 1,
      responsesAnswered: 4,
      sessionsDelivered: 5,
      safetyReportsClosed: 3,
    });
    const second = computeTrustIndicators('student-1', {
      completedPrograms: 2,
      certificatesIssued: 1,
      responsesAnswered: 4,
      sessionsDelivered: 5,
      safetyReportsClosed: 3,
    });
    expect(first).toEqual(second);
  });

  it('flags sparse activity instead of inventing scores', () => {
    const profile = computeTrustIndicators('student-1', EMPTY_ACTIVITY);
    expect(profile.completion.sparseData).toBe(true);
    expect(profile.verification.sparseData).toBe(true);
    expect(profile.response.sparseData).toBe(true);
    expect(profile.delivery.sparseData).toBe(true);
    expect(profile.safety.sparseData).toBe(true);
    expect(profile.completion.score).toBe(0);
    expect(profile.completionPercent).toBe(0);
  });

  it('never awards a score above 100', () => {
    const profile = computeTrustIndicators('student-1', {
      completedPrograms: 500,
      certificatesIssued: 500,
      responsesAnswered: 500,
      sessionsDelivered: 500,
      safetyReportsClosed: 500,
    });
    for (const indicator of [
      profile.completion,
      profile.verification,
      profile.response,
      profile.delivery,
      profile.safety,
    ]) {
      expect(indicator.score).toBeLessThanOrEqual(100);
      expect(indicator.score).toBeGreaterThanOrEqual(0);
    }
  });

  it('explains every indicator in human readable words', () => {
    const profile = computeTrustIndicators('student-1', {
      completedPrograms: 1,
    });
    expect(profile.completion.explanation).toContain('completed');
    expect(profile.verification.explanation).toContain('certificate');
    expect(profile.response.explanation).toContain('question');
    expect(profile.delivery.explanation).toContain('session');
    expect(profile.safety.explanation).toContain('safety');
  });

  it('derives the completion percentage from completed programs only', () => {
    const profile = computeTrustIndicators('student-1', { completedPrograms: 7 });
    expect(profile.completionPercent).toBe(70);
  });

  it('builds retry-safe analytics events with no private data', () => {
    const first = buildMentorshipEvent(
      'trust_indicators',
      'student-1',
      'actor-1',
      new Date('2026-07-01T10:00:00.000Z')
    );
    const retry = buildMentorshipEvent(
      'trust_indicators',
      'student-1',
      'actor-1',
      new Date('2026-07-01T22:00:00.000Z')
    );
    expect(retry.dedupeKey).toBe(first.dedupeKey);
    expect(Object.keys(first).sort()).toEqual([
      'actorKey',
      'dedupeKey',
      'entityId',
      'occurredAt',
      'stage',
    ]);
  });
});
