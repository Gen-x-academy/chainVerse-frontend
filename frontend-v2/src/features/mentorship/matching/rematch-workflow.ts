/** MENTOR-042: rematch workflow when a mentorship ends early or breaks down. */
export type RematchReason = 'mentor_unavailable' | 'mentee_request' | 'poor_fit' | 'conflict' | 'other';
export type RematchStatus = 'requested' | 'approved' | 'declined' | 'matched' | 'cancelled';

export interface RematchRequest {
  id: string;
  engagementId: string;
  menteeId: string;
  previousMentorId: string;
  reason: RematchReason;
  note?: string;
  status: RematchStatus;
  /** Mentors the mentee must not be matched with again. */
  excludedMentorIds: string[];
  requestedAt: string;
}

const TRANSITIONS: Record<RematchStatus, RematchStatus[]> = {
  requested: ['approved', 'declined', 'cancelled'],
  approved: ['matched', 'cancelled'],
  declined: [],
  matched: [],
  cancelled: [],
};

export function requestRematch(
  input: Pick<RematchRequest, 'engagementId' | 'menteeId' | 'previousMentorId' | 'reason' | 'note'>,
  now: Date = new Date(),
): RematchRequest {
  if (input.reason === 'other' && !input.note?.trim()) throw new Error('Please explain your reason');
  return {
    ...input,
    id: `${input.engagementId}:rematch`,
    status: 'requested',
    excludedMentorIds: [input.previousMentorId],
    requestedAt: now.toISOString(),
  };
}

export function advanceRematch(r: RematchRequest, next: RematchStatus): RematchRequest {
  if (r.status === next) return r;
  if (!TRANSITIONS[r.status].includes(next)) throw new Error(`Cannot move rematch from ${r.status} to ${next}`);
  return { ...r, status: next };
}

/** Drops excluded mentors from the candidate pool. */
export function eligibleReplacements<T extends { id: string }>(r: RematchRequest, candidates: T[]): T[] {
  return candidates.filter((m) => !r.excludedMentorIds.includes(m.id));
}

export const isRematchOpen = (r: RematchRequest): boolean => r.status === 'requested' || r.status === 'approved';
