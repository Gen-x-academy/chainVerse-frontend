/** MENTOR-038: a match is confirmed only when both mentor and mentee accept. */
export interface MutualMatch {
  proposalId: string;
  mentorId: string;
  menteeId: string;
  mentorResponse?: 'accepted' | 'declined';
  menteeResponse?: 'accepted' | 'declined';
  status: 'pending' | 'confirmed' | 'declined';
  confirmedAt?: string;
}

export function respond(m: MutualMatch, userId: string, accept: boolean, now: Date = new Date()): MutualMatch {
  if (m.status !== 'pending') {
    // Repeating the same answer after resolution is a no-op; contradicting it is an error.
    const prior = userId === m.mentorId ? m.mentorResponse : userId === m.menteeId ? m.menteeResponse : undefined;
    if (prior && (prior === 'accepted') === accept) return m;
    throw new Error('This match has already been resolved');
  }
  const answer = accept ? 'accepted' : 'declined';
  let next: MutualMatch;
  if (userId === m.mentorId) next = { ...m, mentorResponse: answer };
  else if (userId === m.menteeId) next = { ...m, menteeResponse: answer };
  else throw new Error('Only the mentor or mentee can respond');

  if (next.mentorResponse === 'declined' || next.menteeResponse === 'declined') return { ...next, status: 'declined' };
  if (next.mentorResponse === 'accepted' && next.menteeResponse === 'accepted') {
    return { ...next, status: 'confirmed', confirmedAt: now.toISOString() };
  }
  return next;
}

/** Who still needs to answer. */
export function awaitingFrom(m: MutualMatch): string[] {
  if (m.status !== 'pending') return [];
  return [!m.mentorResponse && m.mentorId, !m.menteeResponse && m.menteeId].filter((x): x is string => !!x);
}
