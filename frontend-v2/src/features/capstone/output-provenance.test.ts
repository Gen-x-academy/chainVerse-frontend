import { describe, expect, it } from "vitest";
import {
  ANALYTICS_MIN_GROUP,
  PROVENANCE_ACTIONS,
  authorizeProvenance,
  computeProvenanceDigest,
  latestVersion,
  outputIntegrityCommitment,
  provenanceActionsFor,
  provenanceAuditEntry,
  publishProvenance,
  reviseProvenance,
  submitProvenance,
  summarizeProvenance,
  supersedeProvenance,
  validateProvenance,
  verifyProvenanceIntegrity,
  versionHistory,
  type ProvenanceActor,
  type ProvenanceInput,
  type ProvenanceIssue,
  type ProvenanceRecord,
} from "./output-provenance";

const digest = "a".repeat(64);
const at = "2026-04-01T09:00:00Z";

const sources = () => [
  { id: "src1", name: "Open dataset", access: "public" as const, uri: "https://example.org/data", sha256: digest },
];
const methods = () => [{ id: "m1", name: "Longitudinal survey" }];
const tools = () => [{ id: "t1", name: "Python", version: "3.12" }];
const commits = () => [{ id: "c1", repository: "genx/research", commit: "abcdef1", branch: "main" }];
const transformations = () => [
  { id: "tr1", description: "Clean rows and align columns", toolId: "t1", inputIds: ["src1"], outputIds: ["out1"], reproducibility: "scripted" as const },
];
const licenses = () => [{ id: "l1", name: "Creative Commons Attribution 4.0", spdx: "CC-BY-4.0" }];
const authors = () => [
  { authorId: "user1", role: "lead" as const },
  { authorId: "user2", role: "contributor" as const },
  { authorId: "sup1", role: "supervisor" as const },
];
const integrity = () => [{ algorithm: "SHA-256" as const, digest, scope: "output" as const, covers: ["output"], committedAt: at }];

const provenance = (over: Partial<ProvenanceRecord> = {}): ProvenanceRecord => ({
  id: "prov1",
  organizationId: "org1",
  projectId: "prj1",
  outputId: "out1",
  kind: "dataset",
  version: 1,
  revision: 1,
  status: "draft",
  sources: sources(),
  methods: methods(),
  tools: tools(),
  commits: commits(),
  transformations: transformations(),
  licenses: licenses(),
  authors: authors(),
  integrity: integrity(),
  createdAt: at,
  updatedAt: at,
  ...over,
});

const input = (over: Partial<ProvenanceInput> = {}): ProvenanceInput => ({
  kind: "dataset",
  sources: sources(),
  methods: methods(),
  tools: tools(),
  commits: commits(),
  transformations: transformations(),
  licenses: licenses(),
  authors: authors(),
  integrity: integrity(),
  ...over,
});

const ctx = { organizationId: "org1", projectId: "prj1", outputId: "out1", memberIds: ["user1", "user2", "sup1"] };

const user1: ProvenanceActor = { id: "user1", role: "contributor", organizationId: "org1" };
const user3: ProvenanceActor = { id: "user3", role: "contributor", organizationId: "org1" };
const sup1: ProvenanceActor = { id: "sup1", role: "supervisor", organizationId: "org1" };
const sup2: ProvenanceActor = { id: "sup2", role: "supervisor", organizationId: "org1" };
const editor: ProvenanceActor = { id: "ed1", role: "editor", organizationId: "org1" };
const admin: ProvenanceActor = { id: "adm1", role: "organization_admin", organizationId: "org1" };
const auditor: ProvenanceActor = { id: "aud1", role: "auditor", organizationId: "org1" };

const codes = (issues: ProvenanceIssue[]) => issues.map((issue) => issue.code).sort();
const reason = (decision: ReturnType<typeof authorizeProvenance>) => (decision.allowed ? "allowed" : decision.reason);

describe("provenance validation", () => {
  it("accepts a complete, linked and integrity-committed output version", () => {
    expect(validateProvenance(provenance(), ctx)).toEqual([]);
  });

  it("rejects cross-tenant, cross-project and cross-output records", () => {
    expect(codes(validateProvenance(provenance({ organizationId: "org2" }), ctx))).toEqual(["TENANT_MISMATCH"]);
    expect(codes(validateProvenance(provenance({ projectId: "prj2" }), ctx))).toEqual(["PROJECT_MISMATCH"]);
    expect(
      codes(
        validateProvenance(
          provenance({ outputId: "out2", transformations: transformations().map((t) => ({ ...t, outputIds: ["out2"] })) }),
          ctx,
        ),
      ),
    ).toEqual(["OUTPUT_MISMATCH"]);
  });

  it("requires sources, methods, authors, licenses and integrity commitments", () => {
    expect(codes(validateProvenance(provenance({ sources: [], transformations: [] }), ctx))).toEqual(["NO_SOURCES"]);
    expect(codes(validateProvenance(provenance({ methods: [] }), ctx))).toEqual(["NO_METHODS"]);
    expect(codes(validateProvenance(provenance({ authors: [] }), ctx))).toEqual(["NO_AUTHORS"]);
    expect(codes(validateProvenance(provenance({ licenses: [] }), ctx))).toEqual(["NO_LICENSES"]);
    expect(codes(validateProvenance(provenance({ integrity: [] }), ctx))).toEqual(["NO_INTEGRITY_COMMITMENT"]);
  });

  it("requires a lead author and output-scoped integrity commitment", () => {
    expect(codes(validateProvenance(provenance({ authors: [{ authorId: "user1", role: "contributor" }] }), ctx))).toEqual([
      "NO_LEAD_AUTHOR",
    ]);
    expect(
      codes(
        validateProvenance(
          provenance({ integrity: [{ algorithm: "SHA-256", digest, scope: "sources", covers: ["src1"], committedAt: at }] }),
          ctx,
        ),
      ),
    ).toEqual(["NO_OUTPUT_COMMITMENT"]);
  });

  it("keeps private source locations out of provenance", () => {
    const issues = validateProvenance(
      provenance({ sources: [{ id: "src1", name: "Private cohort", access: "private", uri: "https://private.example" }] }),
      ctx,
    );
    expect(codes(issues)).toEqual(["PRIVATE_LOCATION_EXPOSED"]);
  });

  it("validates digests, commits, SPDX ids and notes", () => {
    expect(codes(validateProvenance(provenance({ sources: [{ id: "src1", access: "public", sha256: "xyz" }] }), ctx))).toEqual([
      "INVALID_DIGEST",
    ]);
    expect(
      codes(validateProvenance(provenance({ commits: [{ id: "c1", repository: "repo", commit: "not-a-sha" }] }), ctx)),
    ).toEqual(["INVALID_COMMIT"]);
    expect(codes(validateProvenance(provenance({ licenses: [{ id: "l1", name: "Custom", spdx: "not a spdx id" }] }), ctx))).toEqual([
      "INVALID_SPDX",
    ]);
    expect(
      codes(validateProvenance(provenance({ sources: [{ id: "src1", access: "public", note: "x".repeat(501) }] }), ctx)),
    ).toEqual(["NOTE_TOO_LONG"]);
  });

  it("requires authors to be project members and component ids to be unique", () => {
    expect(
      codes(validateProvenance(provenance({ authors: [{ authorId: "stranger", role: "contributor" }] }), ctx)),
    ).toEqual(["NO_LEAD_AUTHOR", "UNKNOWN_AUTHOR"]);
    expect(codes(validateProvenance(provenance({ methods: [{ id: "src1", name: "Duplicate id" }] }), ctx))).toEqual([
      "DUPLICATE_ID",
    ]);
  });

  it("checks transformation references, tools and cycles", () => {
    expect(
      codes(
        validateProvenance(
          provenance({
            transformations: [
              { id: "tr1", description: "Unknown input", inputIds: ["missing"], outputIds: ["out1"], reproducibility: "scripted" },
            ],
          }),
          ctx,
        ),
      ),
    ).toContain("UNKNOWN_INPUT");
    expect(
      codes(
        validateProvenance(
          provenance({
            transformations: [
              { id: "tr1", description: "Unknown output", inputIds: ["src1"], outputIds: ["missing"], reproducibility: "scripted" },
            ],
          }),
          ctx,
        ),
      ),
    ).toContain("UNKNOWN_OUTPUT_REF");
    expect(
      codes(
        validateProvenance(
          provenance({
            transformations: [
              { id: "tr1", description: "Unknown tool", toolId: "missing", inputIds: ["src1"], outputIds: ["out1"], reproducibility: "scripted" },
            ],
          }),
          ctx,
        ),
      ),
    ).toContain("UNKNOWN_TOOL");
    expect(
      codes(
        validateProvenance(
          provenance({
            transformations: [
              { id: "tr1", description: "First", inputIds: ["tr2"], outputIds: ["out1"], reproducibility: "scripted" },
              { id: "tr2", description: "Second", inputIds: ["tr1"], outputIds: ["out1"], reproducibility: "scripted" },
            ],
          }),
          ctx,
        ),
      ),
    ).toContain("TRANSFORMATION_CYCLE");
  });

  it("validates integrity digest, coverage and uniqueness", () => {
    expect(
      codes(
        validateProvenance(
          provenance({ integrity: [{ algorithm: "SHA-256", digest: "xyz", scope: "output", covers: ["output"], committedAt: at }] }),
          ctx,
        ),
      ),
    ).toEqual(["INVALID_DIGEST"]);
    expect(
      codes(
        validateProvenance(
          provenance({ integrity: [{ algorithm: "SHA-256", digest, scope: "output", covers: ["missing"], committedAt: at }] }),
          ctx,
        ),
      ),
    ).toEqual(["UNKNOWN_COVERAGE"]);
    expect(
      codes(
        validateProvenance(
          provenance({
            integrity: [
              { algorithm: "SHA-256", digest, scope: "output", covers: ["output"], committedAt: at },
              { algorithm: "SHA-256", digest: "b".repeat(64), scope: "output", covers: ["output"], committedAt: at },
            ],
          }),
          ctx,
        ),
      ),
    ).toEqual(["DUPLICATE_COMMITMENT"]);
    expect(
      codes(
        validateProvenance(
          provenance({ integrity: [{ algorithm: "SHA-256", digest, scope: "output", covers: ["output"], committedAt: "soon" }] }),
          ctx,
        ),
      ),
    ).toEqual(["INVALID_TIMESTAMP"]);
  });
});

describe("deny-by-default provenance authorization", () => {
  const resource = { organizationId: "org1", outputId: "out1", authorIds: ["user1", "user2"], assignedIds: ["sup1"] };

  it("lets credited authors declare, revise and submit their output", () => {
    expect(reason(authorizeProvenance(user1, "provenance.declare", resource))).toBe("allowed");
    expect(reason(authorizeProvenance(user1, "provenance.submit", resource))).toBe("allowed");
    expect(reason(authorizeProvenance(user3, "provenance.submit", resource))).toBe("NOT_AUTHOR");
    expect(reason(authorizeProvenance(user1, "provenance.publish", resource))).toBe("FORBIDDEN_FOR_ROLE");
  });

  it("lets assigned supervisors publish but not author or self-publish", () => {
    expect(reason(authorizeProvenance(sup1, "provenance.publish", resource))).toBe("allowed");
    expect(reason(authorizeProvenance(sup2, "provenance.publish", resource))).toBe("NOT_ASSIGNED");
    expect(reason(authorizeProvenance(sup1, "provenance.declare", resource))).toBe("FORBIDDEN_FOR_ROLE");
    expect(
      reason(authorizeProvenance({ id: "user1", role: "supervisor", organizationId: "org1" }, "provenance.publish", resource)),
    ).toBe("SELF_PUBLISH");
  });

  it("separates publishing from administration and keeps auditors read-only", () => {
    expect(reason(authorizeProvenance(editor, "provenance.publish", resource))).toBe("allowed");
    expect(reason(authorizeProvenance(admin, "provenance.publish", resource))).toBe("FORBIDDEN_FOR_ROLE");
    expect(reason(authorizeProvenance(auditor, "provenance.submit", resource))).toBe("FORBIDDEN_FOR_ROLE");
    expect(reason(authorizeProvenance(auditor, "provenance.audit_view", resource))).toBe("allowed");
  });

  it("enforces the organization boundary and rejects unknown roles/actions", () => {
    expect(reason(authorizeProvenance({ ...editor, organizationId: "org2" }, "provenance.publish", resource))).toBe("TENANT_MISMATCH");
    expect(
      authorizeProvenance({ id: "x", role: "wizard" as never, organizationId: "org1" }, "provenance.view", resource),
    ).toEqual({ allowed: false, reason: "UNKNOWN_ROLE" });
    expect(authorizeProvenance(user1, "provenance.everything" as never, resource)).toEqual({
      allowed: false,
      reason: "UNKNOWN_ACTION",
    });
  });

  it("derives navigation actions from the matrix", () => {
    for (const role of ["contributor", "supervisor", "editor", "organization_admin", "auditor"] as const) {
      expect(provenanceActionsFor(role).length).toBeLessThan(PROVENANCE_ACTIONS.length);
    }
    expect(provenanceActionsFor("contributor")).toEqual([
      "provenance.declare",
      "provenance.revise",
      "provenance.submit",
      "provenance.view",
    ]);
    expect(provenanceActionsFor("auditor")).toEqual(["provenance.audit_view", "provenance.view"]);
  });
});

describe("submitting provenance", () => {
  it("moves a valid draft to submitted and bumps the revision", () => {
    const result = submitProvenance(provenance(), { requestId: "s1", actor: user1, expectedRevision: 1, now: "t1" }, ctx.memberIds);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provenance.status).toBe("submitted");
    expect(result.provenance.revision).toBe(2);
    expect(result.provenance.updatedAt).toBe("t1");
  });

  it("replays a retried request and rejects stale or invalid states", () => {
    const ledger = new Map();
    const request = { requestId: "s1", actor: user1, expectedRevision: 1, now: "t1" };
    const first = submitProvenance(provenance(), request, ctx.memberIds, ledger);
    expect(submitProvenance(provenance(), request, ctx.memberIds, ledger)).toEqual(
      first.ok ? { ...first, replayed: true } : first,
    );
    expect(submitProvenance(provenance(), { ...request, requestId: "s2", expectedRevision: 9 }, ctx.memberIds)).toMatchObject({
      ok: false,
      code: "STALE_REVISION",
    });
    expect(
      submitProvenance(provenance({ status: "submitted", revision: 2 }), { ...request, requestId: "s3", expectedRevision: 2 }, ctx.memberIds),
    ).toMatchObject({ ok: false, code: "INVALID_STATE" });
  });

  it("denies non-authors and invalid provenance", () => {
    expect(
      submitProvenance(provenance(), { requestId: "s1", actor: user3, expectedRevision: 1, now: "t1" }, ctx.memberIds),
    ).toMatchObject({ ok: false, code: "NOT_AUTHORIZED", message: expect.stringContaining("NOT_AUTHOR") });
    expect(
      submitProvenance(provenance({ integrity: [] }), { requestId: "s2", actor: user1, expectedRevision: 1, now: "t1" }, ctx.memberIds),
    ).toMatchObject({ ok: false, code: "INVALID_PROVENANCE", issues: [{ code: "NO_INTEGRITY_COMMITMENT" }] });
  });
});

describe("publishing provenance", () => {
  const submitted = (over: Partial<ProvenanceRecord> = {}) => provenance({ status: "submitted", revision: 2, ...over });

  it("publishes a submitted version through an assigned supervisor", () => {
    const result = publishProvenance(submitted(), { requestId: "p1", actor: sup1, expectedRevision: 2, now: "t2" }, ctx.memberIds);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provenance.status).toBe("published");
    expect(result.provenance.revision).toBe(3);
    expect(result.provenance.publishedAt).toBe("t2");
  });

  it("replays, rejects stale/invalid states and blocks self-publishing", () => {
    const ledger = new Map();
    const request = { requestId: "p1", actor: sup1, expectedRevision: 2, now: "t2" };
    const first = publishProvenance(submitted(), request, ctx.memberIds, ledger);
    expect(publishProvenance(submitted(), request, ctx.memberIds, ledger)).toEqual(
      first.ok ? { ...first, replayed: true } : first,
    );
    expect(publishProvenance(submitted(), { ...request, requestId: "p2", expectedRevision: 1 }, ctx.memberIds)).toMatchObject({
      ok: false,
      code: "STALE_REVISION",
    });
    expect(publishProvenance(provenance(), { ...request, requestId: "p3", expectedRevision: 1 }, ctx.memberIds)).toMatchObject({
      ok: false,
      code: "INVALID_STATE",
    });
    expect(
      publishProvenance(submitted(), { ...request, requestId: "p4", actor: { id: "user1", role: "supervisor", organizationId: "org1" } }, ctx.memberIds),
    ).toMatchObject({ ok: false, code: "NOT_AUTHORIZED", message: expect.stringContaining("SELF_PUBLISH") });
    expect(
      publishProvenance(submitted(), { ...request, requestId: "p5", actor: sup2 }, ctx.memberIds),
    ).toMatchObject({ ok: false, code: "NOT_AUTHORIZED", message: expect.stringContaining("NOT_ASSIGNED") });
  });

  it("revalidates provenance before publishing", () => {
    expect(
      publishProvenance(submitted({ integrity: [] }), { requestId: "p1", actor: sup1, expectedRevision: 2, now: "t" }, ctx.memberIds),
    ).toMatchObject({ ok: false, code: "INVALID_PROVENANCE" });
  });
});

describe("versioned corrections", () => {
  const published = (over: Partial<ProvenanceRecord> = {}) => provenance({ status: "published", revision: 3, publishedAt: at, ...over });

  it("registers the next version without editing the published one", () => {
    const result = reviseProvenance(
      published(),
      { requestId: "r1", actor: user1, expectedRevision: 3, input: input({ licenses: [{ id: "l1", name: "MIT", spdx: "MIT" }] }), now: "t3" },
      ctx.memberIds,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.previous).toEqual(published());
    expect(result.provenance).toMatchObject({ id: "prov1", version: 2, revision: 1, status: "draft", createdAt: "t3" });
    expect(result.provenance.licenses[0]).toMatchObject({ name: "MIT", spdx: "MIT" });
  });

  it("replays, rejects invalid states/stale revisions and denies non-authors", () => {
    const ledger = new Map();
    const request = { requestId: "r1", actor: user1, expectedRevision: 3, input: input(), now: "t3" };
    const first = reviseProvenance(published(), request, ctx.memberIds, ledger);
    expect(reviseProvenance(published(), request, ctx.memberIds, ledger)).toEqual(
      first.ok ? { ...first, replayed: true } : first,
    );
    expect(reviseProvenance(provenance(), { ...request, requestId: "r2", expectedRevision: 1 }, ctx.memberIds)).toMatchObject({
      ok: false,
      code: "INVALID_STATE",
    });
    expect(reviseProvenance(published(), { ...request, requestId: "r3", expectedRevision: 9 }, ctx.memberIds)).toMatchObject({
      ok: false,
      code: "STALE_REVISION",
    });
    expect(reviseProvenance(published(), { ...request, requestId: "r4", actor: user3 }, ctx.memberIds)).toMatchObject({
      ok: false,
      code: "NOT_AUTHORIZED",
    });
    expect(
      reviseProvenance(published(), { ...request, requestId: "r5", input: input({ methods: [] }) }, ctx.memberIds),
    ).toMatchObject({ ok: false, code: "INVALID_PROVENANCE" });
  });

  it("supersedes only the immediately previous published version", () => {
    const v1 = published({ version: 1, revision: 3 });
    const v2 = published({ version: 2, revision: 2 });
    expect(supersedeProvenance(v1, v2, "t4")).toEqual({
      ok: true,
      provenance: { ...v1, status: "superseded", revision: 4, updatedAt: "t4" },
    });
    expect(supersedeProvenance(v1, { ...v2, status: "draft" }, "t4")).toMatchObject({ ok: false, code: "INVALID_SUPERSESSION" });
    expect(supersedeProvenance(v1, { ...v2, id: "prov2" }, "t4")).toMatchObject({ ok: false, code: "INVALID_SUPERSESSION" });
    expect(supersedeProvenance(v1, { ...v2, version: 3 }, "t4")).toMatchObject({ ok: false, code: "INVALID_SUPERSESSION" });
  });

  it("reports a deterministic version history and latest version", () => {
    const versions = [
      published({ version: 2, createdAt: "b" }),
      published({ version: 1, createdAt: "a" }),
      published({ version: 3, createdAt: "c" }),
    ];
    expect(versionHistory(versions).map((entry) => entry.version)).toEqual([1, 2, 3]);
    expect(versionHistory(versions)[1]).toEqual({
      version: 2,
      status: "published",
      kind: "dataset",
      createdAt: "b",
      publishedAt: at,
      sourceCount: 1,
      transformationCount: 1,
      authorCount: 3,
    });
    expect(latestVersion(versions)?.version).toBe(3);
    expect(latestVersion([])).toBeNull();
  });
});

describe("privacy-safe audit and analytics", () => {
  const privateRecord = provenance({
    sources: [{ id: "src1", name: "Secret cohort", access: "public", uri: "https://secret.example/data", note: "hidden source note" }],
    commits: [{ id: "c1", repository: "private/repository", commit: "abcdef1" }],
    licenses: [{ id: "l1", name: "Private license", spdx: "MIT", url: "https://license.example/private" }],
    authors: [
      { authorId: "user1", role: "lead" },
      { authorId: "sup1", role: "supervisor" },
    ],
  });

  it("audits counts and taxonomy only, never identities or private locations", () => {
    const entry = provenanceAuditEntry(privateRecord, "provenance.published", at);
    expect(entry).toEqual({
      eventType: "provenance.published",
      provenanceId: "prov1",
      projectId: "prj1",
      outputId: "out1",
      version: 1,
      revision: 1,
      status: "draft",
      kind: "dataset",
      sourceCount: 1,
      methodCount: 1,
      toolCount: 1,
      commitCount: 1,
      transformationCount: 1,
      licenseCount: 1,
      authorCount: 2,
      integrityAlgorithms: ["SHA-256"],
      at,
    });
    const text = JSON.stringify(entry);
    for (const secret of ["user1", "sup1", "Secret cohort", "secret.example", "hidden source note", "private/repository", "license.example"]) {
      expect(text).not.toContain(secret);
    }
  });

  it("suppresses small groups and never includes identities or locations", () => {
    const single = summarizeProvenance([privateRecord]);
    expect(single.total).toBe(1);
    expect(single.byKind).toEqual([]);
    expect(single.suppressedKinds).toBe(1);
    expect(single.bySourceAccess).toEqual([]);
    expect(single.suppressedAccess).toBe(1);

    const three = summarizeProvenance([privateRecord, privateRecord, privateRecord]);
    expect(ANALYTICS_MIN_GROUP).toBe(3);
    expect(three.byKind).toEqual([{ kind: "dataset", count: 3 }]);
    expect(three.bySourceAccess).toEqual([{ access: "public", count: 3 }]);
    expect(three.suppressedKinds).toBe(0);

    const text = JSON.stringify(three);
    for (const secret of ["user1", "sup1", "Secret cohort", "secret.example", "hidden source note", "private/repository"]) {
      expect(text).not.toContain(secret);
    }
  });
});

describe("integrity commitments", () => {
  it("computes a deterministic output digest and commitment", async () => {
    const unsigned = provenance({ integrity: [] });
    const first = await computeProvenanceDigest(unsigned);
    const second = await computeProvenanceDigest(unsigned);
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);

    const commitment = await outputIntegrityCommitment(unsigned, at);
    expect(commitment).toMatchObject({ algorithm: "SHA-256", scope: "output", covers: ["output"], committedAt: at });
    expect(commitment.digest).toBe(first);
  });

  it("verifies an untouched version and detects tampering", async () => {
    const unsigned = provenance({ integrity: [] });
    const signed = { ...unsigned, integrity: [await outputIntegrityCommitment(unsigned, at)] };
    await expect(verifyProvenanceIntegrity(signed)).resolves.toEqual({ ok: true, digest: signed.integrity[0].digest });

    const tampered = { ...signed, sources: [{ ...signed.sources[0], name: "Forged dataset" }] };
    await expect(verifyProvenanceIntegrity(tampered)).resolves.toEqual({ ok: false, code: "DIGEST_MISMATCH" });
  });

  it("survives submission and publication because volatile fields are excluded", async () => {
    const unsigned = provenance({ integrity: [] });
    const signed = { ...unsigned, integrity: [await outputIntegrityCommitment(unsigned, at)] };
    const submitted = submitProvenance(signed, { requestId: "s1", actor: user1, expectedRevision: 1, now: "t1" }, ctx.memberIds);
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    await expect(verifyProvenanceIntegrity(submitted.provenance)).resolves.toMatchObject({ ok: true });

    const published = publishProvenance(
      submitted.provenance,
      { requestId: "p1", actor: sup1, expectedRevision: submitted.provenance.revision, now: "t2" },
      ctx.memberIds,
    );
    expect(published.ok).toBe(true);
    if (!published.ok) return;
    await expect(verifyProvenanceIntegrity(published.provenance)).resolves.toMatchObject({ ok: true });
  });

  it("reports a missing output commitment", async () => {
    const record = provenance({
      integrity: [{ algorithm: "SHA-256", digest, scope: "sources", covers: ["src1"], committedAt: at }],
    });
    await expect(verifyProvenanceIntegrity(record)).resolves.toEqual({ ok: false, code: "NO_OUTPUT_COMMITMENT" });
  });
});
