import { describe, expect, it } from "vitest";
import {
  ATTRIBUTION_ACTIONS,
  ATTRIBUTION_ROLES,
  CONTRIBUTION_KINDS,
  attributionActionsFor,
  attributionAuditEntry,
  authorizeAttribution,
  latestVersion,
  raiseDispute,
  recordApproval,
  resolveAttributionRole,
  resolveContributionKind,
  resolveDispute,
  reviseAttribution,
  submitAttribution,
  summarizeAttributions,
  supersedeAttribution,
  validateDeclaration,
  versionHistory,
  type AttributionActor,
  type AttributionDispute,
  type AttributionRecord,
  type DeclaredContribution,
  type ProjectOutput,
} from "./contributor-attribution";

const contributor: AttributionActor = { id: "user1", role: "contributor", organizationId: "org1" };
const otherContributor: AttributionActor = { id: "user2", role: "contributor", organizationId: "org1" };
const supervisor: AttributionActor = { id: "sup1", role: "supervisor", organizationId: "org1" };
const secondSupervisor: AttributionActor = { id: "sup2", role: "supervisor", organizationId: "org1" };
const editor: AttributionActor = { id: "ed1", role: "editor", organizationId: "org1" };
const auditor: AttributionActor = { id: "aud1", role: "auditor", organizationId: "org1" };
const outsider: AttributionActor = { id: "user9", role: "contributor", organizationId: "org2" };

const outputs: ProjectOutput[] = [
  { id: "out1", projectId: "prj1", kind: "dataset" },
  { id: "out2", projectId: "prj1", kind: "code" },
  { id: "other-output", projectId: "prj2", kind: "document" },
];

const contribution = (over: Partial<DeclaredContribution> = {}): DeclaredContribution => ({
  kind: "conceptualization",
  level: "lead",
  outputIds: ["out1"],
  ...over,
});

const record = (over: Partial<AttributionRecord> = {}): AttributionRecord => ({
  id: "att1",
  organizationId: "org1",
  projectId: "prj1",
  contributorId: "user1",
  role: "lead_author",
  status: "draft",
  version: 1,
  revision: 1,
  contributions: [contribution()],
  requiredApproverIds: ["sup1"],
  approvals: [],
  createdAt: "2026-04-01T09:00:00Z",
  updatedAt: "2026-04-01T09:00:00Z",
  ...over,
});

const openDispute = (over: Partial<AttributionDispute> = {}): AttributionDispute => ({
  id: "dsp_1",
  attributionId: "att1",
  version: 1,
  raisedById: "sup1",
  reason: "missing_credit",
  status: "open",
  raisedAt: "2026-04-02T09:00:00Z",
  ...over,
});

describe("recognised contribution taxonomy", () => {
  it("offers the full CRediT taxonomy with stable kinds and labels", () => {
    expect(CONTRIBUTION_KINDS).toHaveLength(14);
    expect(new Set(CONTRIBUTION_KINDS).size).toBe(14);
  });

  it("resolves kinds by id, label and alias, ignoring case, spaces and punctuation", () => {
    expect(resolveContributionKind("Conceptualization")).toBe("conceptualization");
    expect(resolveContributionKind("writing - review & editing")).toBe("writing_review_editing");
    expect(resolveContributionKind("  DATA   CURATION ")).toBe("data_curation");
    expect(resolveContributionKind("project-administration")).toBe("project_administration");
    expect(resolveContributionKind("code")).toBe("software");
    expect(resolveContributionKind("not a contribution")).toBeNull();
  });

  it("resolves contributor roles by id, label and alias", () => {
    expect(ATTRIBUTION_ROLES).toHaveLength(10);
    expect(resolveAttributionRole("Lead author")).toBe("lead_author");
    expect(resolveAttributionRole("co-author")).toBe("co_author");
    expect(resolveAttributionRole("data steward")).toBe("data_steward");
    expect(resolveAttributionRole("wizard")).toBeNull();
  });
});

describe("declaration validation", () => {
  const ctx = { organizationId: "org1", projectId: "prj1", contributorId: "user1", outputs };
  const codes = (issues: { code: string }[]) => issues.map((issue) => issue.code).sort();

  it("accepts a role, contributions and unique approvers linked to project outputs", () => {
    expect(validateDeclaration({ role: "lead_author", contributions: [contribution()], requiredApproverIds: ["sup1"] }, ctx)).toEqual([]);
  });

  it("requires at least one contribution and at least one approver", () => {
    expect(codes(validateDeclaration({ role: "lead_author", contributions: [], requiredApproverIds: ["sup1"] }, ctx))).toEqual(["NO_CONTRIBUTIONS"]);
    expect(codes(validateDeclaration({ role: "lead_author", contributions: [contribution()], requiredApproverIds: [] }, ctx))).toEqual([
      "NO_APPROVERS",
    ]);
  });

  it("forbids self-approval and duplicate approvers", () => {
    expect(codes(validateDeclaration({ role: "lead_author", contributions: [contribution()], requiredApproverIds: ["user1"] }, ctx))).toEqual([
      "SELF_APPROVAL",
    ]);
    expect(
      codes(validateDeclaration({ role: "lead_author", contributions: [contribution()], requiredApproverIds: ["sup1", "sup1"] }, ctx)),
    ).toEqual(["DUPLICATE_APPROVER"]);
  });

  it("rejects unknown roles, kinds, levels and duplicate kinds", () => {
    const issues = validateDeclaration(
      {
        role: "wizard" as never,
        contributions: [contribution(), contribution(), contribution({ kind: "magic" as never, level: "primary" as never })],
        requiredApproverIds: ["sup1"],
      },
      ctx,
    );
    expect(codes(issues)).toEqual(["DUPLICATE_CONTRIBUTION", "UNKNOWN_CONTRIBUTION", "UNKNOWN_LEVEL", "UNKNOWN_ROLE"]);
  });

  it("caps contributions and note length", () => {
    const tooMany = Array.from({ length: CONTRIBUTION_KINDS.length + 1 }, () => contribution());
    expect(codes(validateDeclaration({ role: "lead_author", contributions: tooMany, requiredApproverIds: ["sup1"] }, ctx))).toContain(
      "TOO_MANY_CONTRIBUTIONS",
    );
    expect(
      codes(validateDeclaration({ role: "lead_author", contributions: [contribution({ note: "x".repeat(501) })], requiredApproverIds: ["sup1"] }, ctx)),
    ).toEqual(["NOTE_TOO_LONG"]);
  });

  it("checks that linked outputs exist, belong to the project and are not repeated", () => {
    const issues = validateDeclaration(
      {
        role: "lead_author",
        contributions: [contribution({ outputIds: ["out1", "out1", "missing", "other-output"] })],
        requiredApproverIds: ["sup1"],
      },
      ctx,
    );
    expect(codes(issues)).toEqual(["DUPLICATE_OUTPUT", "OUTPUT_PROJECT_MISMATCH", "UNKNOWN_OUTPUT"]);
  });
});

describe("deny-by-default authorization", () => {
  const resource = { organizationId: "org1", contributorId: "user1", assignedIds: ["sup1", "sup2"] };
  const reason = (decision: ReturnType<typeof authorizeAttribution>) => (decision.allowed ? "allowed" : decision.reason);

  it("lets contributors act only on their own attribution", () => {
    expect(reason(authorizeAttribution(contributor, "attribution.declare", resource))).toBe("allowed");
    expect(reason(authorizeAttribution(contributor, "attribution.submit", resource))).toBe("allowed");
    expect(reason(authorizeAttribution(otherContributor, "attribution.submit", resource))).toBe("NOT_OWNER");
    expect(reason(authorizeAttribution(contributor, "attribution.approve", resource))).toBe("FORBIDDEN_FOR_ROLE");
  });

  it("limits supervisors to assigned attributions", () => {
    expect(reason(authorizeAttribution(supervisor, "attribution.approve", resource))).toBe("allowed");
    expect(reason(authorizeAttribution({ ...supervisor, id: "sup9" }, "attribution.approve", resource))).toBe("NOT_ASSIGNED");
    expect(reason(authorizeAttribution(supervisor, "attribution.declare", resource))).toBe("FORBIDDEN_FOR_ROLE");
  });

  it("prevents self-approval even when the contributor is also an assigned supervisor", () => {
    expect(
      reason(authorizeAttribution({ id: "user1", role: "supervisor", organizationId: "org1" }, "attribution.approve", resource)),
    ).toBe("SELF_APPROVAL");
  });

  it("enforces the organization boundary for every role", () => {
    expect(reason(authorizeAttribution({ ...editor, organizationId: "org2" }, "attribution.resolve_dispute", resource))).toBe("TENANT_MISMATCH");
    expect(reason(authorizeAttribution(outsider, "attribution.view", resource))).toBe("TENANT_MISMATCH");
    expect(reason(authorizeAttribution(auditor, "attribution.view", resource))).toBe("allowed");
  });

  it("separates duties: editors resolve but do not approve, auditors never mutate", () => {
    expect(reason(authorizeAttribution(editor, "attribution.resolve_dispute", resource))).toBe("allowed");
    expect(reason(authorizeAttribution(editor, "attribution.approve", resource))).toBe("FORBIDDEN_FOR_ROLE");
    expect(reason(authorizeAttribution(auditor, "attribution.submit", resource))).toBe("FORBIDDEN_FOR_ROLE");
    for (const role of ["contributor", "supervisor", "editor", "organization_admin", "auditor"] as const) {
      expect(attributionActionsFor(role).length).toBeLessThan(ATTRIBUTION_ACTIONS.length);
    }
  });

  it("rejects unknown roles and actions", () => {
    expect(authorizeAttribution({ id: "x", role: "wizard" as never, organizationId: "org1" }, "attribution.view", resource)).toEqual({
      allowed: false,
      reason: "UNKNOWN_ROLE",
    });
    expect(authorizeAttribution(contributor, "attribution.everything" as never, resource)).toEqual({ allowed: false, reason: "UNKNOWN_ACTION" });
  });

  it("derives navigation actions from the permission matrix", () => {
    expect(attributionActionsFor("contributor")).toEqual([
      "attribution.declare",
      "attribution.dispute",
      "attribution.revise",
      "attribution.submit",
      "attribution.view",
    ]);
    expect(attributionActionsFor("auditor")).toEqual(["attribution.audit_view", "attribution.view"]);
  });
});

describe("submitting an attribution", () => {
  it("moves a valid draft to submitted and bumps the revision", () => {
    const result = submitAttribution(record(), { requestId: "req-submit", actor: contributor, expectedRevision: 1, now: "2026-04-03T09:00:00Z" }, outputs);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attribution.status).toBe("submitted");
    expect(result.attribution.revision).toBe(2);
    expect(result.attribution.updatedAt).toBe("2026-04-03T09:00:00Z");
    expect(result.replayed).toBe(false);
  });

  it("returns the original outcome for a retried request id", () => {
    const ledger = new Map();
    const request = { requestId: "req-submit", actor: contributor, expectedRevision: 1, now: "2026-04-03T09:00:00Z" };
    const first = submitAttribution(record(), request, outputs, ledger);
    const second = submitAttribution(record(), request, outputs, ledger);
    expect(second).toEqual(first.ok ? { ...first, replayed: true } : first);
  });

  it("rejects stale revisions and invalid states with stable codes", () => {
    expect(submitAttribution(record(), { requestId: "r1", actor: contributor, expectedRevision: 9, now: "now" }, outputs)).toMatchObject({
      ok: false,
      code: "STALE_REVISION",
    });
    expect(
      submitAttribution(record({ status: "submitted", revision: 2 }), { requestId: "r2", actor: contributor, expectedRevision: 2, now: "now" }, outputs),
    ).toMatchObject({ ok: false, code: "INVALID_STATE" });
  });

  it("denies non-owners, other tenants and invalid declarations", () => {
    const request = { requestId: "r1", actor: otherContributor, expectedRevision: 1, now: "now" };
    expect(submitAttribution(record(), request, outputs)).toMatchObject({ ok: false, code: "NOT_AUTHORIZED", message: expect.stringContaining("NOT_OWNER") });
    expect(submitAttribution(record(), { ...request, actor: outsider }, outputs)).toMatchObject({
      ok: false,
      code: "NOT_AUTHORIZED",
      message: expect.stringContaining("TENANT_MISMATCH"),
    });
    expect(
      submitAttribution(record({ contributions: [contribution({ outputIds: ["missing"] })] }), { ...request, actor: contributor }, outputs),
    ).toMatchObject({ ok: false, code: "INVALID_DECLARATION", issues: [{ code: "UNKNOWN_OUTPUT" }] });
  });
});

describe("recording approvals", () => {
  const submitted = (over: Partial<AttributionRecord> = {}) => record({ status: "submitted", revision: 2, ...over });

  it("approves once every required approver has approved", () => {
    const first = recordApproval(
      submitted({ requiredApproverIds: ["sup1", "sup2"] }),
      { requestId: "ap1", actor: supervisor, expectedRevision: 2, decision: "approved", note: "looks right", now: "2026-04-04T09:00:00Z" },
      [],
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.attribution.status).toBe("submitted");
    expect(first.attribution.approvals).toHaveLength(1);
    expect(first.attribution.approvals[0].note).toBe("looks right");

    const second = recordApproval(
      first.attribution,
      { requestId: "ap2", actor: secondSupervisor, expectedRevision: first.attribution.revision, decision: "approved", now: "2026-04-04T10:00:00Z" },
      [],
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.attribution.status).toBe("approved");
    expect(second.attribution.approvals).toHaveLength(2);
  });

  it("moves to rejected when an approver rejects", () => {
    const result = recordApproval(
      submitted(),
      { requestId: "ap-reject", actor: supervisor, expectedRevision: 2, decision: "rejected", now: "2026-04-04T09:00:00Z" },
      [],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attribution.status).toBe("rejected");
  });

  it("never records a second decision from the same approver", () => {
    const first = recordApproval(
      submitted({ requiredApproverIds: ["sup1", "sup2"] }),
      { requestId: "ap1", actor: supervisor, expectedRevision: 2, decision: "approved", now: "2026-04-04T09:00:00Z" },
      [],
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const retry = recordApproval(
      first.attribution,
      { requestId: "ap1-retry", actor: supervisor, expectedRevision: first.attribution.revision, decision: "rejected", now: "2026-04-04T09:00:00Z" },
      [],
    );
    expect(retry.ok).toBe(true);
    if (!retry.ok) return;
    expect(retry.replayed).toBe(true);
    expect(retry.attribution).toEqual(first.attribution);
  });

  it("blocks decisions while a dispute is open", () => {
    expect(
      recordApproval(submitted(), { requestId: "ap1", actor: supervisor, expectedRevision: 2, decision: "approved", now: "now" }, [openDispute()]),
    ).toMatchObject({ ok: false, code: "OPEN_DISPUTE" });
  });

  it("denies unassigned approvers, self-approval, stale revisions and invalid states", () => {
    expect(
      recordApproval(
        submitted(),
        { requestId: "ap1", actor: secondSupervisor, expectedRevision: 2, decision: "approved", now: "now" },
        [],
      ),
    ).toMatchObject({ ok: false, code: "NOT_AUTHORIZED", message: expect.stringContaining("NOT_ASSIGNED") });
    expect(
      recordApproval(
        submitted({ requiredApproverIds: ["user1"] }),
        { requestId: "ap2", actor: { id: "user1", role: "supervisor", organizationId: "org1" }, expectedRevision: 2, decision: "approved", now: "now" },
        [],
      ),
    ).toMatchObject({ ok: false, code: "NOT_AUTHORIZED", message: expect.stringContaining("SELF_APPROVAL") });
    expect(
      recordApproval(submitted(), { requestId: "ap3", actor: supervisor, expectedRevision: 1, decision: "approved", now: "now" }, []),
    ).toMatchObject({ ok: false, code: "STALE_REVISION" });
    expect(
      recordApproval(submitted({ status: "approved" }), { requestId: "ap4", actor: supervisor, expectedRevision: 2, decision: "approved", now: "now" }, []),
    ).toMatchObject({ ok: false, code: "INVALID_STATE" });
  });

  it("rejects overlong approval notes", () => {
    expect(
      recordApproval(submitted(), { requestId: "ap1", actor: supervisor, expectedRevision: 2, decision: "approved", note: "x".repeat(501), now: "now" }, []),
    ).toMatchObject({ ok: false, code: "NOTE_TOO_LONG" });
  });
});

describe("disputes", () => {
  const submitted = (over: Partial<AttributionRecord> = {}) => record({ status: "submitted", revision: 2, ...over });

  it("lets the contributor raise a recognised dispute and retries idempotently", () => {
    const ledger = new Map();
    const request = { requestId: "dp1", actor: contributor, expectedRevision: 2, reason: "missing_credit", note: "please add me", now: "2026-04-05T09:00:00Z" };
    const first = raiseDispute(submitted(), request, [], ledger);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.dispute).toMatchObject({ id: "dsp_dp1", reason: "missing_credit", status: "open", raisedById: "user1" });
    const retry = raiseDispute(submitted(), request, [], ledger);
    expect(retry).toEqual({ ...first, replayed: true });
  });

  it("does not create a duplicate open dispute for the same person and reason", () => {
    const existing = openDispute({ raisedById: "user1", reason: "missing_credit" });
    const result = raiseDispute(
      submitted(),
      { requestId: "dp2", actor: contributor, expectedRevision: 2, reason: "missing_credit", now: "now" },
      [existing],
    );
    expect(result).toEqual({ ok: true, dispute: existing, replayed: true });
  });

  it("denies other contributors, unknown reasons and amendments to drafts", () => {
    expect(
      raiseDispute(submitted(), { requestId: "dp1", actor: otherContributor, expectedRevision: 2, reason: "missing_credit", now: "now" }, []),
    ).toMatchObject({ ok: false, code: "NOT_AUTHORIZED", message: expect.stringContaining("NOT_OWNER") });
    expect(
      raiseDispute(submitted(), { requestId: "dp2", actor: contributor, expectedRevision: 2, reason: "not_a_reason", now: "now" }, []),
    ).toMatchObject({ ok: false, code: "INVALID_REASON" });
    expect(
      raiseDispute(record(), { requestId: "dp3", actor: contributor, expectedRevision: 1, reason: "missing_credit", now: "now" }, []),
    ).toMatchObject({ ok: false, code: "INVALID_STATE" });
  });

  it("lets an editor resolve a dispute but not their own", () => {
    const selfRaised = openDispute({ raisedById: "ed1" });
    expect(
      resolveDispute(record({ status: "approved", revision: 3 }), selfRaised, { requestId: "rd1", actor: editor, outcome: "rejected", now: "now" }),
    ).toMatchObject({ ok: false, code: "SELF_RESOLUTION" });

    const dispute = openDispute({ version: 2 });
    expect(
      resolveDispute(record({ status: "approved", revision: 3 }), dispute, { requestId: "rd2", actor: editor, outcome: "rejected", now: "now" }),
    ).toMatchObject({ ok: false, code: "DISPUTE_MISMATCH" });
  });

  it("keeps an approved attribution approved when a dispute is rejected", () => {
    const approved = record({ status: "approved", revision: 3 });
    const result = resolveDispute(
      approved,
      openDispute({ version: 1 }),
      { requestId: "rd1", actor: editor, outcome: "rejected", note: "credit was correct", now: "2026-04-06T09:00:00Z" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dispute).toMatchObject({ status: "rejected", resolvedById: "ed1", resolvedAt: "2026-04-06T09:00:00Z" });
    expect(result.attribution).toEqual(approved);
  });

  it("returns an upheld dispute to a rejected attribution that needs a new version", () => {
    const approved = record({ status: "approved", revision: 3 });
    const result = resolveDispute(approved, openDispute(), { requestId: "rd1", actor: editor, outcome: "upheld", now: "2026-04-06T09:00:00Z" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attribution.status).toBe("rejected");
    expect(result.attribution.revision).toBe(4);
  });

  it("replays a resolved dispute and rejects resolving it twice by a new request", () => {
    const ledger = new Map();
    const approved = record({ status: "approved", revision: 3 });
    const request = { requestId: "rd1", actor: editor, outcome: "rejected" as const, now: "now" };
    const first = resolveDispute(approved, openDispute(), request, ledger);
    const retry = resolveDispute(approved, openDispute(), request, ledger);
    expect(retry).toEqual(first.ok ? { ...first, replayed: true } : first);

    const again = resolveDispute(approved, { ...openDispute(), status: "rejected" }, { ...request, requestId: "rd2" });
    expect(again).toMatchObject({ ok: false, code: "INVALID_STATE" });
  });
});

describe("versioned revisions", () => {
  it("registers the next version without mutating the previous one", () => {
    const approved = record({ status: "approved", revision: 3 });
    const result = reviseAttribution(
      approved,
      {
        requestId: "rv1",
        actor: contributor,
        expectedRevision: 3,
        role: "co_author",
        contributions: [contribution({ kind: "writing_review_editing", outputIds: ["out2"] })],
        requiredApproverIds: ["sup2"],
        now: "2026-04-07T09:00:00Z",
      },
      outputs,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.previous).toEqual(approved);
    expect(result.attribution).toMatchObject({
      id: "att1",
      version: 2,
      revision: 1,
      status: "draft",
      role: "co_author",
      approvals: [],
      requiredApproverIds: ["sup2"],
    });
  });

  it("replays a retried revision request", () => {
    const ledger = new Map();
    const request = {
      requestId: "rv1",
      actor: contributor,
      expectedRevision: 3,
      role: "co_author" as const,
      contributions: [contribution()],
      requiredApproverIds: ["sup2"],
      now: "now",
    };
    const approved = record({ status: "approved", revision: 3 });
    const first = reviseAttribution(approved, request, outputs, ledger);
    const retry = reviseAttribution(approved, request, outputs, ledger);
    expect(retry).toEqual(first.ok ? { ...first, replayed: true } : first);
  });

  it("only revises approved or rejected records owned by the actor", () => {
    const request = {
      requestId: "rv1",
      actor: contributor,
      expectedRevision: 1,
      role: "co_author" as const,
      contributions: [contribution()],
      requiredApproverIds: ["sup2"],
      now: "now",
    };
    expect(reviseAttribution(record(), request, outputs)).toMatchObject({ ok: false, code: "INVALID_STATE" });
    expect(reviseAttribution(record({ status: "approved" }), { ...request, actor: otherContributor }, outputs)).toMatchObject({
      ok: false,
      code: "NOT_AUTHORIZED",
    });
    expect(reviseAttribution(record({ status: "approved" }), { ...request, expectedRevision: 5 }, outputs)).toMatchObject({
      ok: false,
      code: "STALE_REVISION",
    });
    expect(
      reviseAttribution(
        record({ status: "approved" }),
        { ...request, contributions: [contribution({ kind: "magic" as never })] },
        outputs,
      ),
    ).toMatchObject({ ok: false, code: "INVALID_DECLARATION" });
  });

  it("marks an older approved version superseded only by the next approved version", () => {
    const v1 = record({ status: "approved", version: 1, revision: 3 });
    const v2 = record({ status: "approved", version: 2, revision: 2 });
    expect(supersedeAttribution(v1, v2, "2026-04-08T09:00:00Z")).toEqual({
      ok: true,
      attribution: { ...v1, status: "superseded", revision: 4, updatedAt: "2026-04-08T09:00:00Z" },
    });
    expect(supersedeAttribution(v1, { ...v2, status: "draft" }, "now")).toMatchObject({ ok: false, code: "INVALID_SUPERSESSION" });
    expect(supersedeAttribution(v1, { ...v2, id: "att2" }, "now")).toMatchObject({ ok: false, code: "INVALID_SUPERSESSION" });
    expect(supersedeAttribution(v1, { ...v2, version: 3 }, "now")).toMatchObject({ ok: false, code: "INVALID_SUPERSESSION" });
  });

  it("reports a deterministic version history and latest version", () => {
    const versions = [
      record({ version: 2, status: "approved", createdAt: "2026-04-02T00:00:00Z" }),
      record({ version: 1, status: "superseded", createdAt: "2026-04-01T00:00:00Z" }),
      record({ version: 3, status: "draft", createdAt: "2026-04-03T00:00:00Z" }),
    ];
    expect(versionHistory(versions).map((entry) => entry.version)).toEqual([1, 2, 3]);
    expect(versionHistory(versions)[1]).toEqual({
      version: 2,
      role: "lead_author",
      status: "approved",
      createdAt: "2026-04-02T00:00:00Z",
      contributionKinds: ["conceptualization"],
    });
    expect(latestVersion(versions)?.version).toBe(3);
    expect(latestVersion([])).toBeNull();
  });
});

describe("privacy-safe audit and analytics", () => {
  const privateRecord = record({
    contributions: [contribution({ note: "secret contribution note" })],
    approvals: [{ approverId: "sup1", decision: "approved", at: "2026-04-04T09:00:00Z", note: "secret approval note" }],
  });

  it("audits only taxonomy values and counters, never identities or private text", () => {
    const entry = attributionAuditEntry(privateRecord, "attribution.submitted", "2026-04-05T09:00:00Z");
    expect(entry).toEqual({
      eventType: "attribution.submitted",
      attributionId: "att1",
      projectId: "prj1",
      version: 1,
      revision: 1,
      status: "draft",
      contributionKinds: ["conceptualization"],
      outputLinkCount: 1,
      approvalCount: 1,
      at: "2026-04-05T09:00:00Z",
    });
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toContain("user1");
    expect(serialized).not.toContain("sup1");
    expect(serialized).not.toContain("out1");
    expect(serialized).not.toContain("secret");
  });

  it("summarises counts and suppresses small groups", () => {
    const singles = summarizeAttributions([privateRecord]);
    expect(singles.total).toBe(1);
    expect(singles.byKind).toEqual([]);
    expect(singles.suppressedKinds).toBe(1);

    const three = summarizeAttributions([privateRecord, privateRecord, privateRecord]);
    expect(three.byKind).toEqual([{ kind: "conceptualization", count: 3 }]);
    expect(three.suppressedKinds).toBe(0);
    expect(three.byStatus.draft).toBe(3);
  });

  it("never includes identities, notes or output ids in analytics", () => {
    const serialized = JSON.stringify(summarizeAttributions([privateRecord, privateRecord, privateRecord]));
    expect(serialized).not.toContain("user1");
    expect(serialized).not.toContain("sup1");
    expect(serialized).not.toContain("out1");
    expect(serialized).not.toContain("secret");
  });
});

