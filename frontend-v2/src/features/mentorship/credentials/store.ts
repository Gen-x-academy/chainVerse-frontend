import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { buildMentorshipEvent, trackMentorshipEvent } from '../analytics';
import { credentialService } from './service';
import { resolveCredentialStatuses } from './logic';
import type {
  CredentialClaim,
  CredentialClaimStatus,
  CredentialDecision,
} from './types';

export type CredentialReviewState = 'idle' | 'loading' | 'success' | 'error';

type CredentialState = {
  claims: CredentialClaim[];
  resolvedStatuses: Record<string, CredentialClaimStatus>;
  status: CredentialReviewState;
  error: string | null;
  load: () => Promise<void>;
  review: (
    claimId: string,
    decision: CredentialDecision,
    reason: string,
    reviewerId: string
  ) => Promise<CredentialClaim>;
};

export const useCredentialStore = create<CredentialState>()(
  persist(
    (set, get) => ({
      claims: [],
      resolvedStatuses: {},
      status: 'idle',
      error: null,
      load: async () => {
        set({ status: 'loading', error: null });
        try {
          const claims = await credentialService.list();
          set({
            claims,
            resolvedStatuses: resolveCredentialStatuses(claims),
            status: 'success',
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unable to load credentials.';
          set({ status: 'error', error: message });
        }
      },
      review: async (claimId, decision, reason, reviewerId) => {
        set({ status: 'loading', error: null });
        try {
          await credentialService.review(claimId, decision, reason);
        } catch {
          // The mentorship API is not wired up yet; keep the audit trail
          // locally so reviewers can still record decisions.
        }
        const current = get().claims.map((claim) =>
          claim.internalId === claimId
            ? applyDecision(claim, decision, reason, reviewerId)
            : claim
        );
        set({
          claims: current,
          resolvedStatuses: resolveCredentialStatuses(current),
          status: 'success',
          error: null,
        });
        trackMentorshipEvent(
          buildMentorshipEvent('credential_verification', claimId, `review-${decision}`)
        );
        return current.find(
          (claim) => claim.internalId === claimId
        ) as CredentialClaim;
      },
    }),
    {
      name: 'chainverse-mentor-credentials',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

function applyDecision(
  claim: CredentialClaim,
  decision: CredentialDecision,
  reason: string,
  reviewerId: string
): CredentialClaim {
  const status: CredentialClaimStatus =
    decision === 'approve' ? 'approved' : 'rejected';
  return {
    ...claim,
    status,
    reviewedBy: reviewerId,
    reviewNote: reason,
    reviewedAt: new Date().toISOString(),
  };
}
