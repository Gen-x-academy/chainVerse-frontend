import { apiClient } from '@/src/lib/api-client';
import type { Reviewer } from './reviewer-pool';

export type AssignmentStrategy = 'manual' | 'round-robin' | 'load-balanced' | 'seeded-random';

export type AssignmentStatus = 'pending' | 'active' | 'reassigned' | 'withdrawn';

export type AuditEntry = {
  action: 'assigned' | 'reassigned' | 'withdrawn';
  reviewerId: string;
  reviewerName: string;
  performedBy: string;
  reason: string;
  timestamp: string;
};

export type ApplicationAssignment = {
  id: string;
  applicationId: string;
  reviewerId: string;
  reviewerName: string;
  strategy: AssignmentStrategy;
  seed?: string;
  status: AssignmentStatus;
  assignedAt: string;
  auditLog: AuditEntry[];
};

export type AssignmentResult = {
  applicationId: string;
  reviewerId: string;
  reviewerName: string;
};

function seededHash(seed: string, index: number): number {
  let hash = 0;
  const combined = `${seed}:${index}`;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash) / 2147483647;
}

export function assignRoundRobin(
  applicationIds: string[],
  reviewers: Reviewer[]
): AssignmentResult[] {
  if (reviewers.length === 0) return [];
  return applicationIds.map((applicationId, index) => {
    const reviewer = reviewers[index % reviewers.length];
    return { applicationId, reviewerId: reviewer.id, reviewerName: reviewer.displayName };
  });
}

export function assignLoadBalanced(
  applicationIds: string[],
  reviewers: Reviewer[]
): AssignmentResult[] {
  if (reviewers.length === 0) return [];
  const loads = reviewers.map((r) => r.currentAssignments);
  return applicationIds.map((applicationId) => {
    const minLoad = Math.min(...loads);
    const idx = loads.indexOf(minLoad);
    loads[idx]++;
    const reviewer = reviewers[idx];
    return { applicationId, reviewerId: reviewer.id, reviewerName: reviewer.displayName };
  });
}

export function assignSeededRandom(
  applicationIds: string[],
  reviewers: Reviewer[],
  seed: string
): AssignmentResult[] {
  if (reviewers.length === 0) return [];
  return applicationIds.map((applicationId, index) => {
    const rand = seededHash(seed, index);
    const reviewer = reviewers[Math.floor(rand * reviewers.length)];
    return { applicationId, reviewerId: reviewer.id, reviewerName: reviewer.displayName };
  });
}

export function assignManual(applicationId: string, reviewer: Reviewer): AssignmentResult {
  return { applicationId, reviewerId: reviewer.id, reviewerName: reviewer.displayName };
}

export const fallbackAssignments: ApplicationAssignment[] = [
  {
    id: 'assign-1',
    applicationId: 'app-1',
    reviewerId: 'reviewer-1',
    reviewerName: 'Amara Osei',
    strategy: 'round-robin',
    status: 'active',
    assignedAt: new Date().toISOString(),
    auditLog: [
      {
        action: 'assigned',
        reviewerId: 'reviewer-1',
        reviewerName: 'Amara Osei',
        performedBy: 'system',
        reason: 'Round-robin initial assignment',
        timestamp: new Date().toISOString(),
      },
    ],
  },
];

export const assignmentService = {
  list: (scholarshipId: string): Promise<ApplicationAssignment[]> =>
    apiClient.get<ApplicationAssignment[]>(`/scholarships/${scholarshipId}/assignments`),

  assign: (
    scholarshipId: string,
    applicationId: string,
    reviewerId: string,
    strategy: AssignmentStrategy,
    options?: { seed?: string; reason?: string; performedBy?: string }
  ): Promise<ApplicationAssignment> =>
    apiClient.post<ApplicationAssignment>(`/scholarships/${scholarshipId}/assignments`, {
      applicationId,
      reviewerId,
      strategy,
      seed: options?.seed,
      reason: options?.reason ?? 'Assignment via review panel',
      performedBy: options?.performedBy ?? 'admin',
    }),

  reassign: (
    assignmentId: string,
    reviewerId: string,
    reason: string,
    performedBy: string
  ): Promise<ApplicationAssignment> =>
    apiClient.patch<ApplicationAssignment>(`/scholarships/assignments/${assignmentId}/reassign`, {
      reviewerId,
      reason,
      performedBy,
    }),

  withdraw: (assignmentId: string, reason: string): Promise<ApplicationAssignment> =>
    apiClient.patch<ApplicationAssignment>(`/scholarships/assignments/${assignmentId}/withdraw`, {
      reason,
    }),
};
