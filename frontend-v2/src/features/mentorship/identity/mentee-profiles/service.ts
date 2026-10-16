/**
 * Mentee learning profile validation, privacy, and completeness
 * (closes #1256, MENTOR-009).
 *
 * - **Mentees control visibility.** `visibility` is validated and, when not
 *   `public`, the profile is only projected for its owner or authorized staff.
 * - **Sensitive preferences stay private.** `accessibilityNeeds` and
 *   `matchingPreferences` are stripped from every projection that is not the
 *   owner's.
 * - **Completeness is measurable.** `computeProfileCompleteness` returns a
 *   `0..1` score and the missing field names.
 * - **Matching uses the current version.** `createMatchingSnapshot` refuses a
 *   stale version, so a match can never be computed against superseded data.
 */

import { apiClient } from '@/src/lib/api-client';
import type {
  MenteeLearningProfile,
  MenteeMatchingSnapshot,
  MenteeProfileError,
  MenteeProfileErrorCode,
  MenteeProfileVisibility,
} from './types';

export const MENTEE_PROFILE_LIMITS = {
  maxGoals: 10,
  accessibilityNeeds: 1000,
} as const;

export const MENTEE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export const MENTEE_VISIBILITIES: readonly MenteeProfileVisibility[] = [
  'private',
  'matching',
  'public',
];

/** Fields that must never be disclosed to anyone but the owner. */
export const MENTEE_PROFILE_SENSITIVE_FIELDS: readonly (keyof MenteeLearningProfile)[] = [
  'accessibilityNeeds',
  'matchingPreferences',
];

/** Fields a mentor-facing matching view is allowed to read. */
export const MENTEE_PROFILE_MATCHING_FIELDS: readonly (keyof MenteeLearningProfile)[] = [
  'userId',
  'goals',
  'currentLevel',
  'interests',
  'preferredLanguage',
  'timeZone',
  'version',
];

const COMPLETENESS_FIELDS = [
  'goals',
  'interests',
  'preferredLanguage',
  'timeZone',
  'matchingPreferences',
] as const;

function error(code: MenteeProfileErrorCode, path: string, message: string): MenteeProfileError {
  return { code, path, message };
}

export function validateMenteeLearningProfile(
  profile: MenteeLearningProfile,
): MenteeProfileError[] {
  const errors: MenteeProfileError[] = [];

  const goals = profile.goals ?? [];
  if (goals.length === 0) {
    errors.push(error('GOALS_REQUIRED', 'goals', 'Add at least one learning goal.'));
  } else if (goals.length > MENTEE_PROFILE_LIMITS.maxGoals) {
    errors.push(error('TOO_MANY_GOALS', 'goals', `Add at most ${MENTEE_PROFILE_LIMITS.maxGoals} goals.`));
  }

  if ((profile.interests ?? []).length === 0) {
    errors.push(error('INTERESTS_REQUIRED', 'interests', 'Choose at least one interest.'));
  }

  if (!(MENTEE_LEVELS as readonly string[]).includes(profile.currentLevel)) {
    errors.push(error('INVALID_LEVEL', 'currentLevel', 'Choose a valid current level.'));
  }

  if (!(profile.preferredLanguage ?? '').trim()) {
    errors.push(error('LANGUAGE_REQUIRED', 'preferredLanguage', 'A preferred language is required.'));
  }

  if (!(profile.timeZone ?? '').trim()) {
    errors.push(error('TIMEZONE_REQUIRED', 'timeZone', 'A time zone is required.'));
  }

  if (!MENTEE_VISIBILITIES.includes(profile.visibility)) {
    errors.push(error('INVALID_VISIBILITY', 'visibility', 'Choose a valid visibility.'));
  }

  if ((profile.accessibilityNeeds ?? '').length > MENTEE_PROFILE_LIMITS.accessibilityNeeds) {
    errors.push(
      error(
        'ACCESSIBILITY_TOO_LONG',
        'accessibilityNeeds',
        `Keep accessibility needs to ${MENTEE_PROFILE_LIMITS.accessibilityNeeds} characters or fewer.`,
      ),
    );
  }

  return errors;
}

/** `0..1` completeness over the fields matching needs, with the gaps named. */
export function computeProfileCompleteness(profile: MenteeLearningProfile): {
  score: number;
  missing: string[];
} {
  const missing: string[] = [];
  for (const field of COMPLETENESS_FIELDS) {
    const value = profile[field];
    const filled = Array.isArray(value)
      ? value.length > 0
      : typeof value === 'string'
        ? value.trim().length > 0
        : value !== undefined && value !== null && Object.keys(value as object).length > 0;
    if (!filled) missing.push(field);
  }
  const score = (COMPLETENESS_FIELDS.length - missing.length) / COMPLETENESS_FIELDS.length;
  return { score, missing };
}

export type MenteeProfileViewer = {
  userId?: string;
  isStaff?: boolean;
};

/**
 * Projection. The owner or staff receive the full record; every other viewer
 * receives non-sensitive fields only, and a `private` profile discloses just
 * its existence.
 */
export function projectMenteeLearningProfile(
  profile: MenteeLearningProfile,
  viewer: MenteeProfileViewer = {},
): Partial<MenteeLearningProfile> {
  const isOwner = viewer.userId !== undefined && viewer.userId === profile.userId;
  if (isOwner || viewer.isStaff) return { ...profile };

  if (profile.visibility === 'private') {
    return { id: profile.id, userId: profile.userId, visibility: profile.visibility };
  }

  const projected: Partial<MenteeLearningProfile> = {};
  for (const field of MENTEE_PROFILE_MATCHING_FIELDS) {
    (projected as Record<string, unknown>)[field] = profile[field];
  }
  return projected;
}

export class StaleMatchingVersionError extends Error {
  constructor(public readonly current: number, public readonly requested: number) {
    super(
      `Matching requested profile version ${requested} but the current version is ${current}. Refetch before matching.`,
    );
    this.name = 'StaleMatchingVersionError';
  }
}

/**
 * Builds the snapshot a matching engine may use. Requires the caller's
 * `expectedVersion` to equal the profile's current version, so matching is
 * never performed against superseded preferences.
 */
export function createMatchingSnapshot(
  profile: MenteeLearningProfile,
  expectedVersion: number = profile.version,
): MenteeMatchingSnapshot {
  if (expectedVersion !== profile.version) {
    throw new StaleMatchingVersionError(profile.version, expectedVersion);
  }
  return {
    userId: profile.userId,
    version: profile.version,
    interests: [...profile.interests],
    currentLevel: profile.currentLevel,
    timeZone: profile.timeZone,
    preferredLanguage: profile.preferredLanguage,
    matchingPreferences: { ...profile.matchingPreferences },
  };
}

const MENTEE_PATH = '/mentorship/mentee-profiles';

export const mentorshipMenteeProfileService = {
  get: (menteeId: string): Promise<MenteeLearningProfile> =>
    apiClient.get<MenteeLearningProfile>(`${MENTEE_PATH}/${encodeURIComponent(menteeId)}`),

  save: (profile: MenteeLearningProfile): Promise<MenteeLearningProfile> =>
    apiClient.put<MenteeLearningProfile>(
      `${MENTEE_PATH}/${encodeURIComponent(profile.id)}`,
      profile,
    ),

  /** Matching endpoint; the server must reject a stale `version`. */
  match: (menteeId: string, version: number): Promise<{ mentorIds: string[] }> =>
    apiClient.post<{ mentorIds: string[] }>(
      `${MENTEE_PATH}/${encodeURIComponent(menteeId)}/matches`,
      { version },
    ),
};
