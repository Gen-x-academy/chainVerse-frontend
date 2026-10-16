/**
 * Mentor professional profile types (closes #1255, MENTOR-008, Identity track).
 *
 * A mentor profile is authored by its owner, may be drafted privately, and is
 * published only when every required field validates. Viewers see a
 * field-projected copy — a draft or private profile discloses nothing but its
 * existence.
 */

export type MentorProfileVisibility = 'draft' | 'published' | 'private';

export type MentorProfileLink = {
  label: string;
  url: string;
};

export type MentorProfile = {
  id: string;
  userId: string;
  headline: string;
  biography: string;
  /** Stable expertise node ids from the taxonomy (MENTOR-010). */
  expertiseSkillIds: string[];
  languages: string[];
  /** IANA time-zone name, e.g. `Europe/London`. */
  timeZone: string;
  yearsOfExperience: number;
  teachingApproach: string;
  links: MentorProfileLink[];
  visibility: MentorProfileVisibility;
  /** Owner/staff-only working notes; never published. */
  internalNotes?: string;
  version: number;
  updatedAt: string;
};

export type MentorProfileErrorCode =
  | 'HEADLINE_REQUIRED'
  | 'HEADLINE_TOO_LONG'
  | 'BIOGRAPHY_TOO_LONG'
  | 'EXPERTISE_REQUIRED'
  | 'TOO_MANY_EXPERTISE'
  | 'LANGUAGES_REQUIRED'
  | 'TIMEZONE_REQUIRED'
  | 'EXPERIENCE_OUT_OF_RANGE'
  | 'TEACHING_APPROACH_TOO_LONG'
  | 'TOO_MANY_LINKS'
  | 'INVALID_LINK'
  | 'UNKNOWN_VISIBILITY';

export type MentorProfileError = {
  code: MentorProfileErrorCode;
  path: string;
  message: string;
};

/** One auditable change set; a profile keeps a monotonically versioned log. */
export type MentorProfileRevision = {
  version: number;
  at: string;
  by: string;
  changedFields: string[];
};
