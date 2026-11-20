import { describe, expect, it } from "vitest";
import {
  ANALYTICS_MIN_GROUP,
  DEFAULT_RETENTION_POLICY,
  EVIDENCE_ACTIONS,
  assessRetention,
  authorizeEvidence,
  daysUntilExpiry,
  disposeEvidence,
  evidenceActionsFor,
  evidenceAuditEntry,
  findActiveHold,
  logEvidenceAccess,
  placeLegalHold,
  planDisposal,
  releaseLegalHold,
  summarizeAccessEvents,
  summarizeRetention,
  validateLegalHoldInput,
  validateRetentionPolicy,
  type EvidenceAccessEvent,
  type EvidenceActor,
  type EvidenceRecord,
  type LegalHold,
  type LegalHoldInput,
  type PolicyIssue,
  type RetentionAssessment,
  type RetentionPolicy,
  type RetentionRule,
} from "./integrity-evidence-retention";

const at = "2026-04-01T00:00:00Z";
const NOW = new Date(at);

const policy = (rules: RetentionRule[] = DEFAULT_RETENTION_POLICY.rules): RetentionPolicy => ({
  ...DEFAULT_RETENTION_POLICY,
  rules,
});

const reportRule = (over: Partial<RetentionRule> = {}): RetentionRule => ({
  ...DEFAULT_RETENTION_POLICY.rules[0],
  retentionDays: 30,
  ...over,
});

const record = (over: Partial<EvidenceRecord> = {}): EvidenceRecord => ({
  id: "rec1",
  organizationId: "org1",
  subjectId: "subj1",
  category: "report",
  status: "active",
  revision: 1,
  createdAt: "2026-03-25T00:00:00Z",
  ...over,
});

const hold = (over: Partial<LegalHold> = {}): LegalHold => ({
  id: "hold1",
  organizationId: "org1",
  subjectId: "subj1",
  categories: ["report"],
  reason: "investigation",
  status: "active",
  revision: 1,
  placedAt: at,
  placedBy: "safe1",
  ...over,
});

const holdInput = (over: Partial<LegalHoldInput> = {}): LegalHoldInput => ({
  id: "hold1",
  organizationId: "org1",
  subjectId: "subj1",
  categories: ["report"],
  reason: "investigation",
  now: at,
  ...over,
});

const assessment = (over: Partial<RetentionAssessment> = {}): RetentionAssessment => ({
  recordId: "rec1",
  category: "report",
  action: "delete",
  reason: "window expired",
  retentionDaysRemaining: -1,
  protectedBy: null,
  disposalMethod: "secure_delete",
  ...over,
});

const reviewer: EvidenceActor = { id: "rev1", role: "reviewer", organizationId: "org1" };
const safety: EvidenceActor = { id: "safe1", role: "safety_officer", organizationId: "org1" };
const auditor: EvidenceActor = { id: "aud1", role: "auditor", organizationId: "org1" };
const admin: EvidenceActor = { id: "adm1", role: "organization_admin", organizationId: "org1" };

const codes = (issues: PolicyIssue[]) => issues.map((issue) => issue.code).sort();
const decisionReason = (decision: ReturnType<typeof authorizeEvidence>) => (decision.allowed ? "allowed" : decision.reason);
const resultCode = (
  decision: ReturnType<typeof placeLegalHold> | ReturnType<typeof releaseLegalHold> | ReturnType<typeof disposeEvidence> | ReturnType<typeof logEvidenceAccess>,
) => (decision.ok ? "allowed" : decision.code);

describe("retention policy", () => {
  it("accepts the default category-specific policy", () => {
    expect(validateRetentionPolicy(DEFAULT_RETENTION_POLICY)).toEqual([]);
  });

  it("requires one rule per category with a stated basis and owner", () => {
    expect(codes(validateRetentionPolicy(policy(DEFAULT_RETENTION_POLICY.rules.filter((rule) => rule.category !== "review"))))).toEqual([
      "MISSING_CATEGORY",
    ]);
    expect(codes(validateRetentionPolicy(policy([...DEFAULT_RETENTION_POLICY.rules, DEFAULT_RETENTION_POLICY.rules[0]])))).toEqual([
      "DUPLICATE_CATEGORY",
    ]);
    expect(codes(validateRetentionPolicy(policy([reportRule({ legalBasis: "", owner: " " }), ...DEFAULT_RETENTION_POLICY.rules.slice(1)])))).toEqual([
      "MISSING_LEGAL_BASIS",
      "MISSING_OWNER",
    ]);
  });

  it("requires a disposal method exactly when a rule is deletable", () => {
    const noDisposal = policy([reportRule({ deletable: true, disposalMethod: null }), ...DEFAULT_RETENTION_POLICY.rules.slice(1)]);
    expect(codes(validateRetentionPolicy(noDisposal))).toEqual(["MISSING_DISPOSAL"]);
    const unexpected = policy([reportRule({ deletable: false, disposalMethod: "secure_delete" }), ...DEFAULT_RETENTION_POLICY.rules.slice(1)]);
    expect(codes(validateRetentionPolicy(unexpected))).toEqual(["UNEXPECTED_DISPOSAL"]);
  });

  it("validates retention windows and metadata", () => {
    expect(codes(validateRetentionPolicy(policy([reportRule({ retentionDays: 0 }), ...DEFAULT_RETENTION_POLICY.rules.slice(1)])))).toEqual([
      "INVALID_RETENTION",
    ]);
    expect(codes(validateRetentionPolicy({ ...DEFAULT_RETENTION_POLICY, version: "", approvedBy: "", updatedAt: "soon" }))).toEqual([
      "INVALID_TIMESTAMP",
      "MISSING_APPROVER",
      "MISSING_VERSION",
    ]);
  });
});

describe("retention assessment", () => {
  it("counts days remaining and handles indefinite or unreadable windows", () => {
    expect(daysUntilExpiry(record(), reportRule({ retentionDays: 30 }), NOW)).toBe(23);
    expect(daysUntilExpiry(record({ createdAt: "2025-01-01T00:00:00Z" }), reportRule({ retentionDays: 30 }), NOW)).toBeLessThan(0);
    expect(daysUntilExpiry(record(), reportRule({ retentionDays: null }), NOW)).toBeNull();
    expect(daysUntilExpiry(record({ lastTouchedAt: "2026-03-28T00:00:00Z" }), reportRule({ retentionDays: 30 }), NOW)).toBe(26);
    expect(daysUntilExpiry(record({ createdAt: "not-a-date" }), reportRule({ retentionDays: 30 }), NOW)).toBeNull();
  });

  it("lets a legal hold win over expiry and immutability", () => {
    const result = assessRetention(
      reportRule({ retentionDays: 1 }),
      record({ createdAt: "2025-01-01T00:00:00Z", immutable: true }),
      NOW,
      [hold()],
    );
    expect(result).toMatchObject({ action: "blocked-by-hold", protectedBy: "legal-hold", holdId: "hold1", disposalMethod: null });
  });

  it("never disposes an immutable record or one on an active hold", () => {
    expect(assessRetention(reportRule({ retentionDays: 1 }), record({ immutable: true }), NOW, [])).toMatchObject({
      action: "blocked-immutable",
      protectedBy: "immutable",
      disposalMethod: null,
    });
    expect(assessRetention(reportRule({ retentionDays: 1 }), record(), NOW, [hold({ status: "released" })])).toMatchObject({
      action: "delete",
    });
  });

  it("retains inside the window, reviews on the closing day and deletes after expiry", () => {
    expect(assessRetention(reportRule(), record(), NOW, [])).toMatchObject({ action: "retain", retentionDaysRemaining: 23 });
    expect(assessRetention(reportRule({ retentionDays: 30 }), record({ createdAt: "2026-03-02T00:00:00Z" }), NOW, [])).toMatchObject({
      action: "review",
      retentionDaysRemaining: 0,
      disposalMethod: "secure_delete",
    });
    expect(assessRetention(reportRule({ retentionDays: 30 }), record({ createdAt: "2026-02-01T00:00:00Z" }), NOW, [])).toMatchObject({
      action: "delete",
      disposalMethod: "secure_delete",
    });
  });

  it("retains indefinitely or when the rule does not permit disposal", () => {
    expect(assessRetention(reportRule({ retentionDays: null }), record(), NOW, [])).toMatchObject({
      action: "retain",
      retentionDaysRemaining: null,
    });
    expect(
      assessRetention(reportRule({ retentionDays: 1, deletable: false, disposalMethod: null }), record({ createdAt: "2025-01-01T00:00:00Z" }), NOW, []),
    ).toMatchObject({ action: "retain", disposalMethod: null });
    expect(
      assessRetention(reportRule({ retentionDays: 1, deletable: true, disposalMethod: null }), record({ createdAt: "2025-01-01T00:00:00Z" }), NOW, []),
    ).toMatchObject({ action: "retain", disposalMethod: null });
  });

  it("ignores holds for a different category or subject", () => {
    expect(findActiveHold(record(), [hold({ categories: ["review"] })])).toBeUndefined();
    expect(findActiveHold(record(), [hold({ subjectId: "someone-else" })])).toBeUndefined();
    expect(findActiveHold(record({ id: "rec2" }), [hold({ subjectId: "rec2" })])).toBeDefined();
  });
});

describe("disposal planning", () => {
  it("separates deletable, retained, held and immutable records", () => {
    const expiredReport = record({ id: "rec-report", createdAt: "2025-01-01T00:00:00Z" });
    const immutableEvidence = record({ id: "rec-evidence", category: "evidence", createdAt: "2025-01-01T00:00:00Z", immutable: true });
    const liveReview = record({ id: "rec-review", category: "review", createdAt: "2026-03-25T00:00:00Z" });
    const heldProvider = record({ id: "rec-provider", category: "provider_result", createdAt: "2025-01-01T00:00:00Z" });
    const held = hold({ id: "hold-provider", subjectId: "rec-provider", categories: ["provider_result"] });

    const plan = planDisposal(
      policy([reportRule({ retentionDays: 30 }), ...DEFAULT_RETENTION_POLICY.rules.slice(1)]),
      [expiredReport, immutableEvidence, liveReview, heldProvider],
      [held],
      NOW,
    );
    expect(plan.deletable).toEqual([{ recordId: "rec-report", category: "report", disposalMethod: "secure_delete" }]);
    expect(plan.immutable).toEqual(["rec-evidence"]);
    expect(plan.blockedByHolds).toEqual(["hold-provider"]);
    expect(plan.retained.map((item) => item.recordId).sort()).toEqual(["rec-evidence", "rec-provider", "rec-review"]);
    expect(plan.generatedAt).toBe(NOW.toISOString());
  });

  it("retains records that have no rule at all", () => {
    const noProviderRule = policy(DEFAULT_RETENTION_POLICY.rules.filter((rule) => rule.category !== "provider_result"));
    const orphan = record({ id: "rec-provider", category: "provider_result", createdAt: "2025-01-01T00:00:00Z" });
    const plan = planDisposal(noProviderRule, [orphan], [], NOW);
    expect(plan.deletable).toEqual([]);
    expect(plan.immutable).toEqual(["rec-provider"]);
    expect(plan.retained[0]).toMatchObject({ action: "retain", protectedBy: "immutable" });
  });

  it("de-duplicates hold ids across multiple blocked records", () => {
    const held = hold({ subjectId: "subj1", categories: ["report"] });
    const plan = planDisposal(policy(), [record({ id: "a" }), record({ id: "b" })], [held], NOW);
    expect(plan.blockedByHolds).toEqual(["hold1"]);
  });
});

describe("deny-by-default evidence authorization", () => {
  const resource = { organizationId: "org1", subjectId: "subj1", recordId: "rec1", assignedIds: ["rev1"] };

  it("limits reviewers to assigned reads", () => {
    expect(decisionReason(authorizeEvidence(reviewer, "evidence.view", resource))).toBe("allowed");
    expect(decisionReason(authorizeEvidence({ ...reviewer, id: "rev2" }, "evidence.view", resource))).toBe("NOT_ASSIGNED");
    expect(decisionReason(authorizeEvidence(reviewer, "evidence.export", resource))).toBe("FORBIDDEN_FOR_ROLE");
    expect(decisionReason(authorizeEvidence(reviewer, "evidence.dispose", resource))).toBe("FORBIDDEN_FOR_ROLE");
  });

  it("separates safety review, disposal and hold release", () => {
    expect(decisionReason(authorizeEvidence(safety, "evidence.hold.place", resource))).toBe("allowed");
    expect(decisionReason(authorizeEvidence(safety, "evidence.dispose", resource))).toBe("FORBIDDEN_FOR_ROLE");
    expect(decisionReason(authorizeEvidence(safety, "evidence.hold.release", resource))).toBe("FORBIDDEN_FOR_ROLE");
    expect(decisionReason(authorizeEvidence(admin, "evidence.hold.release", resource))).toBe("allowed");
    expect(decisionReason(authorizeEvidence(admin, "evidence.dispose", resource))).toBe("allowed");
  });

  it("keeps auditors read-only and enforces the tenant boundary", () => {
    expect(decisionReason(authorizeEvidence(auditor, "evidence.view", resource))).toBe("allowed");
    expect(decisionReason(authorizeEvidence(auditor, "evidence.access_log_view", resource))).toBe("allowed");
    expect(decisionReason(authorizeEvidence(auditor, "evidence.export", resource))).toBe("FORBIDDEN_FOR_ROLE");
    expect(decisionReason(authorizeEvidence({ ...admin, organizationId: "org2" }, "evidence.dispose", resource))).toBe("TENANT_MISMATCH");
  });

  it("rejects unknown roles/actions and derives navigation actions", () => {
    expect(
      authorizeEvidence({ id: "x", role: "wizard" as never, organizationId: "org1" }, "evidence.view", resource),
    ).toEqual({ allowed: false, reason: "UNKNOWN_ROLE" });
    expect(authorizeEvidence(admin, "evidence.everything" as never, resource)).toEqual({ allowed: false, reason: "UNKNOWN_ACTION" });
    for (const role of ["reviewer", "safety_officer", "auditor"] as const) {
      expect(evidenceActionsFor(role).length).toBeLessThan(EVIDENCE_ACTIONS.length);
    }
    expect(evidenceActionsFor("organization_admin")).toHaveLength(EVIDENCE_ACTIONS.length);
    expect(evidenceActionsFor("reviewer")).toEqual(["evidence.view"]);
    expect(evidenceActionsFor("auditor")).toEqual(["evidence.access_log_view", "evidence.view"]);
  });
});

describe("legal holds", () => {
  it("places an active hold and replays retries", () => {
    const ledger = new Map();
    const request = { requestId: "h1", actor: safety, input: holdInput() };
    const first = placeLegalHold(request, [], ledger);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.hold).toMatchObject({ id: "hold1", status: "active", revision: 1, placedBy: "safe1", categories: ["report"] });
    expect(placeLegalHold(request, [], ledger)).toEqual({ ...first, replayed: true });
  });

  it("suppresses duplicate active holds and rejects duplicate ids", () => {
    expect(placeLegalHold({ requestId: "h1", actor: safety, input: holdInput({ id: "hold2" }) }, [hold()])).toEqual({
      ok: true,
      hold: hold(),
      replayed: true,
    });
    expect(placeLegalHold({ requestId: "h2", actor: safety, input: holdInput() }, [hold()])).toMatchObject({
      ok: false,
      code: "DUPLICATE_HOLD_ID",
    });
  });

  it("validates the hold and denies unauthorized or cross-tenant actors", () => {
    expect(placeLegalHold({ requestId: "h1", actor: reviewer, input: holdInput() }, [])).toMatchObject({
      ok: false,
      code: "NOT_AUTHORIZED",
      message: expect.stringContaining("FORBIDDEN_FOR_ROLE"),
    });
    expect(
      placeLegalHold({ requestId: "h2", actor: { ...safety, organizationId: "org2" }, input: holdInput() }, []),
    ).toMatchObject({ ok: false, code: "NOT_AUTHORIZED", message: expect.stringContaining("TENANT_MISMATCH") });
    expect(placeLegalHold({ requestId: "h3", actor: safety, input: holdInput({ categories: [] }) }, [])).toMatchObject({
      ok: false,
      code: "INVALID_HOLD",
      issues: [{ code: "NO_CATEGORIES" }],
    });
    expect(codes(validateLegalHoldInput(holdInput({ categories: ["report", "report"] })))).toEqual(["DUPLICATE_CATEGORY"]);
    expect(codes(validateLegalHoldInput(holdInput({ reason: "x".repeat(501) })))).toEqual(["INVALID_REASON"]);
  });

  it("releases a hold with a revision check and denies the wrong roles", () => {
    const ledger = new Map();
    const request = { requestId: "r1", actor: admin, expectedRevision: 1, now: "t2" };
    const first = releaseLegalHold(hold(), request, ledger);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.hold).toMatchObject({ status: "released", revision: 2, releasedAt: "t2", releasedBy: "adm1" });
    expect(releaseLegalHold(hold(), request, ledger)).toEqual({
      ...first,
      replayed: true,
    });
    expect(releaseLegalHold(hold(), { requestId: "r2", actor: safety, expectedRevision: 1, now: "t2" })).toMatchObject({
      ok: false,
      code: "NOT_AUTHORIZED",
    });
    expect(releaseLegalHold(hold(), { requestId: "r3", actor: admin, expectedRevision: 9, now: "t2" })).toMatchObject({
      ok: false,
      code: "STALE_REVISION",
    });
    expect(
      releaseLegalHold(hold({ status: "released", revision: 2 }), { requestId: "r4", actor: admin, expectedRevision: 2, now: "t2" }),
    ).toMatchObject({ ok: false, code: "INVALID_STATE" });
  });
});

describe("secure disposal", () => {
  it("disposes an expired record with its named method and replays retries", () => {
    const ledger = new Map();
    const request = { requestId: "d1", actor: admin, expectedRevision: 1, now: "t2" };
    const first = disposeEvidence(record(), assessment(), request, ledger);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.record).toMatchObject({
      status: "disposed",
      revision: 2,
      disposedAt: "t2",
      disposedBy: "adm1",
      disposalMethod: "secure_delete",
    });
    expect(disposeEvidence(record(), assessment(), request, ledger)).toEqual({ ...first, replayed: true });
  });

  it("refuses held, immutable, mismatched and live records", () => {
    expect(
      disposeEvidence(record(), assessment({ action: "blocked-by-hold", disposalMethod: null }), { requestId: "d1", actor: admin, expectedRevision: 1, now: "t" }),
    ).toMatchObject({ ok: false, code: "NOT_DISPOSABLE" });
    expect(
      disposeEvidence(record(), assessment({ action: "review" }), { requestId: "d2", actor: admin, expectedRevision: 1, now: "t" }),
    ).toMatchObject({ ok: false, code: "NOT_DISPOSABLE" });
    expect(
      disposeEvidence(record(), assessment({ recordId: "other" }), { requestId: "d3", actor: admin, expectedRevision: 1, now: "t" }),
    ).toMatchObject({ ok: false, code: "RECORD_MISMATCH" });
    expect(
      disposeEvidence(record({ status: "disposed" }), assessment(), { requestId: "d4", actor: admin, expectedRevision: 1, now: "t" }),
    ).toMatchObject({ ok: false, code: "INVALID_STATE" });
  });

  it("denies non-administrators and stale revisions", () => {
    expect(
      disposeEvidence(record(), assessment(), { requestId: "d1", actor: safety, expectedRevision: 1, now: "t" }),
    ).toMatchObject({ ok: false, code: "NOT_AUTHORIZED", message: expect.stringContaining("FORBIDDEN_FOR_ROLE") });
    expect(
      disposeEvidence(record(), assessment(), { requestId: "d2", actor: admin, expectedRevision: 9, now: "t" }),
    ).toMatchObject({ ok: false, code: "STALE_REVISION" });
  });
});

describe("access logging", () => {
  it("logs an authorized view with a private purpose and replays retries", () => {
    const ledger = new Map();
    const assigned = record({ assignedReviewerIds: ["rev1"] });
    const request = { requestId: "a1", actor: reviewer, action: "view", purpose: "case review", now: "t2" };
    const first = logEvidenceAccess(assigned, request, ledger);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.event).toMatchObject({
      id: "evt_a1",
      organizationId: "org1",
      recordId: "rec1",
      category: "report",
      actorId: "rev1",
      action: "view",
      purpose: "case review",
      at: "t2",
    });
    expect(logEvidenceAccess(assigned, request, ledger)).toEqual({ ...first, replayed: true });
  });

  it("logs exports for safety officers but not reviewers or auditors", () => {
    expect(resultCode(logEvidenceAccess(record(), { requestId: "a1", actor: safety, action: "export", now: "t" }))).toBe("allowed");
    expect(
      logEvidenceAccess(record(), { requestId: "a2", actor: reviewer, action: "export", now: "t" }),
    ).toMatchObject({ ok: false, code: "NOT_AUTHORIZED" });
    expect(
      logEvidenceAccess(record(), { requestId: "a3", actor: auditor, action: "export", now: "t" }),
    ).toMatchObject({ ok: false, code: "NOT_AUTHORIZED" });
  });

  it("rejects unknown actions, disposed records and overlong purposes", () => {
    expect(
      logEvidenceAccess(record(), { requestId: "a1", actor: safety, action: "telepathy", now: "t" }),
    ).toMatchObject({ ok: false, code: "INVALID_ACCESS" });
    expect(
      logEvidenceAccess(record({ status: "disposed" }), { requestId: "a2", actor: safety, action: "view", now: "t" }),
    ).toMatchObject({ ok: false, code: "INVALID_STATE" });
    expect(
      logEvidenceAccess(record(), { requestId: "a3", actor: safety, action: "view", purpose: "x".repeat(501), now: "t" }),
    ).toMatchObject({ ok: false, code: "PURPOSE_TOO_LONG" });
  });

  it("enforces the tenant boundary", () => {
    expect(
      logEvidenceAccess(record(), { requestId: "a1", actor: { ...safety, organizationId: "org2" }, action: "view", now: "t" }),
    ).toMatchObject({ ok: false, code: "NOT_AUTHORIZED", message: expect.stringContaining("TENANT_MISMATCH") });
  });
});

describe("privacy-safe audit and analytics", () => {
  const privateRecord = record({ subjectId: "secret-subject", immutable: false });
  const privateAssessment = assessment({ reason: "legal hold reason", disposalMethod: "secure_delete" });

  it("audits category/status/action only, never subjects, holds or actors", () => {
    const entry = evidenceAuditEntry(privateRecord, "evidence.disposed", at, privateAssessment);
    expect(entry).toEqual({
      eventType: "evidence.disposed",
      recordId: "rec1",
      organizationId: "org1",
      category: "report",
      status: "active",
      revision: 1,
      action: "delete",
      at,
    });
    const text = JSON.stringify(entry);
    for (const secret of ["secret-subject", "legal hold reason", "adm1", "safe1"]) expect(text).not.toContain(secret);
  });

  it("suppresses small retention groups and never includes subjects or ids", () => {
    const single = summarizeRetention([privateAssessment]);
    expect(single).toMatchObject({ total: 1, byCategory: [], byAction: [], suppressedCategories: 1, suppressedActions: 1 });

    const three = summarizeRetention([privateAssessment, privateAssessment, privateAssessment]);
    expect(ANALYTICS_MIN_GROUP).toBe(3);
    expect(three.byCategory).toEqual([{ category: "report", count: 3 }]);
    expect(three.byAction).toEqual([{ action: "delete", count: 3 }]);
    expect(three.suppressedCategories).toBe(0);

    const text = JSON.stringify(three);
    for (const secret of ["rec1", "secret-subject", "legal hold reason", "adm1"]) expect(text).not.toContain(secret);
  });

  it("suppresses small access groups and never includes actors or purposes", () => {
    const event: EvidenceAccessEvent = {
      id: "evt_1",
      organizationId: "org1",
      recordId: "rec1",
      category: "report",
      actorId: "rev1",
      action: "view",
      at,
      purpose: "private purpose",
    };
    const single = summarizeAccessEvents([event]);
    expect(single).toMatchObject({ total: 1, byAction: [], suppressedActions: 1 });

    const three = summarizeAccessEvents([event, event, event]);
    expect(three.byAction).toEqual([{ action: "view", count: 3 }]);
    const text = JSON.stringify(three);
    for (const secret of ["rev1", "private purpose", "rec1"]) expect(text).not.toContain(secret);
  });
});

