/**
 * Mentee learning profile types (closes #1256, MENTOR-009, Identity track).
 *
 * A mentee controls the visibility of their own learning profile. Some fields
 * are sensitive — accessibility needs and matching preferences — and are never
 * disclosed to a mentor or another mentee, only used by authorized matching.
 */

export type MenteeProfileVisibility = 'private' | 'matching' | 'public';

export type MenteeLevel = 'beginner' | 'intermediate' | 'advanced';

export type MatchingPreferences = {
  preferredMentorLanguages?: string[];
  sessionCadence?: 'weekly' | 'biweekly' | 'monthly';
  maxSessionDurationMinutes?: number;
};

export type MenteeLearningProfile = {
  id: string;
  userId: string;
  goals: string[];
  currentLevel: MenteeLevel;
  /** Stable expertise node ids from the taxonomy (MENTOR-010). */
  interests: string[];
  preferredLanguage: string;
  /** IANA time-zone name. */
  timeZone: string;
  /** Sensitive: never disclosed to a viewer who is not the owner. */
  accessibilityNeeds?: string;
  /** Sensitive: never disclosed to a viewer who is not the owner. */
  matchingPreferences: MatchingPreferences;
  visibility: MenteeProfileVisibility;
  version: number;
  updatedAt: string;
};

export type MenteeProfileErrorCode =
  | 'GOALS_REQUIRED'
  | 'TOO_MANY_GOALS'
  | 'INTERESTS_REQUIRED'
  | 'INVALID_LEVEL'
  | 'LANGUAGE_REQUIRED'
  | 'TIMEZONE_REQUIRED'
  | 'INVALID_VISIBILITY'
  | 'ACCESSIBILITY_TOO_LONG';

export type MenteeProfileError = {
  code: MenteeProfileErrorCode;
  path: string;
  message: string;
};

/** A projection a matching engine may consume for one profile version. */
export type MenteeMatchingSnapshot = {
  userId: string;
  version: number;
  interests: string[];
  currentLevel: MenteeLevel;
  timeZone: string;
  preferredLanguage: string;
  matchingPreferences: MatchingPreferences;
};
