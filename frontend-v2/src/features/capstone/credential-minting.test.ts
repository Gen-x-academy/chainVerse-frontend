import { describe, expect, it } from "vitest";
import {
  completionSatisfied,
  credentialAudit,
  mintCredential,
  revokeCredential,
  type CompletionRules,
  type MintRequest,
} from "./credential-minting";

const SUBJECT = "sub_0123456789ABCDEG";
const completion = (over: Partial<CompletionRules> = {}): CompletionRules => ({
  state: "completed",
  revision: 3,
  requiredMilestones: ["mil_1"],
  acceptedMilestones: ["mil_1"],
  requiredCriteria: ["c1"],
  acceptedCriteria: ["c1"],
  withinWindow: true,
  ...over,
});
const request = (over: Partial<MintRequest> = {}): MintRequest => ({
  requestId: "req-1",
  actor: { id: "staff-1", role: "organization_staff", organizationId: "org-1" },
  project: { id: "prj_1", organizationId: "org-1", completion: completion() },
  subject: { reference: SUBJECT, role: "contributor", approval: "approved", approvedBy: "sup-1" },
  issuerId: "staff-1",
  now: "2026-11-20T00:00:00.000Z",
  ...over,
});

describe("credential minting (CAPSTONE-094)", () => {
  it("mints a privacy-safe credential after completion and approval pass", async () => {
    const result = await mintCredential(request());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.credential).toMatchObject({ projectId: "prj_1", subjectReference: SUBJECT, role: "contributor" });
    expect(result.credential.integrity.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(result.credential)).not.toMatch(/email|proposal|reviewerIdentity/i);
  });

  it("requires completion rules and an explicit approval", async () => {
    const r = request();
    expect(completionSatisfied({ ...r.project.completion, state: "active" })).toBe(false);
    expect(completionSatisfied({ ...r.project.completion, acceptedMilestones: [] })).toBe(false);
    expect(completionSatisfied({ ...r.project.completion, acceptedCriteria: [] })).toBe(false);
    expect(completionSatisfied({ ...r.project.completion, withinWindow: false })).toBe(false);
    expect(await mintCredential(request({ subject: { ...r.subject, approval: "pending" } }))).toMatchObject({ ok: false, code: "APPROVAL_MISSING" });
    expect(await mintCredential(request({ subject: { ...r.subject, approvedBy: undefined } }))).toMatchObject({ ok: false, code: "APPROVAL_MISSING" });
  });

  it("denies unknown roles, other tenants, stale state and bad subject data", async () => {
    const r = request();
    expect(await mintCredential(request({ actor: { ...r.actor, role: "student" } }))).toMatchObject({ ok: false, code: "UNKNOWN_ROLE" });
    expect(await mintCredential(request({ actor: { ...r.actor, organizationId: "org-2" } }))).toMatchObject({ ok: false, code: "NOT_PERMITTED" });
    expect(await mintCredential(request({ project: { ...r.project, completion: completion({ revision: 0 }) } }))).toMatchObject({ ok: false, code: "STALE_REVISION" });
    expect(await mintCredential(request({ subject: { ...r.subject, reference: "u1@example.com" } }))).toMatchObject({ ok: false, code: "INVALID_SUBJECT" });
    expect(await mintCredential(request({ subject: { ...r.subject, role: "minter" } }))).toMatchObject({ ok: false, code: "INVALID_ROLE" });
    expect(await mintCredential(request({ project: { ...r.project, organizationId: "org-2" }, actor: { ...r.actor, role: "administrator", organizationId: "org-1" } }))).toMatchObject({ ok: false, code: "TENANT_MISMATCH" });
  });

  it("cannot duplicate a credential via retries or new request ids", async () => {
    const ledger = new Map();
    const index = new Set();
    const first = await mintCredential(request(), ledger, index);
    const retry = await mintCredential(request(), ledger, index);
    const duplicate = await mintCredential(request({ requestId: "req-2" }), ledger, index);
    expect(first.ok && retry.ok && retry.replayed).toBe(true);
    expect(first.ok && retry.ok && first.credential === retry.credential).toBe(true);
    expect(duplicate).toMatchObject({ ok: false, code: "ALREADY_MINTED" });
  });

  it("revokes idempotently, only by the issuer, with a privacy-safe audit", async () => {
    const minted = await mintCredential(request());
    expect(minted.ok).toBe(true);
    if (!minted.ok) return;
    const stranger = revokeCredential(minted.credential, { requestId: "r2", actor: { id: "other", role: "organization_staff", organizationId: "org-1" }, now: "2026-11-21T00:00:00.000Z" });
    expect(stranger).toMatchObject({ ok: false, code: "NOT_PERMITTED" });
    const ledger = new Map();
    const revoke = { requestId: "r3", actor: request().actor, now: "2026-11-21T00:00:00.000Z" };
    const first = revokeCredential(minted.credential, revoke, ledger);
    const retry = revokeCredential(minted.credential, revoke, ledger);
    expect(first.ok && retry.ok && first.credential.revokedAt === "2026-11-21T00:00:00.000Z" && retry.replayed).toBe(true);
    expect(credentialAudit(first)).toEqual({ outcome: "credential", projectId: "prj_1", revoked: true, replayed: false });
    expect(JSON.stringify(credentialAudit(first))).not.toContain(SUBJECT);
  });
});
