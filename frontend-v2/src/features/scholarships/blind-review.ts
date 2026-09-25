import { apiClient } from '@/src/lib/api-client';

export type BlindMode = 'none' | 'single-blind' | 'double-blind';

export type RedactedField = 'name' | 'email' | 'institution' | 'location' | 'profileUrl' | 'photo';

export const REDACTED_PLACEHOLDER = '[REDACTED]';

export type ApplicantProfile = {
  id: string;
  name: string;
  email: string;
  institution: string;
  location: string;
  profileUrl: string;
  photo?: string;
  courseIds: string[];
  gradeValue?: number;
  statementOfPurpose: string;
};

export type ReviewerIdentity = {
  id: string;
  displayName: string;
  email: string;
  institution: string;
};

export type RedactedApplicantProfile = ApplicantProfile;

export type RedactedReviewerIdentity = ReviewerIdentity;

export type UnblindRequest = {
  id: string;
  applicationId: string;
  requestedBy: string;
  reason: string;
  approvedBy?: string;
  status: 'pending' | 'approved' | 'denied';
  requestedAt: string;
  resolvedAt?: string;
};

const SINGLE_BLIND_FIELDS: ReadonlySet<RedactedField> = new Set([
  'name',
  'email',
  'profileUrl',
  'photo',
]);

const DOUBLE_BLIND_FIELDS: ReadonlySet<RedactedField> = new Set([
  'name',
  'email',
  'institution',
  'location',
  'profileUrl',
  'photo',
]);

export function redactApplicant(
  profile: ApplicantProfile,
  mode: BlindMode
): RedactedApplicantProfile {
  if (mode === 'none') return { ...profile };
  const fields = mode === 'double-blind' ? DOUBLE_BLIND_FIELDS : SINGLE_BLIND_FIELDS;
  return {
    ...profile,
    name: fields.has('name') ? REDACTED_PLACEHOLDER : profile.name,
    email: fields.has('email') ? REDACTED_PLACEHOLDER : profile.email,
    institution: fields.has('institution') ? REDACTED_PLACEHOLDER : profile.institution,
    location: fields.has('location') ? REDACTED_PLACEHOLDER : profile.location,
    profileUrl: fields.has('profileUrl') ? REDACTED_PLACEHOLDER : profile.profileUrl,
    photo: fields.has('photo') ? undefined : profile.photo,
  };
}

export function redactReviewer(
  reviewer: ReviewerIdentity,
  mode: BlindMode
): RedactedReviewerIdentity {
  if (mode !== 'double-blind') return { ...reviewer };
  return {
    id: reviewer.id,
    displayName: REDACTED_PLACEHOLDER,
    email: REDACTED_PLACEHOLDER,
    institution: REDACTED_PLACEHOLDER,
  };
}

export function hasLeakedPii(
  redacted: RedactedApplicantProfile,
  original: ApplicantProfile,
  mode: BlindMode
): boolean {
  const fields =
    mode === 'double-blind'
      ? DOUBLE_BLIND_FIELDS
      : mode === 'single-blind'
        ? SINGLE_BLIND_FIELDS
        : (new Set<RedactedField>() as ReadonlySet<RedactedField>);
  for (const field of fields) {
    const originalValue = original[field];
    const redactedValue = redacted[field];
    if (originalValue && redactedValue === originalValue) return true;
  }
  return false;
}

export const blindReviewService = {
  getRedactedApplication: (
    applicationId: string
  ): Promise<{ profile: RedactedApplicantProfile; mode: BlindMode }> =>
    apiClient.get(`/scholarships/applications/${applicationId}/blind-view`),

  requestUnblind: (
    applicationId: string,
    reason: string,
    requestedBy: string
  ): Promise<UnblindRequest> =>
    apiClient.post(`/scholarships/applications/${applicationId}/unblind-request`, {
      reason,
      requestedBy,
    }),

  listUnblindRequests: (applicationId: string): Promise<UnblindRequest[]> =>
    apiClient.get(`/scholarships/applications/${applicationId}/unblind-requests`),
};
