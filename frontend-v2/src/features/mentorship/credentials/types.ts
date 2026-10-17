/** Credential verification for issue MENTOR-012. */

/** State of a mentor credential claim. */
export type CredentialClaimStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'revoked';

/** Decisions a reviewer can take on a pending claim. */
export type CredentialDecision = 'approve' | 'reject';

export interface CredentialClaim {
  /** Relational key used by the API; never exposed in public endpoints. */
  internalId: string;
  /** Stable, collision-resistant identifier that is safe to expose. */
  publicId: string;
  /** Correlation identifier used to group retries and event logs. */
  correlationId: string;
  mentorId: string;
  /** Kind of credential, for example `certificate` or `employment`. */
  credentialType: string;
  /** Reference of the verified credential. */
  credentialRef: string;
  status: CredentialClaimStatus;
  /** ISO 8601 date at which an approved claim stops counting. */
  expiresAt?: string;
  submittedBy: string;
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  /** Required when the reviewer rejects a claim. */
  reviewNote?: string;
  /** Evidence documents referenced by the claim; access stays restricted. */
  evidence: string[];
  createdAt: string;
}

export interface CredentialReview {
  claimId: string;
  decision: CredentialDecision;
  reason?: string;
  reviewerId: string;
  reviewedAt: string;
}
