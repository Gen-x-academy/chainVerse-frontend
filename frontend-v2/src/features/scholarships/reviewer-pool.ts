import { apiClient } from '@/src/lib/api-client';

export type ExpertiseTag =
  | 'blockchain'
  | 'defi'
  | 'nft'
  | 'smart-contracts'
  | 'finance'
  | 'education'
  | 'research'
  | 'general';

export type ReviewerAvailability = 'available' | 'limited' | 'unavailable';

export type Reviewer = {
  id: string;
  displayName: string;
  expertiseTags: ExpertiseTag[];
  availability: ReviewerAvailability;
  currentAssignments: number;
  maxAssignments: number;
  conflictApplicationIds: string[];
  active: boolean;
};

export type ReviewerPool = {
  id: string;
  name: string;
  description: string;
  scholarshipId: string;
  requiredTags: ExpertiseTag[];
  reviewers: Reviewer[];
  createdAt: string;
  updatedAt: string;
};

export type ReviewerPoolValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export function isReviewerAvailable(reviewer: Reviewer): boolean {
  return (
    reviewer.active &&
    reviewer.availability !== 'unavailable' &&
    reviewer.currentAssignments < reviewer.maxAssignments
  );
}

export function filterActiveReviewers(pool: ReviewerPool): Reviewer[] {
  return pool.reviewers.filter(isReviewerAvailable);
}

export function getWorkloadRatio(reviewer: Reviewer): number {
  if (reviewer.maxAssignments === 0) return 1;
  return reviewer.currentAssignments / reviewer.maxAssignments;
}

export function validateReviewerPool(pool: ReviewerPool): ReviewerPoolValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!pool.name.trim()) errors.push('Pool name is required.');
  if (!pool.scholarshipId.trim()) errors.push('Scholarship reference is required.');
  if (pool.reviewers.length === 0) errors.push('At least one reviewer is required in the pool.');

  const seenIds = new Set<string>();
  for (const reviewer of pool.reviewers) {
    if (seenIds.has(reviewer.id)) errors.push(`Duplicate reviewer id: ${reviewer.id}`);
    seenIds.add(reviewer.id);
    if (reviewer.maxAssignments < 0) {
      errors.push(`Reviewer ${reviewer.displayName} has an invalid maximum assignment count.`);
    }
  }

  if (pool.reviewers.length > 0 && filterActiveReviewers(pool).length === 0) {
    warnings.push('No reviewers are currently available to accept assignments.');
  }

  return { valid: errors.length === 0, errors, warnings };
}

export const fallbackReviewerPool: ReviewerPool = {
  id: 'pool-default',
  name: 'Default reviewer pool',
  description: 'Fallback pool used when the service is unavailable.',
  scholarshipId: 'scholarship-standard',
  requiredTags: ['blockchain', 'education'],
  reviewers: [
    {
      id: 'reviewer-1',
      displayName: 'Amara Osei',
      expertiseTags: ['blockchain', 'education'],
      availability: 'available',
      currentAssignments: 2,
      maxAssignments: 5,
      conflictApplicationIds: [],
      active: true,
    },
    {
      id: 'reviewer-2',
      displayName: 'Priya Sharma',
      expertiseTags: ['defi', 'finance'],
      availability: 'limited',
      currentAssignments: 4,
      maxAssignments: 5,
      conflictApplicationIds: ['app-7'],
      active: true,
    },
    {
      id: 'reviewer-3',
      displayName: 'Lena Fischer',
      expertiseTags: ['research', 'smart-contracts'],
      availability: 'unavailable',
      currentAssignments: 5,
      maxAssignments: 5,
      conflictApplicationIds: [],
      active: false,
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const reviewerPoolService = {
  list: (scholarshipId: string): Promise<ReviewerPool[]> =>
    apiClient.get<ReviewerPool[]>(`/scholarships/${scholarshipId}/reviewer-pools`),

  get: (poolId: string): Promise<ReviewerPool> =>
    apiClient.get<ReviewerPool>(`/scholarships/reviewer-pools/${poolId}`),

  updateWorkload: (
    poolId: string,
    reviewerId: string,
    currentAssignments: number
  ): Promise<Reviewer> =>
    apiClient.patch<Reviewer>(
      `/scholarships/reviewer-pools/${poolId}/reviewers/${reviewerId}/workload`,
      { currentAssignments }
    ),

  setAvailability: (
    poolId: string,
    reviewerId: string,
    availability: ReviewerAvailability
  ): Promise<Reviewer> =>
    apiClient.patch<Reviewer>(
      `/scholarships/reviewer-pools/${poolId}/reviewers/${reviewerId}/availability`,
      { availability }
    ),
};
