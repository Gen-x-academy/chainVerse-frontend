import { describe, expect, it } from "vitest";
import { advanceDeletion, canOpen, isPastRetention, retainUntil, submissionBlockers, validateAttachment, validateAttachmentList, type AttachmentRef } from "./proposal-attachments";

const hash = (c: string) => c.repeat(64);
const ref = (id: string, over: Partial<AttachmentRef> = {}): AttachmentRef => ({
  id,
  proposalId: "p1",
  name: "evidence.pdf",
  purpose: "evidence",
  mimeType: "application/pdf",
  sizeBytes: 2048,
  sha256: hash("a"),
  consentGiven: true,
  scanState: "clean",
  accessPolicy: "assigned_reviewers",
  retentionDays: 365,
  addedAt: "2026-01-01T00:00:00.000Z",
  deletionStatus: "active",
  ...over,
});
const paths = (issues: { path: string }[]) => issues.map((i) => i.path);

describe("attachment validation", () => {
  it("accepts a complete reference", () => {
    expect(validateAttachment(ref("a1"))).toEqual([]);
  });

  it("rejects bad type, size, hash, consent and retention", () => {
    const issues = validateAttachment(ref("a1", { mimeType: "application/zip", sizeBytes: 0, sha256: "xyz", consentGiven: false, retentionDays: 1 }));
    expect(paths(issues)).toEqual(["mimeType", "sizeBytes", "sha256", "consentGiven", "retentionDays"]);
  });

  it("rejects file names with folders", () => {
    expect(paths(validateAttachment(ref("a1", { name: "../secret.pdf" })))).toEqual(["name"]);
  });

  it("rejects the same file attached twice", () => {
    expect(paths(validateAttachmentList([ref("a1"), ref("a2")]))).toEqual(["attachments.a2"]);
    expect(validateAttachmentList([ref("a1"), ref("a2", { sha256: hash("b") })])).toEqual([]);
  });
});

describe("scan state and access", () => {
  it("blocks submission until every active file is clean", () => {
    const refs = [ref("a1"), ref("a2", { sha256: hash("b"), scanState: "pending" }), ref("a3", { sha256: hash("c"), scanState: "infected" }), ref("a4", { sha256: hash("d"), scanState: "failed", deletionStatus: "deleted" })];
    expect(paths(submissionBlockers(refs))).toEqual(["attachments.a2", "attachments.a3"]);
  });

  it("denies by default", () => {
    const r = ref("a1");
    expect(canOpen(r, "other")).toBe(false);
    expect(canOpen(r, "assigned_reviewer")).toBe(true);
    expect(canOpen(r, "owner")).toBe(true);
    expect(canOpen(ref("a2", { accessPolicy: "team_only" }), "call_owner")).toBe(false);
    expect(canOpen(ref("a3", { accessPolicy: "call_owner" }), "assigned_reviewer")).toBe(false);
  });

  it("never opens an unscanned or deleted file", () => {
    expect(canOpen(ref("a1", { scanState: "pending" }), "owner")).toBe(false);
    expect(canOpen(ref("a2", { deletionStatus: "pending_deletion" }), "owner")).toBe(false);
  });
});

describe("retention and deletion", () => {
  it("computes the retention date", () => {
    const r = ref("a1", { retentionDays: 30 });
    expect(retainUntil(r)).toBe("2026-01-31T00:00:00.000Z");
    expect(isPastRetention(r, new Date("2026-01-30T23:59:59.000Z"))).toBe(false);
    expect(isPastRetention(r, new Date("2026-01-31T00:00:00.000Z"))).toBe(true);
  });

  it("only moves deletion forward", () => {
    const pending = advanceDeletion(ref("a1"), "pending_deletion");
    expect(pending.deletionStatus).toBe("pending_deletion");
    expect(advanceDeletion(pending, "active").deletionStatus).toBe("pending_deletion");
    expect(advanceDeletion(pending, "deleted").deletionStatus).toBe("deleted");
  });
});
