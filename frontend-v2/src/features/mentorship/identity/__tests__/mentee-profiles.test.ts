import { describe, expect, it } from 'vitest';
import {
  MENTEE_PROFILE_LIMITS,
  StaleMatchingVersionError,
  computeProfileCompleteness,
  createMatchingSnapshot,
  projectMenteeLearningProfile,
  validateMenteeLearningProfile,
} from '../mentee-profiles/service';
import type { MenteeLearningProfile } from '../mentee-profiles/types';

function profile(overrides: Partial<MenteeLearningProfile> = {}): MenteeLearningProfile {
  return {
    id: 'mentee-1',
    userId: 'user-1',
    goals: ['Learn algebra'],
    currentLevel: 'beginner',
    interests: ['algebra'],
    preferredLanguage: 'English',
    timeZone: 'Europe/London',
    accessibilityNeeds: 'Needs extra time.',
    matchingPreferences: { sessionCadence: 'weekly' },
    visibility: 'matching',
    version: 2,
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('validateMenteeLearningProfile', () => {
  it('accepts a complete profile', () => {
    expect(validateMenteeLearningProfile(profile())).toEqual([]);
  });

  it('requires at least one goal', () => {
    const errors = validateMenteeLearningProfile(profile({ goals: [] }));
    expect(errors.map((item) => item.code)).toContain('GOALS_REQUIRED');
  });

  it('caps the number of goals', () => {
    const errors = validateMenteeLearningProfile(
      profile({ goals: Array.from({ length: MENTEE_PROFILE_LIMITS.maxGoals + 1 }, (_, i) => `g${i}`) }),
    );
    expect(errors.map((item) => item.code)).toContain('TOO_MANY_GOALS');
  });

  it('requires interests, level, language, time zone, and a valid visibility', () => {
    const errors = validateMenteeLearningProfile(
      profile({
        interests: [],
        currentLevel: 'expert' as MenteeLearningProfile['currentLevel'],
        preferredLanguage: '',
        timeZone: '',
        visibility: 'everyone' as MenteeLearningProfile['visibility'],
      }),
    );
    const codes = errors.map((item) => item.code);
    expect(codes).toContain('INTERESTS_REQUIRED');
    expect(codes).toContain('INVALID_LEVEL');
    expect(codes).toContain('LANGUAGE_REQUIRED');
    expect(codes).toContain('TIMEZONE_REQUIRED');
    expect(codes).toContain('INVALID_VISIBILITY');
  });

  it('bounds accessibility notes', () => {
    const errors = validateMenteeLearningProfile(
      profile({ accessibilityNeeds: 'x'.repeat(MENTEE_PROFILE_LIMITS.accessibilityNeeds + 1) }),
    );
    expect(errors.map((item) => item.code)).toContain('ACCESSIBILITY_TOO_LONG');
  });
});

describe('computeProfileCompleteness', () => {
  it('scores a fully populated profile as complete', () => {
    const result = computeProfileCompleteness(profile());
    expect(result.score).toBe(1);
    expect(result.missing).toEqual([]);
  });

  it('names the missing fields and scores the remainder', () => {
    const result = computeProfileCompleteness(
      profile({ goals: [], interests: [], matchingPreferences: {} }),
    );
    expect(result.missing).toEqual(['goals', 'interests', 'matchingPreferences']);
    expect(result.score).toBeCloseTo(2 / 5);
  });
});

describe('projectMenteeLearningProfile', () => {
  it('gives the owner the sensitive fields', () => {
    const projected = projectMenteeLearningProfile(profile(), { userId: 'user-1' });
    expect(projected.accessibilityNeeds).toBe('Needs extra time.');
    expect(projected.matchingPreferences).toEqual({ sessionCadence: 'weekly' });
  });

  it('gives staff the sensitive fields', () => {
    const projected = projectMenteeLearningProfile(profile(), { isStaff: true });
    expect(projected.matchingPreferences).toBeDefined();
  });

  it('strips sensitive fields from any other viewer', () => {
    const projected = projectMenteeLearningProfile(profile(), { userId: 'someone-else' });
    expect('accessibilityNeeds' in projected).toBe(false);
    expect('matchingPreferences' in projected).toBe(false);
    expect(projected.interests).toEqual(['algebra']);
  });

  it('discloses only identity and visibility for a private profile', () => {
    const projected = projectMenteeLearningProfile(profile({ visibility: 'private' }), {
      userId: 'someone-else',
    });
    expect(projected).toEqual({ id: 'mentee-1', userId: 'user-1', visibility: 'private' });
  });
});

describe('createMatchingSnapshot', () => {
  it('builds a snapshot for the current version', () => {
    const snapshot = createMatchingSnapshot(profile(), 2);
    expect(snapshot.version).toBe(2);
    expect(snapshot.interests).toEqual(['algebra']);
    expect('accessibilityNeeds' in snapshot).toBe(false);
  });

  it('copies collections so later mutation cannot leak into the snapshot', () => {
    const source = profile();
    const snapshot = createMatchingSnapshot(source, 2);
    source.interests.push('calculus');
    expect(snapshot.interests).toEqual(['algebra']);
  });

  it('refuses a stale version', () => {
    expect(() => createMatchingSnapshot(profile(), 1)).toThrow(StaleMatchingVersionError);
  });
});
