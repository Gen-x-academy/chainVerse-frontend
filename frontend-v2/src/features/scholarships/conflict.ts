import { apiClient } from '@/src/lib/api-client';

export type ConflictType =
  | 'applicant-relation'
  | 'sponsor-relation'
  | 'institution-relation'
  | 'course-relation'
  | 'declared-relationship';

export type ConflictStatus = 'detected' | 'acknowledged' | 'override-approved' | 'cleared';

export type ConflictRecord = {
  id: string;
  reviewerId: string;
  reviewerName: string;
  applicationId: string;
  conflictType: ConflictType;
  description: string;
  status: ConflictStatus;
  overrideApprovedBy?: string;
  overrideReason?: string;
  detectedAt: string;
  updatedAt: string;
};

export type ConflictCheckInput = {
  reviewerId: string;
  applicationApplicantId?: string;
  applicationSponsorIds?: string[];
  applicationInstitutionId?: string;
  applicationCourseIds?: string[];
  declaredRelationshipIds?: string[];
  reviewerApplicantIds?: string[];
  reviewerSponsorIds?: string[];
  reviewerInstitutionIds?: string[];
  reviewerCourseIds?: string[];
};

export type DetectedConflict = {
  conflictType: ConflictType;
  description: string;
};

export function detectConflicts(input: ConflictCheckInput): DetectedConflict[] {
  const conflicts: DetectedConflict[] = [];

  const reviewerApplicants = new Set(input.reviewerApplicantIds ?? []);
  if (input.applicationApplicantId && reviewerApplicants.has(input.applicationApplicantId)) {
    conflicts.push({
      conflictType: 'applicant-relation',
      description: 'Reviewer has a known relationship with the applicant.',
    });
  }

  const reviewerSponsors = new Set(input.reviewerSponsorIds ?? []);
  for (const sponsorId of input.applicationSponsorIds ?? []) {
    if (reviewerSponsors.has(sponsorId)) {
      conflicts.push({
        conflictType: 'sponsor-relation',
        description: 'Reviewer is affiliated with the application sponsor.',
      });
      break;
    }
  }

  const reviewerInstitutions = new Set(input.reviewerInstitutionIds ?? []);
  if (input.applicationInstitutionId && reviewerInstitutions.has(input.applicationInstitutionId)) {
    conflicts.push({
      conflictType: 'institution-relation',
      description: 'Reviewer shares an institution with the applicant.',
    });
  }

  const reviewerCourses = new Set(input.reviewerCourseIds ?? []);
  for (const courseId of input.applicationCourseIds ?? []) {
    if (reviewerCourses.has(courseId)) {
      conflicts.push({
        conflictType: 'course-relation',
        description: 'Reviewer has a direct connection to the applied course.',
      });
      break;
    }
  }

  if ((input.declaredRelationshipIds ?? []).includes(input.reviewerId)) {
    conflicts.push({
      conflictType: 'declared-relationship',
      description: 'A declared relationship with this reviewer was reported.',
    });
  }

  return conflicts;
}

export function hasActiveConflict(
  reviewerId: string,
  applicationId: string,
  records: ConflictRecord[]
): boolean {
  return records.some(
    (record) =>
      record.reviewerId === reviewerId &&
      record.applicationId === applicationId &&
      (record.status === 'detected' || record.status === 'acknowledged')
  );
}

export const fallbackConflicts: ConflictRecord[] = [
  {
    id: 'conflict-1',
    reviewerId: 'reviewer-2',
    reviewerName: 'Priya Sharma',
    applicationId: 'app-7',
    conflictType: 'declared-relationship',
    description: 'A declared relationship with this reviewer was reported.',
    status: 'detected',
    detectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const conflictService = {
  list: (applicationId: string): Promise<ConflictRecord[]> =>
    apiClient.get<ConflictRecord[]>(`/scholarships/applications/${applicationId}/conflicts`),

  declare: (
    applicationId: string,
    reviewerId: string,
    conflictType: ConflictType,
    description: string
  ): Promise<ConflictRecord> =>
    apiClient.post<ConflictRecord>(`/scholarships/applications/${applicationId}/conflicts`, {
      reviewerId,
      conflictType,
      description,
    }),

  requestOverride: (
    conflictId: string,
    reason: string,
    requestedBy: string
  ): Promise<ConflictRecord> =>
    apiClient.post<ConflictRecord>(`/scholarships/conflicts/${conflictId}/override-request`, {
      reason,
      requestedBy,
    }),

  clear: (conflictId: string): Promise<ConflictRecord> =>
    apiClient.patch<ConflictRecord>(`/scholarships/conflicts/${conflictId}/clear`, {}),
};
