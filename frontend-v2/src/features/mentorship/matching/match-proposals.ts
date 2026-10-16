/** MENTOR-037: create mentor match proposals with expiry and duplicate protection. */
export type ProposalStatus = 'proposed' | 'accepted' | 'declined' | 'expired' | 'withdrawn';

export interface MatchProposal {
  id: string;
  programId: string;
  mentorId: string;
  menteeId: string;
  proposedBy: string;
  rationale: string;
  status: ProposalStatus;
  createdAt: string;
  expiresAt: string;
}

export const PROPOSAL_TTL_DAYS = 7;
const OPEN: ProposalStatus[] = ['proposed'];

export function createProposal(
  existing: MatchProposal[],
  input: Pick<MatchProposal, 'programId' | 'mentorId' | 'menteeId' | 'proposedBy' | 'rationale'>,
  now: Date = new Date(),
): MatchProposal[] {
  if (input.mentorId === input.menteeId) throw new Error('Mentor and mentee must be different people');
  if (!input.rationale.trim()) throw new Error('Add a short rationale for this match');
  const duplicate = existing.some(
    (p) =>
      p.programId === input.programId &&
      p.mentorId === input.mentorId &&
      p.menteeId === input.menteeId &&
      OPEN.includes(effectiveStatus(p, now)),
  );
  if (duplicate) return existing;
  const proposal: MatchProposal = {
    ...input,
    id: `${input.programId}:${input.mentorId}:${input.menteeId}:${existing.length + 1}`,
    status: 'proposed',
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + PROPOSAL_TTL_DAYS * 86_400_000).toISOString(),
  };
  return [...existing, proposal];
}

/** Status as of `now`: an unanswered proposal past its expiry reads as expired. */
export function effectiveStatus(p: MatchProposal, now: Date = new Date()): ProposalStatus {
  return p.status === 'proposed' && Date.parse(p.expiresAt) < now.getTime() ? 'expired' : p.status;
}

export function withdrawProposal(p: MatchProposal, actorId: string, now: Date = new Date()): MatchProposal {
  if (p.proposedBy !== actorId) throw new Error('Only the proposer can withdraw this proposal');
  if (effectiveStatus(p, now) !== 'proposed') return p;
  return { ...p, status: 'withdrawn' };
}

/** Open proposals involving a given user, soonest-expiring first. */
export const openProposalsFor = (all: MatchProposal[], userId: string, now: Date = new Date()): MatchProposal[] =>
  all
    .filter((p) => (p.mentorId === userId || p.menteeId === userId) && effectiveStatus(p, now) === 'proposed')
    .sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt) || a.id.localeCompare(b.id));
