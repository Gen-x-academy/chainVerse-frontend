import { apiClient } from '@/src/lib/api-client';
import type { CriterionScore } from './scoring-rubric';

export type ReviewDraft = {
  id: string;
  applicationId: string;
  /** Only the owning reviewer may read or overwrite this draft. */
  reviewerId: string;
  rubricId: string;
  rubricVersion: number;
  scores: CriterionScore[];
  notes: string;
  savedAt: string;
  /** ETag for optimistic concurrency — server rejects writes where etags diverge. */
  etag: string;
};

export type SaveDraftPayload = {
  rubricId: string;
  rubricVersion: number;
  scores: CriterionScore[];
  notes: string;
  /** Must match the server's current etag to prevent lost-update conflicts. */
  etag?: string;
};

export type SaveDraftResult =
  | { ok: true; draft: ReviewDraft }
  | { ok: false; conflict: true; serverDraft: ReviewDraft }
  | { ok: false; conflict: false; error: string };

export function isDraftOwner(draft: ReviewDraft, reviewerId: string): boolean {
  return draft.reviewerId === reviewerId;
}

export function isDraftConflict(localEtag: string, serverEtag: string): boolean {
  return localEtag !== serverEtag;
}

export const reviewDraftService = {
  load: (applicationId: string): Promise<ReviewDraft | null> =>
    apiClient.get<ReviewDraft | null>(
      `/scholarships/applications/${encodeURIComponent(applicationId)}/review-draft`
    ),

  save: (applicationId: string, payload: SaveDraftPayload): Promise<ReviewDraft> =>
    apiClient.put<ReviewDraft>(
      `/scholarships/applications/${encodeURIComponent(applicationId)}/review-draft`,
      payload
    ),

  discard: (applicationId: string): Promise<void> =>
    apiClient.delete<void>(
      `/scholarships/applications/${encodeURIComponent(applicationId)}/review-draft`
    ),
};
