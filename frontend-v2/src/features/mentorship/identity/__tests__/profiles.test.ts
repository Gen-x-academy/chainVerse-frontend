import { describe, expect, it } from 'vitest';
import {
  MENTOR_PROFILE_LIMITS,
  canPublishMentorProfile,
  changedMentorProfileFields,
  projectMentorProfile,
  recordMentorProfileRevision,
  validateMentorProfile,
} from '../profiles/service';
import type { MentorProfile } from '../profiles/types';

function profile(overrides: Partial<MentorProfile> = {}): MentorProfile {
  return {
    id: 'profile-1',
    userId: 'user-1',
    headline: 'Mathematics mentor',
    biography: 'I help learners build confidence with algebra and calculus.',
    expertiseSkillIds: ['algebra'],
    languages: ['English'],
    timeZone: 'Europe/London',
    yearsOfExperience: 5,
    teachingApproach: 'Socratic questioning.',
    links: [{ label: 'Website', url: 'https://example.com' }],
    visibility: 'published',
    internalNotes: 'Prefers evening sessions.',
    version: 1,
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('validateMentorProfile', () => {
  it('accepts a complete profile', () => {
    expect(validateMentorProfile(profile())).toEqual([]);
  });

  it('requires a headline', () => {
    const errors = validateMentorProfile(profile({ headline: '   ' }));
    expect(errors.map((item) => item.code)).toContain('HEADLINE_REQUIRED');
  });

  it('rejects an over-long headline', () => {
    const errors = validateMentorProfile(
      profile({ headline: 'x'.repeat(MENTOR_PROFILE_LIMITS.headline + 1) }),
    );
    expect(errors.map((item) => item.code)).toContain('HEADLINE_TOO_LONG');
  });

  it('requires at least one area of expertise', () => {
    const errors = validateMentorProfile(profile({ expertiseSkillIds: [] }));
    expect(errors.map((item) => item.code)).toContain('EXPERTISE_REQUIRED');
  });

  it('caps the number of expertise areas', () => {
    const errors = validateMentorProfile(
      profile({
        expertiseSkillIds: Array.from({ length: MENTOR_PROFILE_LIMITS.maxExpertise + 1 }, (_, i) => `s${i}`),
      }),
    );
    expect(errors.map((item) => item.code)).toContain('TOO_MANY_EXPERTISE');
  });

  it('requires a teaching language and a time zone', () => {
    const errors = validateMentorProfile(profile({ languages: [], timeZone: '' }));
    const codes = errors.map((item) => item.code);
    expect(codes).toContain('LANGUAGES_REQUIRED');
    expect(codes).toContain('TIMEZONE_REQUIRED');
  });

  it('bounds years of experience', () => {
    expect(validateMentorProfile(profile({ yearsOfExperience: -1 })).map((e) => e.code)).toContain(
      'EXPERIENCE_OUT_OF_RANGE',
    );
    expect(
      validateMentorProfile(profile({ yearsOfExperience: MENTOR_PROFILE_LIMITS.maxYearsOfExperience + 1 })).map(
        (e) => e.code,
      ),
    ).toContain('EXPERIENCE_OUT_OF_RANGE');
  });

  it('rejects invalid links and unknown visibility', () => {
    const errors = validateMentorProfile(
      profile({ links: [{ label: 'bad', url: 'not-a-url' }], visibility: 'sneaky' as MentorProfile['visibility'] }),
    );
    const codes = errors.map((item) => item.code);
    expect(codes).toContain('INVALID_LINK');
    expect(codes).toContain('UNKNOWN_VISIBILITY');
  });
});

describe('canPublishMentorProfile', () => {
  it('publishes a valid profile with a biography', () => {
    expect(canPublishMentorProfile(profile())).toBe(true);
  });

  it('refuses a profile without a biography', () => {
    expect(canPublishMentorProfile(profile({ biography: '   ' }))).toBe(false);
  });

  it('refuses a profile that fails validation', () => {
    expect(canPublishMentorProfile(profile({ headline: '' }))).toBe(false);
  });
});

describe('projectMentorProfile', () => {
  it('returns every field, including internal notes, to the owner', () => {
    const projected = projectMentorProfile(profile(), { userId: 'user-1' });
    expect(projected.internalNotes).toBe('Prefers evening sessions.');
  });

  it('returns every field to platform staff', () => {
    const projected = projectMentorProfile(profile(), { isStaff: true });
    expect(projected.internalNotes).toBeDefined();
  });

  it('hides owner-only fields from an unrelated viewer', () => {
    const projected = projectMentorProfile(profile(), { userId: 'someone-else' });
    expect('internalNotes' in projected).toBe(false);
    expect(projected.headline).toBe('Mathematics mentor');
  });

  it('discloses only identity and visibility for a non-published profile', () => {
    const projected = projectMentorProfile(profile({ visibility: 'draft' }), { userId: 'someone-else' });
    expect(projected).toEqual({ id: 'profile-1', userId: 'user-1', visibility: 'draft' });
  });
});

describe('revision auditing', () => {
  it('names the changed fields in a stable order', () => {
    const before = profile();
    const after = profile({ headline: 'New headline', timeZone: 'America/New_York' });
    expect(changedMentorProfileFields(before, after)).toEqual(['headline', 'timeZone']);
  });

  it('records a creation marker when there is no previous version', () => {
    const revision = recordMentorProfileRevision(null, profile(), 'editor-1', new Date('2025-02-01T00:00:00.000Z'));
    expect(revision).toEqual({
      version: 1,
      at: '2025-02-01T00:00:00.000Z',
      by: 'editor-1',
      changedFields: ['created'],
    });
  });

  it('records the diff against the previous version', () => {
    const before = profile();
    const after = profile({ headline: 'New headline' });
    const revision = recordMentorProfileRevision(before, after, 'editor-1', new Date('2025-02-01T00:00:00.000Z'));
    expect(revision.changedFields).toEqual(['headline']);
  });
});
