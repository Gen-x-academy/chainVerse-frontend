/**
 * Bidirectional participant blocking (CAPSTONE-103).
 *
 * When one participant blocks another, the restriction applies in both
 * directions for future discovery, invitations, matching, messaging and
 * collaboration. Existing safety, financial and audit records are explicitly
 * preserved and remain readable. Every mutation is deny-by-default,
 * tenant-scoped, guarded by an expected revision and idempotent on its request
 * id. Audit entries and analytics never carry participant identities, reason
 * categories or free-text notes.
 */

export const BLOCK_STATUSES = ["active", "lifted"] as const;
export type BlockStatus = (typeof BLOCK_STATUSES)[number];

export const BLOCK_REASONS = ["harassment", "safety", "fraud", "spam", "conflict_of_interest", "other"] as const;
export type BlockReason = (typeof BLOCK_REASONS)[number];

export const INTERACTION_KINDS = ["discovery", "invitation", "matching", "messaging", "collaboration"] as const;
export type InteractionKind = (typeof INTERACTION_KINDS)[number];

/** Records that must survive a block. */
export const PRESERVED_RECORD_KINDS = ["safety", "financial", "audit"] as const;
export type PreservedRecordKind = (typeof PRESERVED_RECORD_KINDS)[number];

export const MAX_NOTE_LENGTH = 500;
export const ANALYTICS_MIN_GROUP = 3;

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export const isBlockStatus = (value: unknown): value is BlockStatus =>
  typeof value === "string" && (BLOCK_STATUSES as readonly string[]).includes(value);

export const isBlockReason = (value: unknown): value is BlockReason =>
  typeof value === "string" && (BLOCK_REASONS as readonly string[]).includes(value);

export const isInteractionKind = (value: unknown): value is InteractionKind =>
  typeof value === "string" && (INTERACTION_KINDS as readonly string[]).includes(value);

export const isPreservedRecordKind = (value: unknown): value is PreservedRecordKind =>
  typeof value === "string" && (PRESERVED_RECORD_KINDS as readonly string[]).includes(value);

export interface ParticipantBlock {
  id: string;
  organizationId: string;
  blockerId: string;
  blockedId: string;
  reason: BlockReason;
  /** Private free text; never copied into audit entries or analytics. */
  note?: string;
  status: BlockStatus;
  /** Increases by one when the block is lifted. */
  revision: number;
  createdAt: string;
  liftedAt?: string;
  liftedBy?: string;
}

export interface BlockInput {
  id: string;
  organizationId: string;
  blockerId: string;
  blockedId: string;
  reason: string;
  note?: string;
  now: string;
}

export interface BlockValidationIssue {
  field: string;
  code: string;
  message: string;
}

/** Problems with a new block request, or an empty list when it is valid. */
export function validateBlockInput(input: BlockInput): BlockValidationIssue[] {
  const issues: BlockValidationIssue[] = [];
  const bad = (field: string, code: string, message: string) => issues.push({ field, code, message });

  if (input.id.trim().length === 0) bad("id", "MISSING_ID", "give the block an id");
  if (input.organizationId.trim().length === 0) bad("organizationId", "MISSING_ORGANIZATION", "the block needs an organization");
  if (input.blockerId.trim().length === 0) bad("blockerId", "MISSING_BLOCKER", "name the blocking participant");
  if (input.blockedId.trim().length === 0) bad("blockedId", "MISSING_BLOCKED", "name the blocked participant");
  if (input.blockerId === input.blockedId) bad("blockedId", "SELF_BLOCK", "a participant cannot block themselves");
  if (!isBlockReason(input.reason)) bad("reason", "UNKNOWN_REASON", "choose a recognised block reason");
  if (input.note !== undefined && input.note.length > MAX_NOTE_LENGTH) {
    bad("note", "NOTE_TOO_LONG", `a note can be at most ${MAX_NOTE_LENGTH} characters`);
  }
  if (!ISO_INSTANT.test(input.now)) bad("now", "INVALID_TIMESTAMP", "use an ISO 8601 UTC instant");

  return issues;
}

export const BLOCK_ACTOR_ROLES = ["participant", "safety_officer", "organization_admin", "auditor"] as const;
export type BlockActorRole = (typeof BLOCK_ACTOR_ROLES)[number];

export const BLOCK_ACTIONS = ["block.create", "block.lift", "block.view", "block.audit_view"] as const;
export type BlockAction = (typeof BLOCK_ACTIONS)[number];

export const BLOCK_SCOPES = ["own", "organization"] as const;
export type BlockScope = (typeof BLOCK_SCOPES)[number];

export const BLOCK_PERMISSIONS: Readonly<Record<BlockActorRole, Partial<Record<BlockAction, BlockScope>>>> = {
  participant: {
    "block.create": "own",
    "block.lift": "own",
    "block.view": "own",
  },
  safety_officer: {
    "block.create": "organization",
    "block.view": "organization",
    "block.audit_view": "organization",
  },
  organization_admin: {
    "block.lift": "organization",
    "block.view": "organization",
    "block.audit_view": "organization",
  },
  auditor: {
    "block.view": "organization",
    "block.audit_view": "organization",
  },
};

/** Actions a role may never perform, even if a future grant lists them (separation of duties). */
export const BLOCK_FORBIDDEN: Readonly<Partial<Record<BlockActorRole, readonly BlockAction[]>>> = {
  participant: ["block.audit_view"],
  safety_officer: ["block.lift"],
  organization_admin: ["block.create"],
  auditor: ["block.create", "block.lift"],
};

export interface BlockActor {
  id: string;
  role: BlockActorRole;
  organizationId: string;
}

export interface BlockResource {
  organizationId: string;
  blockerId: string;
  blockedId?: string;
}

export type BlockAuthorizationReason =
  | "UNKNOWN_ROLE"
  | "UNKNOWN_ACTION"
  | "FORBIDDEN_FOR_ROLE"
  | "NOT_GRANTED"
  | "TENANT_MISMATCH"
  | "NOT_BLOCKER"
  | "NOT_PARTICIPANT";

export type BlockAuthorizationDecision = { allowed: true } | { allowed: false; reason: BlockAuthorizationReason };

/** Deny-by-default authorization with tenant and participant boundaries. */
export function authorizeBlock(actor: BlockActor, action: BlockAction, resource: BlockResource): BlockAuthorizationDecision {
  if (!(BLOCK_ACTOR_ROLES as readonly string[]).includes(actor.role)) return { allowed: false, reason: "UNKNOWN_ROLE" };
  if (!(BLOCK_ACTIONS as readonly string[]).includes(action)) return { allowed: false, reason: "UNKNOWN_ACTION" };
  if (BLOCK_FORBIDDEN[actor.role]?.includes(action)) return { allowed: false, reason: "FORBIDDEN_FOR_ROLE" };

  const scope = BLOCK_PERMISSIONS[actor.role][action];
  if (scope === undefined) return { allowed: false, reason: "NOT_GRANTED" };

  if (actor.organizationId !== resource.organizationId) return { allowed: false, reason: "TENANT_MISMATCH" };
  if (scope === "organization") return { allowed: true };

  if (action === "block.view") {
    return actor.id === resource.blockerId || actor.id === resource.blockedId
      ? { allowed: true }
      : { allowed: false, reason: "NOT_PARTICIPANT" };
  }
  return actor.id === resource.blockerId ? { allowed: true } : { allowed: false, reason: "NOT_BLOCKER" };
}

export function blockActionsFor(role: BlockActorRole): BlockAction[] {
  return (Object.keys(BLOCK_PERMISSIONS[role]) as BlockAction[])
    .filter((action) => !BLOCK_FORBIDDEN[role]?.includes(action))
    .sort();
}

const resourceOfInput = (input: BlockInput): BlockResource => ({
  organizationId: input.organizationId,
  blockerId: input.blockerId,
  blockedId: input.blockedId,
});

const resourceOfBlock = (block: ParticipantBlock): BlockResource => ({
  organizationId: block.organizationId,
  blockerId: block.blockerId,
  blockedId: block.blockedId,
});

export type CreateBlockErrorCode = "NOT_AUTHORIZED" | "INVALID_BLOCK" | "DUPLICATE_BLOCK_ID";

export type CreateBlockResult =
  | { ok: true; block: ParticipantBlock; replayed: boolean }
  | { ok: false; code: CreateBlockErrorCode; message: string; issues?: BlockValidationIssue[] };

export type CreateBlockLedger = Map<string, CreateBlockResult>;

export interface CreateBlockRequest {
  /** Client-generated id; a retry with the same id is not applied again. */
  requestId: string;
  actor: BlockActor;
  input: BlockInput;
}

export function createBlock(
  request: CreateBlockRequest,
  existing: readonly ParticipantBlock[],
  ledger: CreateBlockLedger = new Map(),
): CreateBlockResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;

  const store = (result: CreateBlockResult): CreateBlockResult => {
    ledger.set(request.requestId, result);
    return result;
  };
  const fail = (code: CreateBlockErrorCode, message: string, issues?: BlockValidationIssue[]): CreateBlockResult =>
    store({ ok: false, code, message, ...(issues ? { issues } : {}) });

  const decision = authorizeBlock(request.actor, "block.create", resourceOfInput(request.input));
  if (!decision.allowed) return fail("NOT_AUTHORIZED", `You cannot create this block (${decision.reason}).`);

  const issues = validateBlockInput(request.input);
  if (issues.length > 0) return fail("INVALID_BLOCK", "The block needs changes before it can be created.", issues);

  if (existing.some((block) => block.id === request.input.id)) {
    return fail("DUPLICATE_BLOCK_ID", "A block with this id already exists.");
  }

  // A retry with a different request id still returns the live block instead of
  // creating a second active record for the same direction.
  const duplicate = existing.find(
    (block) =>
      block.status === "active" &&
      block.organizationId === request.input.organizationId &&
      block.blockerId === request.input.blockerId &&
      block.blockedId === request.input.blockedId,
  );
  if (duplicate) return store({ ok: true, block: duplicate, replayed: true });

  const input = request.input;
  return store({
    ok: true,
    replayed: false,
    block: {
      id: input.id,
      organizationId: input.organizationId,
      blockerId: input.blockerId,
      blockedId: input.blockedId,
      reason: input.reason as BlockReason,
      status: "active",
      revision: 1,
      createdAt: input.now,
      ...(input.note !== undefined ? { note: input.note } : {}),
    },
  });
}

export type LiftBlockErrorCode = "NOT_AUTHORIZED" | "STALE_REVISION" | "INVALID_STATE";

export type LiftBlockResult =
  | { ok: true; block: ParticipantBlock; replayed: boolean }
  | { ok: false; code: LiftBlockErrorCode; message: string };

export type LiftBlockLedger = Map<string, LiftBlockResult>;

export interface LiftBlockRequest {
  requestId: string;
  actor: BlockActor;
  expectedRevision: number;
  now: string;
}

export function liftBlock(
  block: ParticipantBlock,
  request: LiftBlockRequest,
  ledger: LiftBlockLedger = new Map(),
): LiftBlockResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;

  const store = (result: LiftBlockResult): LiftBlockResult => {
    ledger.set(request.requestId, result);
    return result;
  };
  const fail = (code: LiftBlockErrorCode, message: string): LiftBlockResult => store({ ok: false, code, message });

  const decision = authorizeBlock(request.actor, "block.lift", resourceOfBlock(block));
  if (!decision.allowed) return fail("NOT_AUTHORIZED", `You cannot lift this block (${decision.reason}).`);
  if (request.expectedRevision !== block.revision) {
    return fail("STALE_REVISION", `The block changed (revision ${block.revision}); reload before retrying.`);
  }
  if (block.status !== "active") return fail("INVALID_STATE", "Only an active block can be lifted.");

  return store({
    ok: true,
    replayed: false,
    block: {
      ...block,
      status: "lifted",
      revision: block.revision + 1,
      liftedAt: request.now,
      liftedBy: request.actor.id,
    },
  });
}

/** The active block between two participants in either direction, if one exists. */
export function activeBlockBetween(
  blocks: readonly ParticipantBlock[],
  organizationId: string,
  firstId: string,
  secondId: string,
): ParticipantBlock | null {
  return (
    blocks.find(
      (block) =>
        block.status === "active" &&
        block.organizationId === organizationId &&
        ((block.blockerId === firstId && block.blockedId === secondId) ||
          (block.blockerId === secondId && block.blockedId === firstId)),
    ) ?? null
  );
}

/** Blocking is bidirectional for effects: either direction makes the pair blocked. */
export function isBlocked(
  blocks: readonly ParticipantBlock[],
  organizationId: string,
  firstId: string,
  secondId: string,
): boolean {
  return activeBlockBetween(blocks, organizationId, firstId, secondId) !== null;
}

/** Everyone who is blocked with `participantId` in either direction. */
export function blockedParticipantIds(
  blocks: readonly ParticipantBlock[],
  organizationId: string,
  participantId: string,
): string[] {
  const ids = new Set<string>();
  for (const block of blocks) {
    if (block.status !== "active" || block.organizationId !== organizationId) continue;
    if (block.blockerId === participantId) ids.add(block.blockedId);
    else if (block.blockedId === participantId) ids.add(block.blockerId);
  }
  return [...ids].sort();
}

/** Remove participants blocked in either direction from a discovery candidate list. */
export function filterDiscoverable<T extends { id: string }>(
  blocks: readonly ParticipantBlock[],
  organizationId: string,
  viewerId: string,
  candidates: readonly T[],
): T[] {
  const blocked = new Set(blockedParticipantIds(blocks, organizationId, viewerId));
  return candidates.filter((candidate) => candidate.id === viewerId || !blocked.has(candidate.id));
}

export type InteractionDecision =
  | { allowed: true }
  | { allowed: false; reason: "BLOCKED"; preservedRecords: PreservedRecordKind[] }
  | { allowed: false; reason: "UNKNOWN_INTERACTION" };

/**
 * Check a future interaction. A block removes discovery, invitations,
 * matching, messaging and collaboration, but keeps safety, financial and audit
 * records available.
 */
export function interactionAllowed(
  blocks: readonly ParticipantBlock[],
  organizationId: string,
  actorId: string,
  targetId: string,
  kind: string,
): InteractionDecision {
  if (!isInteractionKind(kind)) return { allowed: false, reason: "UNKNOWN_INTERACTION" };
  if (isBlocked(blocks, organizationId, actorId, targetId)) {
    return { allowed: false, reason: "BLOCKED", preservedRecords: [...PRESERVED_RECORD_KINDS] };
  }
  return { allowed: true };
}

export interface BlockAuditEntry {
  eventType: string;
  blockId: string;
  organizationId: string;
  status: BlockStatus;
  revision: number;
  at: string;
}

/**
 * A privacy-safe audit entry. It deliberately omits both participant ids, the
 * reason category and any free-text note.
 */
export function blockAuditEntry(block: ParticipantBlock, eventType: string, at: string): BlockAuditEntry {
  return {
    eventType,
    blockId: block.id,
    organizationId: block.organizationId,
    status: block.status,
    revision: block.revision,
    at,
  };
}

export interface BlockAnalyticsSummary {
  total: number;
  active: number;
  lifted: number;
  byReason: Array<{ reason: BlockReason; count: number }>;
  suppressedReasons: number;
}

/** Aggregate active-block counts by reason with small groups suppressed. */
export function summarizeBlocks(
  blocks: readonly ParticipantBlock[],
  minGroupSize: number = ANALYTICS_MIN_GROUP,
): BlockAnalyticsSummary {
  const reasonCounts = new Map<BlockReason, number>();
  let active = 0;
  for (const block of blocks) {
    if (block.status !== "active") continue;
    active += 1;
    reasonCounts.set(block.reason, (reasonCounts.get(block.reason) ?? 0) + 1);
  }

  const threshold = Math.max(1, minGroupSize);
  const byReason: BlockAnalyticsSummary["byReason"] = [];
  let suppressedReasons = 0;
  for (const reason of BLOCK_REASONS) {
    const count = reasonCounts.get(reason) ?? 0;
    if (count === 0) continue;
    if (count < threshold) suppressedReasons += 1;
    else byReason.push({ reason, count });
  }

  return { total: blocks.length, active, lifted: blocks.length - active, byReason, suppressedReasons };
}
