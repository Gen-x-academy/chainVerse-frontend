/**
 * Pure credential rules for issue MENTOR-012.
 *
 * An approved claim stops counting once its `expiresAt` date has passed, and
 * revoked claims stay revoked. Everything else is terminal state chosen by
 * the reviewer.
 */

import type {
  CredentialClaim,
  CredentialClaimStatus,
} from './types';

/** Resolves the effective status of every claim individually. */
export function resolveCredentialStatuses(
  claims: CredentialClaim[],
  now: Date = new Date()
): Record<string, CredentialClaimStatus> {
  const resolved: Record<string, CredentialClaimStatus> = {};
  for (const claim of claims) {
    resolved[claim.internalId] = resolveOne(claim, now);
  }
  return resolved;
}

function resolveOne(claim: CredentialClaim, now: Date): CredentialClaimStatus {
  if (claim.status === 'revoked') return 'revoked';
  if (claim.status === 'rejected') return 'rejected';
  if (claim.status === 'approved' && claim.expiresAt) {
    const expiresAt = Date.parse(claim.expiresAt);
    if (!Number.isNaN(expiresAt) && expiresAt <= now.getTime()) {
      return 'expired';
    }
  }
  return claim.status;
}
