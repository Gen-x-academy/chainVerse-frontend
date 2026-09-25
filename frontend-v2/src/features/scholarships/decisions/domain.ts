/**
 * Committee decision domain logic (issue #1109).
 *
 * Quorum and role rules:
 *  - Only 'chair' and 'member' roles may cast votes.
 *  - 'observer' roles may not vote.
 *  - A recused member cannot vote.
 *  - A member may not vote twice.
 *  - Quorum = minVotes non-recused votes; if requireChairVote the chair must be
 *    present among votes.
 *
 * Final decision: majority wins. On a tie the chair's vote is the tiebreaker.
 * If the chair did not vote, ties are broken by ascending DecisionType string
 * value (deterministic and documented).
 *
 * Evidence version: every vote must reference the aggregateVersion on the
 * CommitteeDecision — this binds each vote to an immutable evidence snapshot.
 */

import type {
  CommitteeDecision,
  CommitteeMember,
  VoteRecord,
  QuorumPolicy,
  DecisionType,
  CommitteeDecisionValidationError,
} from './types';

export function canVote(
  decision: CommitteeDecision,
  memberId: string
): { allowed: boolean; reason?: string } {
  const member = decision.committee.find((m) => m.userId === memberId);
  if (!member) return { allowed: false, reason: 'Member is not part of this committee.' };
  if (member.role === 'observer')
    return { allowed: false, reason: 'Observers may not cast votes.' };
  if (decision.recusals.some((r) => r.memberId === memberId))
    return { allowed: false, reason: 'Recused members may not vote.' };
  if (decision.votes.some((v) => v.memberId === memberId))
    return { allowed: false, reason: 'Member has already voted.' };
  if (decision.status === 'decided' || decision.status === 'voided')
    return { allowed: false, reason: 'Decision is closed.' };
  return { allowed: true };
}

export function canRecuse(
  decision: CommitteeDecision,
  memberId: string
): { allowed: boolean; reason?: string } {
  const member = decision.committee.find((m) => m.userId === memberId);
  if (!member) return { allowed: false, reason: 'Member is not part of this committee.' };
  if (decision.votes.some((v) => v.memberId === memberId))
    return { allowed: false, reason: 'Cannot recuse after casting a vote.' };
  if (decision.recusals.some((r) => r.memberId === memberId))
    return { allowed: false, reason: 'Member has already recused.' };
  if (decision.status === 'decided' || decision.status === 'voided')
    return { allowed: false, reason: 'Decision is closed.' };
  return { allowed: true };
}

export function hasQuorum(decision: CommitteeDecision, policy: QuorumPolicy): boolean {
  const votedMemberIds = new Set(decision.votes.map((v) => v.memberId));
  const activeVotes = decision.votes.filter(
    (v) => !decision.recusals.some((r) => r.memberId === v.memberId)
  );
  if (activeVotes.length < policy.minVotes) return false;
  if (policy.requireChairVote) {
    const chair = decision.committee.find((m) => m.role === 'chair');
    if (chair && !votedMemberIds.has(chair.userId)) return false;
  }
  return true;
}

export function computeFinalDecision(
  votes: VoteRecord[],
  committee: CommitteeMember[]
): DecisionType {
  const tally = new Map<DecisionType, number>();
  for (const vote of votes) {
    tally.set(vote.decision, (tally.get(vote.decision) ?? 0) + 1);
  }

  const maxCount = Math.max(...tally.values());
  const leaders = ([...tally.entries()] as [DecisionType, number][])
    .filter(([, count]) => count === maxCount)
    .map(([d]) => d);

  if (leaders.length === 1) return leaders[0];

  const chair = committee.find((m) => m.role === 'chair');
  if (chair) {
    const chairVote = votes.find((v) => v.memberId === chair.userId);
    if (chairVote && leaders.includes(chairVote.decision)) return chairVote.decision;
  }

  return [...leaders].sort()[0];
}

export function validateVote(
  vote: { rationale: string; evidenceVersion: string },
  decision: CommitteeDecision
): CommitteeDecisionValidationError[] {
  const errors: CommitteeDecisionValidationError[] = [];
  if (!vote.rationale.trim()) {
    errors.push({ field: 'rationale', message: 'A rationale is required for every vote.' });
  }
  if (vote.evidenceVersion !== decision.aggregateVersion) {
    errors.push({
      field: 'evidenceVersion',
      message: `Vote references evidence version "${vote.evidenceVersion}" but the decision uses "${decision.aggregateVersion}".`,
    });
  }
  return errors;
}

export function activeVoters(decision: CommitteeDecision): CommitteeMember[] {
  const recusedIds = new Set(decision.recusals.map((r) => r.memberId));
  return decision.committee.filter(
    (m) => m.role !== 'observer' && !recusedIds.has(m.userId)
  );
}
