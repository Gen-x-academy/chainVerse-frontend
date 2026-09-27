export type DecisionType = 'shortlist' | 'waitlist' | 'award' | 'reject' | 'recusal';

export type CommitteeRole = 'chair' | 'member' | 'observer';

export type DecisionStatus = 'pending' | 'in_progress' | 'quorum_met' | 'decided' | 'voided';

export type CommitteeMember = {
  userId: string;
  role: CommitteeRole;
  name: string;
};

/** A cast vote; references the exact evidence version the member reviewed. */
export type VoteRecord = {
  memberId: string;
  decision: DecisionType;
  rationale: string;
  /** Version token from the review aggregate the member reviewed before voting. */
  evidenceVersion: string;
  votedAt: string;
};

export type RecusalRecord = {
  memberId: string;
  reason: string;
  recusedAt: string;
};

export type QuorumPolicy = {
  /** Minimum non-recused votes required for quorum. */
  minVotes: number;
  /** When true the chair's vote must be present for quorum. */
  requireChairVote: boolean;
};

export type CommitteeDecision = {
  id: string;
  applicationId: string;
  /** Version of the review aggregate this decision references. */
  aggregateVersion: string;
  committee: CommitteeMember[];
  votes: VoteRecord[];
  recusals: RecusalRecord[];
  quorumPolicy: QuorumPolicy;
  status: DecisionStatus;
  finalDecision?: DecisionType;
  decidedAt?: string;
  createdAt: string;
};

export type CastVotePayload = {
  committeeDecisionId: string;
  memberId: string;
  decision: DecisionType;
  rationale: string;
  evidenceVersion: string;
};

export type RecusePayload = {
  committeeDecisionId: string;
  memberId: string;
  reason: string;
};

export type CommitteeDecisionValidationError = {
  field: string;
  message: string;
};
