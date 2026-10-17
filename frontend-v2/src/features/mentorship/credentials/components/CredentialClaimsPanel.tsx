'use client';

import { useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import { useAuthStore } from '@/src/store/authStore';
import { useCredentialStore } from './store';
import type { CredentialClaim, CredentialDecision } from '../types';
import { CredentialStatusBadge } from './CredentialStatusBadge';

type CredentialReviewAction = (
  claimId: string,
  decision: CredentialDecision,
  reason: string,
  reviewerId: string
) => Promise<CredentialClaim>;

/**
 * Reviewer-facing queue of pending credential claims.
 *
 * Only reviewers and administrators reach this panel; the route checks the
 * same decision client-side before rendering it.
 */
export function CredentialClaimsPanel() {
  const state = useCredentialStore();
  const claims = state.claims;
  const resolved = state.resolvedStatuses;
  const status = state.status;
  const error = state.error;
  const load = state.load;
  const review = state.review;
  const user = useAuthStore((storeState) => storeState.user);

  useEffect(() => {
    void load();
    // Run once per mount; reloads are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reviewerId = user?.id ?? 'unknown';

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <header className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
        <CheckCircle className="h-5 w-5 text-gray-500" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-gray-900">Credential claims</h2>
      </header>
      <div className="p-6">
        {error ? (
          <p role="alert" className="text-sm text-red-600">{error}</p>
        ) : status === 'loading' ? (
          <p className="text-sm text-gray-500">Loading credential claims...</p>
        ) : claims.length === 0 ? (
          <p className="text-sm text-gray-500">No credential claims yet.</p>
        ) : (
          <ul className="space-y-4">
            {claims.map((claim) => (
              <CredentialClaimCard
                key={claim.internalId}
                claim={claim}
                status={resolved[claim.internalId] ?? claim.status}
                review={review}
                reviewerId={reviewerId}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function CredentialClaimCard({
  claim,
  status,
  review,
  reviewerId,
}: {
  claim: CredentialClaim;
  status: string;
  review: CredentialReviewAction;
  reviewerId: string;
}) {
  return (
    <li className="rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-gray-900">
            {claim.credentialType} {claim.credentialRef}
          </p>
          <p className="text-sm text-gray-500">Mentor {claim.mentorId}</p>
        </div>
        <CredentialStatusBadge status={status} />
      </div>
      {status === 'pending' ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            onClick={() =>
              void review(claim.internalId, 'approve', 'Credential verified.', reviewerId)
            }
          >
            Approve
          </button>
          <button
            type="button"
            className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            onClick={() =>
              void review(claim.internalId, 'reject', 'Evidence incomplete.', reviewerId)
            }
          >
            Reject
          </button>
        </div>
      ) : null}
    </li>
  );
}
