/**
 * Mentor professional profile validation and projection (closes #1255, MENTOR-008).
 *
 * Three guarantees:
 * 1. **Owners can draft, then publish.** A draft is valid to store but not to
 *    publish; `canPublishMentorProfile` gates the transition.
 * 2. **Viewers see only permitted fields.** `projectMentorProfile` returns a
 *    field-projected copy, so a hidden field is never serialised to a viewer
 *    who is not the owner or staff.
 * 3. **Revisions are auditable.** `recordMentorProfileRevision` diffs two
 *    versions and records the changed field names with the editor and time.
 */

import { apiClient } from '@/src/lib/api-client';
import type {
  MentorProfile,
  MentorProfileError,
  MentorProfileErrorCode,
  MentorProfileRevision,
} from './types';

export const MENTOR_PROFILE_LIMITS = {
  headline: 120,
  biography: 2000,
  teachingApproach: 1000,
  maxExpertise: 20,
  maxLinks: 8,
  maxYearsOfExperience: 60,
} as const;

/** Fields a published profile exposes to any signed-in viewer. */
export const MENTOR_PROFILE_PUBLIC_FIELDS: readonly (keyof MentorProfile)[] = [
  'id',
  'userId',
  'headline',
  'biography',
  'expertiseSkillIds',
  'languages',
  'timeZone',
  'yearsOfExperience',
  'teachingApproach',
  'links',
  'visibility',
  'version',
  'updatedAt',
];

/** Fields only the owner or platform staff may ever read. */
export const MENTOR_PROFILE_OWNER_ONLY_FIELDS: readonly (keyof MentorProfile)[] = [
  'internalNotes',
];

const VISIBILITIES = ['draft', 'published', 'private'] as const;

function error(code: MentorProfileErrorCode, path: string, message: string): MentorProfileError {
  return { code, path, message };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Validates a full profile. Empty required fields and over-length copy are rejected. */
export function validateMentorProfile(profile: MentorProfile): MentorProfileError[] {
  const errors: MentorProfileError[] = [];

  const headline = profile.headline?.trim() ?? '';
  if (!headline) {
    errors.push(error('HEADLINE_REQUIRED', 'headline', 'A headline is required.'));
  } else if (headline.length > MENTOR_PROFILE_LIMITS.headline) {
    errors.push(
      error('HEADLINE_TOO_LONG', 'headline', `Keep the headline to ${MENTOR_PROFILE_LIMITS.headline} characters or fewer.`),
    );
  }

  if ((profile.biography ?? '').length > MENTOR_PROFILE_LIMITS.biography) {
    errors.push(
      error('BIOGRAPHY_TOO_LONG', 'biography', `Keep the biography to ${MENTOR_PROFILE_LIMITS.biography} characters or fewer.`),
    );
  }

  const expertise = profile.expertiseSkillIds ?? [];
  if (expertise.length === 0) {
    errors.push(error('EXPERTISE_REQUIRED', 'expertiseSkillIds', 'Select at least one area of expertise.'));
  } else if (expertise.length > MENTOR_PROFILE_LIMITS.maxExpertise) {
    errors.push(
      error('TOO_MANY_EXPERTISE', 'expertiseSkillIds', `Select at most ${MENTOR_PROFILE_LIMITS.maxExpertise} areas of expertise.`),
    );
  }

  if ((profile.languages ?? []).length === 0) {
    errors.push(error('LANGUAGES_REQUIRED', 'languages', 'Add at least one teaching language.'));
  }

  if (!(profile.timeZone ?? '').trim()) {
    errors.push(error('TIMEZONE_REQUIRED', 'timeZone', 'A time zone is required.'));
  }

  const years = profile.yearsOfExperience;
  if (!Number.isInteger(years) || years < 0 || years > MENTOR_PROFILE_LIMITS.maxYearsOfExperience) {
    errors.push(
      error(
        'EXPERIENCE_OUT_OF_RANGE',
        'yearsOfExperience',
        `Experience must be a whole number between 0 and ${MENTOR_PROFILE_LIMITS.maxYearsOfExperience}.`,
      ),
    );
  }

  if ((profile.teachingApproach ?? '').length > MENTOR_PROFILE_LIMITS.teachingApproach) {
    errors.push(
      error('TEACHING_APPROACH_TOO_LONG', 'teachingApproach', `Keep the teaching approach to ${MENTOR_PROFILE_LIMITS.teachingApproach} characters or fewer.`),
    );
  }

  const links = profile.links ?? [];
  if (links.length > MENTOR_PROFILE_LIMITS.maxLinks) {
    errors.push(error('TOO_MANY_LINKS', 'links', `Add at most ${MENTOR_PROFILE_LIMITS.maxLinks} links.`));
  }
  links.forEach((link, index) => {
    if (!isHttpUrl(link.url)) {
      errors.push(error('INVALID_LINK', `links[${index}].url`, 'Links must be an http(s) URL.'));
    }
  });

  if (!(VISIBILITIES as readonly string[]).includes(profile.visibility)) {
    errors.push(error('UNKNOWN_VISIBILITY', 'visibility', 'Choose a valid visibility.'));
  }

  return errors;
}

/** A profile may be published only when it validates and carries a biography. */
export function canPublishMentorProfile(profile: MentorProfile): boolean {
  if ((profile.biography ?? '').trim().length === 0) return false;
  return validateMentorProfile(profile).length === 0;
}

export type MentorProfileViewer = {
  userId?: string;
  /** Platform staff (moderator/administrator) may see owner-only fields. */
  isStaff?: boolean;
};

/**
 * Field projection. An owner or staff viewer receives every field; anyone else
 * receives public fields only, and a non-published profile discloses just its
 * identity and visibility for a consistent "not available" state.
 */
export function projectMentorProfile(
  profile: MentorProfile,
  viewer: MentorProfileViewer = {},
): Partial<MentorProfile> {
  const isOwner = viewer.userId !== undefined && viewer.userId === profile.userId;
  if (isOwner || viewer.isStaff) return { ...profile };

  if (profile.visibility !== 'published') {
    return { id: profile.id, userId: profile.userId, visibility: profile.visibility };
  }

  const projected: Partial<MentorProfile> = {};
  for (const field of MENTOR_PROFILE_PUBLIC_FIELDS) {
    // `internalNotes` is not in the public list; assign only public fields.
    (projected as Record<string, unknown>)[field] = profile[field];
  }
  return projected;
}

/** Names of the fields that differ between two versions, in a stable order. */
export function changedMentorProfileFields(
  previous: Partial<MentorProfile>,
  next: Partial<MentorProfile>,
): string[] {
  const fields = new Set([...Object.keys(previous), ...Object.keys(next)]);
  const changed: string[] = [];
  for (const field of fields) {
    const before = JSON.stringify((previous as Record<string, unknown>)[field]);
    const after = JSON.stringify((next as Record<string, unknown>)[field]);
    if (before !== after) changed.push(field);
  }
  return changed.sort();
}

export function recordMentorProfileRevision(
  previous: MentorProfile | null,
  next: MentorProfile,
  editorId: string,
  now: Date = new Date(),
): MentorProfileRevision {
  return {
    version: next.version,
    at: now.toISOString(),
    by: editorId,
    changedFields: previous ? changedMentorProfileFields(previous, next) : ['created'],
  };
}

const PROFILES_PATH = '/mentorship/mentor-profiles';

export const mentorshipProfileService = {
  get: (mentorId: string): Promise<MentorProfile> =>
    apiClient.get<MentorProfile>(`${PROFILES_PATH}/${encodeURIComponent(mentorId)}`),

  /** Saves a draft; the caller decides when to publish. */
  save: (profile: MentorProfile): Promise<MentorProfile> =>
    apiClient.put<MentorProfile>(`${PROFILES_PATH}/${encodeURIComponent(profile.id)}`, profile),

  publish: (profile: MentorProfile): Promise<MentorProfile> =>
    apiClient.post<MentorProfile>(`${PROFILES_PATH}/${encodeURIComponent(profile.id)}/publish`, {
      version: profile.version,
    }),

  revisions: (mentorId: string): Promise<MentorProfileRevision[]> =>
    apiClient.get<MentorProfileRevision[]>(
      `${PROFILES_PATH}/${encodeURIComponent(mentorId)}/revisions`,
    ),
};
