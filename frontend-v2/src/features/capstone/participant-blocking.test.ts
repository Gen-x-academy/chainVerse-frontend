import { describe, expect, it } from "vitest";
import {
  BLOCK_ACTIONS,
  activeBlockBetween,
  authorizeBlock,
  blockActionsFor,
  blockAuditEntry,
  blockedParticipantIds,
  createBlock,
  filterDiscoverable,
  interactionAllowed,
  isBlocked,
  isPreservedRecordKind,
  liftBlock,
  summarizeBlocks,
  validateBlockInput,
  type BlockActor,
  type BlockInput,
  type BlockValidationIssue,
  type ParticipantBlock,
} from "./participant-blocking";

const at = "2026-04-01T09:00:00Z";

const block = (over: Partial<ParticipantBlock> = {}): ParticipantBlock => ({
  id: "blk1",
  organizationId: "org1",
  blockerId: "user1",
  blockedId: "user2",
  reason: "harassment",
  status: "active",
  revision: 1,
  createdAt: at,
  ...over,
});

const input = (over: Partial<BlockInput> = {}): BlockInput => ({
  id: "blk1",
  organizationId: "org1",
  blockerId: "user1",
  blockedId: "user2",
  reason: "harassment",
  now: at,
  ...over,
});

const user1: BlockActor = { id: "user1", role: "participant", organizationId: "org1" };
const user2: BlockActor = { id: "user2", role: "participant", organizationId: "org1" };
const user3: BlockActor = { id: "user3", role: "participant", organizationId: "org1" };
const safety: BlockActor = { id: "safe1", role: "safety_officer", organizationId: "org1" };
const admin: BlockActor = { id: "adm1", role: "organization_admin", organizationId: "org1" };
const auditor: BlockActor = { id: "aud1", role: "auditor", organizationId: "org1" };

const codes = (issues: BlockValidationIssue[]) => issues.map((issue) => issue.code).sort();
const resultCode = (decision: ReturnType<typeof createBlock> | ReturnType<typeof liftBlock>) =>
  decision.ok ? "allowed" : decision.code;

describe("block validation", () => {
  it("accepts a complete block request", () => {
    expect(validateBlockInput(input())).toEqual([]);
  });

  it("requires ids, organization, participants, a reason and a timestamp", () => {
    expect(codes(validateBlockInput(input({ id: " " })))).toEqual(["MISSING_ID"]);
    expect(codes(validateBlockInput(input({ organizationId: "" })))).toEqual(["MISSING_ORGANIZATION"]);
    expect(codes(validateBlockInput(input({ blockerId: "" })))).toEqual(["MISSING_BLOCKER"]);
    expect(codes(validateBlockInput(input({ blockedId: "" })))).toEqual(["MISSING_BLOCKED"]);
    expect(codes(validateBlockInput(input({ reason: "not-a-reason" })))).toEqual(["UNKNOWN_REASON"]);
    expect(codes(validateBlockInput(input({ now: "soon" })))).toEqual(["INVALID_TIMESTAMP"]);
  });

  it("rejects self-blocks and overlong notes", () => {
    expect(codes(validateBlockInput(input({ blockedId: "user1" })))).toEqual(["SELF_BLOCK"]);
    expect(codes(validateBlockInput(input({ note: "x".repeat(501) })))).toEqual(["NOTE_TOO_LONG"]);
  });
});

describe("deny-by-default block authorization", () => {
  const resource = { organizationId: "org1", blockerId: "user1", blockedId: "user2" };
  const allowed = (decision: ReturnType<typeof authorizeBlock>) => (decision.allowed ? "allowed" : decision.reason);

  it("lets participants block, lift and view only their own pair", () => {
    expect(allowed(authorizeBlock(user1, "block.create", resource))).toBe("allowed");
    expect(allowed(authorizeBlock(user2, "block.create", resource))).toBe("NOT_BLOCKER");
    expect(allowed(authorizeBlock(user1, "block.lift", resource))).toBe("allowed");
    expect(allowed(authorizeBlock(user2, "block.lift", resource))).toBe("NOT_BLOCKER");
    expect(allowed(authorizeBlock(user2, "block.view", resource))).toBe("allowed");
    expect(allowed(authorizeBlock(user3, "block.view", resource))).toBe("NOT_PARTICIPANT");
  });

  it("keeps safety officers, administrators and auditors in separate lanes", () => {
    expect(allowed(authorizeBlock(safety, "block.create", resource))).toBe("allowed");
    expect(allowed(authorizeBlock(safety, "block.lift", resource))).toBe("FORBIDDEN_FOR_ROLE");
    expect(allowed(authorizeBlock(admin, "block.lift", resource))).toBe("allowed");
    expect(allowed(authorizeBlock(admin, "block.create", resource))).toBe("FORBIDDEN_FOR_ROLE");
    expect(allowed(authorizeBlock(auditor, "block.create", resource))).toBe("FORBIDDEN_FOR_ROLE");
    expect(allowed(authorizeBlock(auditor, "block.lift", resource))).toBe("FORBIDDEN_FOR_ROLE");
    expect(allowed(authorizeBlock(auditor, "block.audit_view", resource))).toBe("allowed");
  });

  it("enforces the tenant boundary and rejects unknown roles/actions", () => {
    expect(allowed(authorizeBlock({ ...safety, organizationId: "org2" }, "block.view", resource))).toBe("TENANT_MISMATCH");
    expect(authorizeBlock({ id: "x", role: "wizard" as never, organizationId: "org1" }, "block.view", resource)).toEqual({
      allowed: false,
      reason: "UNKNOWN_ROLE",
    });
    expect(authorizeBlock(user1, "block.everything" as never, resource)).toEqual({ allowed: false, reason: "UNKNOWN_ACTION" });
  });

  it("derives navigation actions from the matrix", () => {
    for (const role of ["participant", "safety_officer", "organization_admin", "auditor"] as const) {
      expect(blockActionsFor(role).length).toBeLessThan(BLOCK_ACTIONS.length);
    }
    expect(blockActionsFor("participant")).toEqual(["block.create", "block.lift", "block.view"]);
    expect(blockActionsFor("auditor")).toEqual(["block.audit_view", "block.view"]);
  });
});

describe("creating blocks", () => {
  it("creates one active block and preserves the private note", () => {
    const result = createBlock({ requestId: "c1", actor: user1, input: input({ note: "keep this private" }) }, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.block).toMatchObject({
      id: "blk1",
      organizationId: "org1",
      blockerId: "user1",
      blockedId: "user2",
      reason: "harassment",
      note: "keep this private",
      status: "active",
      revision: 1,
      createdAt: at,
    });
    expect(result.replayed).toBe(false);
  });

  it("replays retries and suppresses duplicate active directions", () => {
    const ledger = new Map();
    const request = { requestId: "c1", actor: user1, input: input() };
    const first = createBlock(request, [], ledger);
    expect(createBlock(request, [], ledger)).toEqual(first.ok ? { ...first, replayed: true } : first);

    const existing = block();
    expect(createBlock({ requestId: "c2", actor: user1, input: input({ id: "blk2" }) }, [existing])).toEqual({
      ok: true,
      block: existing,
      replayed: true,
    });
  });

  it("allows the other direction to block as well", () => {
    const result = createBlock(
      { requestId: "c1", actor: user2, input: input({ id: "blk2", blockerId: "user2", blockedId: "user1" }) },
      [block()],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.block).toMatchObject({ id: "blk2", blockerId: "user2", blockedId: "user1" });
  });

  it("rejects duplicate ids, unauthorized actors, self-blocks and invalid notes", () => {
    expect(createBlock({ requestId: "c1", actor: user1, input: input() }, [block()])).toMatchObject({
      ok: false,
      code: "DUPLICATE_BLOCK_ID",
    });
    expect(
      createBlock({ requestId: "c2", actor: user2, input: input({ id: "blk2" }) }, []),
    ).toMatchObject({ ok: false, code: "NOT_AUTHORIZED", message: expect.stringContaining("NOT_BLOCKER") });
    expect(
      createBlock({ requestId: "c3", actor: user1, input: input({ id: "blk3", blockedId: "user1" }) }, []),
    ).toMatchObject({ ok: false, code: "INVALID_BLOCK", issues: [{ code: "SELF_BLOCK" }] });
    expect(
      createBlock({ requestId: "c4", actor: user1, input: input({ id: "blk4", note: "x".repeat(501) }) }, []),
    ).toMatchObject({ ok: false, code: "INVALID_BLOCK", issues: [{ code: "NOTE_TOO_LONG" }] });
  });

  it("creates a fresh block after the previous one was lifted", () => {
    const lifted = block({ status: "lifted", revision: 2 });
    const result = createBlock({ requestId: "c1", actor: user1, input: input({ id: "blk2" }) }, [lifted]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.block).toMatchObject({ id: "blk2", status: "active", revision: 1 });
  });

  it("reports authorization errors through the result helper", () => {
    expect(resultCode(createBlock({ requestId: "c1", actor: safety, input: input() }, []))).toBe("allowed");
    expect(resultCode(createBlock({ requestId: "c2", actor: admin, input: input({ id: "blk2" }) }, []))).toBe("NOT_AUTHORIZED");
  });
});

describe("lifting blocks", () => {
  it("lets the blocker lift an active block with a revision check", () => {
    const result = liftBlock(block(), { requestId: "l1", actor: user1, expectedRevision: 1, now: "t2" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.block).toMatchObject({ status: "lifted", revision: 2, liftedAt: "t2", liftedBy: "user1" });
  });

  it("replays a retried lift and lets an administrator lift any organization block", () => {
    const ledger = new Map();
    const request = { requestId: "l1", actor: user1, expectedRevision: 1, now: "t2" };
    const first = liftBlock(block(), request, ledger);
    expect(liftBlock(block(), request, ledger)).toEqual(first.ok ? { ...first, replayed: true } : first);
    expect(resultCode(liftBlock(block(), { requestId: "l2", actor: admin, expectedRevision: 1, now: "t2" }))).toBe("allowed");
  });

  it("denies the blocked participant, safety officers and other tenants", () => {
    expect(
      liftBlock(block(), { requestId: "l1", actor: user2, expectedRevision: 1, now: "t" }),
    ).toMatchObject({ ok: false, code: "NOT_AUTHORIZED", message: expect.stringContaining("NOT_BLOCKER") });
    expect(
      liftBlock(block(), { requestId: "l2", actor: safety, expectedRevision: 1, now: "t" }),
    ).toMatchObject({ ok: false, code: "NOT_AUTHORIZED", message: expect.stringContaining("FORBIDDEN_FOR_ROLE") });
    expect(
      liftBlock(block(), { requestId: "l3", actor: { ...admin, organizationId: "org2" }, expectedRevision: 1, now: "t" }),
    ).toMatchObject({ ok: false, code: "NOT_AUTHORIZED", message: expect.stringContaining("TENANT_MISMATCH") });
  });

  it("rejects stale revisions and lifted blocks", () => {
    expect(
      liftBlock(block(), { requestId: "l1", actor: user1, expectedRevision: 9, now: "t" }),
    ).toMatchObject({ ok: false, code: "STALE_REVISION" });
    expect(
      liftBlock(block({ status: "lifted", revision: 2 }), { requestId: "l2", actor: user1, expectedRevision: 2, now: "t" }),
    ).toMatchObject({ ok: false, code: "INVALID_STATE" });
  });
});

describe("bidirectional interaction effects", () => {
  it("applies a block in both directions and only inside its organization", () => {
    const active = block();
    expect(isBlocked([active], "org1", "user1", "user2")).toBe(true);
    expect(isBlocked([active], "org1", "user2", "user1")).toBe(true);
    expect(isBlocked([active], "org2", "user1", "user2")).toBe(false);
    expect(isBlocked([block({ status: "lifted" })], "org1", "user1", "user2")).toBe(false);
    expect(activeBlockBetween([active], "org1", "user2", "user1")).toEqual(active);
  });

  it("lists everyone blocked with a participant in either direction", () => {
    const blocks = [
      block({ id: "b1", blockerId: "user1", blockedId: "user2" }),
      block({ id: "b2", blockerId: "user3", blockedId: "user1" }),
      block({ id: "b3", blockerId: "user1", blockedId: "user4", status: "lifted", revision: 2 }),
      block({ id: "b4", blockerId: "user1", blockedId: "user5", organizationId: "org2" }),
    ];
    expect(blockedParticipantIds(blocks, "org1", "user1")).toEqual(["user2", "user3"]);
    expect(blockedParticipantIds(blocks, "org1", "user2")).toEqual(["user1"]);
  });

  it("filters discovery candidates blocked in either direction", () => {
    const blocks = [block()];
    const candidates = [{ id: "user1" }, { id: "user2" }, { id: "user3" }];
    expect(filterDiscoverable(blocks, "org1", "user1", candidates).map((candidate) => candidate.id)).toEqual(["user1", "user3"]);
    expect(filterDiscoverable(blocks, "org1", "user2", candidates).map((candidate) => candidate.id)).toEqual(["user2", "user3"]);
  });

  it("blocks future interactions but preserves safety, financial and audit records", () => {
    const pushed = interactionAllowed([block()], "org1", "user2", "user1", "messaging");
    expect(pushed).toEqual({ allowed: false, reason: "BLOCKED", preservedRecords: ["safety", "financial", "audit"] });
    for (const kind of ["discovery", "invitation", "matching", "messaging", "collaboration"] as const) {
      expect(interactionAllowed([block()], "org1", "user1", "user2", kind)).toMatchObject({ allowed: false, reason: "BLOCKED" });
    }
    expect(interactionAllowed([block()], "org1", "user1", "user3", "messaging")).toEqual({ allowed: true });
    expect(interactionAllowed([block()], "org1", "user1", "user2", "telepathy")).toEqual({
      allowed: false,
      reason: "UNKNOWN_INTERACTION",
    });
    expect(isPreservedRecordKind("financial")).toBe(true);
    expect(isPreservedRecordKind("messaging")).toBe(false);
  });
});

describe("privacy-safe audit and analytics", () => {
  const privateBlock = block({ note: "private safety detail", reason: "safety" });

  it("audits block status only, never identities, reasons or notes", () => {
    const entry = blockAuditEntry(privateBlock, "block.created", at);
    expect(entry).toEqual({
      eventType: "block.created",
      blockId: "blk1",
      organizationId: "org1",
      status: "active",
      revision: 1,
      at,
    });
    const text = JSON.stringify(entry);
    for (const secret of ["user1", "user2", "safety", "private safety detail"]) {
      expect(text).not.toContain(secret);
    }
  });

  it("suppresses small reason groups and never includes identities or notes", () => {
    const single = summarizeBlocks([privateBlock]);
    expect(single).toEqual({ total: 1, active: 1, lifted: 0, byReason: [], suppressedReasons: 1 });

    const three = summarizeBlocks([privateBlock, privateBlock, privateBlock]);
    expect(three).toEqual({ total: 3, active: 3, lifted: 0, byReason: [{ reason: "safety", count: 3 }], suppressedReasons: 0 });

    const withLifted = summarizeBlocks([privateBlock, block({ status: "lifted", revision: 2 })]);
    expect(withLifted).toMatchObject({ total: 2, active: 1, lifted: 1 });

    const text = JSON.stringify(single);
    for (const secret of ["user1", "user2", "private safety detail"]) {
      expect(text).not.toContain(secret);
    }
  });
});

