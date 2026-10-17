/** MENTOR-091: bidirectional participant blocking across discovery, applications, matching, messaging and booking. */
export const BLOCKED_SURFACES = ['discovery', 'applications', 'matching', 'messaging', 'booking'] as const;
export type InteractionSurface = (typeof BLOCKED_SURFACES)[number];

/** A single direction of a block. Two people are mutually blocked if either direction exists. */
export interface BlockRecord {
  /** The participant who raised the block. */
  blockerId: string;
  /** The participant being blocked. */
  blockedId: string;
  createdAt: string;
  reason?: string;
}

/** Blocks are stored as one direction but always take effect in both. */
export function blockParticipant(
  blocks: BlockRecord[],
  blockerId: string,
  blockedId: string,
  now: Date = new Date(),
  reason?: string,
): BlockRecord[] {
  if (!blockerId || !blockedId) throw new Error('A block needs both participants');
  if (blockerId === blockedId) throw new Error('You cannot block yourself');
  if (blocks.some((b) => b.blockerId === blockerId && b.blockedId === blockedId)) return blocks;
  return [...blocks, { blockerId, blockedId, createdAt: now.toISOString(), reason }];
}

/** Only the participant who raised a block may lift it. */
export function unblockParticipant(blocks: BlockRecord[], blockerId: string, blockedId: string): BlockRecord[] {
  const next = blocks.filter((b) => !(b.blockerId === blockerId && b.blockedId === blockedId));
  if (next.length === blocks.length) throw new Error('No such block to remove');
  return next;
}

/** True when either participant has blocked the other. */
export function isBlocked(blocks: BlockRecord[], a: string, b: string): boolean {
  return blocks.some(
    (record) =>
      (record.blockerId === a && record.blockedId === b) || (record.blockerId === b && record.blockedId === a),
  );
}

/**
 * Deny-by-default authorization. A relationship with a missing or identical participant, or
 * any block in either direction, forbids the interaction; everything else is allowed.
 */
export function isInteractionAllowed(blocks: BlockRecord[], a: string, b: string): boolean {
  if (!a || !b || a === b) return false;
  return !isBlocked(blocks, a, b);
}

/** The surfaces a block suppresses for this pair. Blocks only stop future actions. */
export function blockedSurfaces(blocks: BlockRecord[], a: string, b: string): InteractionSurface[] {
  return isBlocked(blocks, a, b) ? [...BLOCKED_SURFACES] : [];
}

/** Removes anyone in a blocking relationship with the viewer from a candidate list. */
export function filterDiscoverable(blocks: BlockRecord[], viewerId: string, candidateIds: string[]): string[] {
  return candidateIds.filter((id) => id !== viewerId && isInteractionAllowed(blocks, viewerId, id));
}

/** Everyone the given participant has personally blocked. */
export function blockedByParticipant(blocks: BlockRecord[], blockerId: string): string[] {
  return blocks.filter((b) => b.blockerId === blockerId).map((b) => b.blockedId);
}

/** Stable lookup key for a participant pair, ignoring direction. */
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('\u0000');
}
