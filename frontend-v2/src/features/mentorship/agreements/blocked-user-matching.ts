/** MENTOR-044: prevent matching between users with a block relationship in either direction. */
export interface BlockRecord {
  blockerId: string;
  blockedId: string;
  active: boolean;
}

export interface MatchCandidate {
  mentorId: string;
  menteeId: string;
}

export type BlockLookup = Set<string>;

const pair = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Direction-agnostic lookup so a block by either side prevents the match. */
export function buildBlockLookup(blocks: BlockRecord[]): BlockLookup {
  return new Set(blocks.filter((b) => b.active).map((b) => pair(b.blockerId, b.blockedId)));
}

export function isMatchBlocked(lookup: BlockLookup, c: MatchCandidate): boolean {
  return lookup.has(pair(c.mentorId, c.menteeId));
}

/** Removes blocked mentors from a mentee's candidate list without revealing why. */
export function filterBlockedMentors<T extends { id: string }>(lookup: BlockLookup, menteeId: string, mentors: T[]): T[] {
  return mentors.filter((m) => !isMatchBlocked(lookup, { mentorId: m.id, menteeId }));
}

/** Guard for proposals/acceptances; the error is deliberately generic to avoid leaking block state. */
export function assertMatchAllowed(lookup: BlockLookup, c: MatchCandidate): void {
  if (isMatchBlocked(lookup, c)) throw new Error('This match is not available');
}
