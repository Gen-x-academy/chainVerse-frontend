/** MENTOR-034: application review queues with filtering, sorting and reviewer assignment. */
export type ReviewStatus = 'submitted' | 'in_review' | 'needs_info' | 'decided';

export interface QueueApplication {
  id: string;
  programId: string;
  applicantName: string;
  status: ReviewStatus;
  submittedAt: string;
  assignedReviewerId?: string;
}

export interface QueueFilter {
  programId?: string;
  status?: ReviewStatus;
  reviewerId?: string | 'unassigned';
  search?: string;
}

export type QueueSort = 'oldest' | 'newest';

export function filterQueue(items: QueueApplication[], f: QueueFilter): QueueApplication[] {
  const term = f.search?.trim().toLowerCase();
  return items.filter((a) => {
    if (f.programId && a.programId !== f.programId) return false;
    if (f.status && a.status !== f.status) return false;
    if (f.reviewerId === 'unassigned' && a.assignedReviewerId) return false;
    if (f.reviewerId && f.reviewerId !== 'unassigned' && a.assignedReviewerId !== f.reviewerId) return false;
    if (term && !a.applicantName.toLowerCase().includes(term)) return false;
    return true;
  });
}

/** Stable ordering: by submission time, then id. */
export function sortQueue(items: QueueApplication[], sort: QueueSort = 'oldest'): QueueApplication[] {
  const dir = sort === 'oldest' ? 1 : -1;
  return [...items].sort((a, b) => dir * (Date.parse(a.submittedAt) - Date.parse(b.submittedAt)) || a.id.localeCompare(b.id));
}

export function queueCounts(items: QueueApplication[]): Record<ReviewStatus, number> {
  const counts: Record<ReviewStatus, number> = { submitted: 0, in_review: 0, needs_info: 0, decided: 0 };
  for (const a of items) counts[a.status] += 1;
  return counts;
}

/** Claim an application. Idempotent for the same reviewer; refuses to steal another reviewer's claim. */
export function assignReviewer(item: QueueApplication, reviewerId: string): QueueApplication {
  if (item.status === 'decided') throw new Error('Application is already decided');
  if (item.assignedReviewerId && item.assignedReviewerId !== reviewerId) {
    throw new Error('Application is assigned to another reviewer');
  }
  return { ...item, assignedReviewerId: reviewerId, status: item.status === 'submitted' ? 'in_review' : item.status };
}
