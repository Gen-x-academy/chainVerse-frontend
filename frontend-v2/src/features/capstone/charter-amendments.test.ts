import { describe, expect, it } from "vitest";
import { applyAmendment, approveAmendment, impactPreview, latestVersion, proposeAmendment, rejectAmendment, versionOn, withdrawAmendment, type AmendmentResult, type CharterHistory } from "./charter-amendments";

const base = (): CharterHistory => ({ versions: [{ version: 1, sections: { scope: "Original scope", data: "Original data rules" }, effectiveFrom: "2026-01-01" }], amendments: [] });
const input = { id: "a1", proposedBy: "u1", proposedAt: "2026-03-01T00:00:00.000Z", changes: { scope: "Wider scope" }, rationale: "New partner", requiredApprovers: ["u1", "u2"], effectiveOn: "2026-04-01T00:00:00.000Z", basedOnVersion: 1 };
const must = (r: AmendmentResult): CharterHistory => {
  if (!r.ok) throw new Error(r.code);
  return r.history;
};
const code = (r: AmendmentResult) => (r.ok ? "ok" : r.code);

describe("proposing", () => {
  it("shows the impact before and after", () => {
    expect(impactPreview(latestVersion(base()), { scope: "Wider scope", data: "Original data rules", extra: "x" })).toEqual([{ section: "scope", before: "Original scope", after: "Wider scope" }]);
  });

  it("refuses empty, unknown, stale and past-dated proposals", () => {
    expect(code(proposeAmendment(base(), { ...input, rationale: " " }))).toBe("needs_rationale");
    expect(code(proposeAmendment(base(), { ...input, changes: { scope: "Original scope" } }))).toBe("nothing_changed");
    expect(code(proposeAmendment(base(), { ...input, changes: { nope: "x" } }))).toBe("unknown_section");
    expect(code(proposeAmendment(base(), { ...input, basedOnVersion: 0 }))).toBe("stale_base");
    expect(code(proposeAmendment(base(), { ...input, effectiveOn: input.proposedAt }))).toBe("bad_effective_date");
  });

  it("allows one open amendment at a time", () => {
    const h = must(proposeAmendment(base(), input));
    expect(code(proposeAmendment(h, { ...input, id: "a2" }))).toBe("open_amendment_exists");
  });
});

describe("approvals", () => {
  it("needs every required approver", () => {
    let h = must(proposeAmendment(base(), input));
    h = must(approveAmendment(h, "a1", "u1"));
    expect(h.amendments[0]?.status).toBe("proposed");
    h = must(approveAmendment(h, "a1", "u2"));
    expect(h.amendments[0]?.status).toBe("approved");
  });

  it("ignores a repeated approval and refuses outsiders", () => {
    const h = must(approveAmendment(must(proposeAmendment(base(), input)), "a1", "u1"));
    expect(must(approveAmendment(h, "a1", "u1")).amendments[0]?.approvals).toEqual(["u1"]);
    expect(code(approveAmendment(h, "a1", "zz"))).toBe("not_an_approver");
    expect(code(approveAmendment(h, "nope", "u1"))).toBe("not_found");
  });

  it("can be rejected by an approver or withdrawn by its author", () => {
    const h = must(proposeAmendment(base(), input));
    expect(must(rejectAmendment(h, "a1", "u2")).amendments[0]).toMatchObject({ status: "rejected", rejectedBy: "u2" });
    expect(code(withdrawAmendment(h, "a1", "u2"))).toBe("not_an_approver");
    expect(must(withdrawAmendment(h, "a1", "u1")).amendments[0]?.status).toBe("withdrawn");
  });
});

describe("taking effect", () => {
  function approved(): CharterHistory {
    let h = must(proposeAmendment(base(), input));
    h = must(approveAmendment(h, "a1", "u1"));
    return must(approveAmendment(h, "a1", "u2"));
  }

  it("waits for approval and the effective date", () => {
    expect(code(applyAmendment(must(proposeAmendment(base(), input)), "a1", "2026-05-01T00:00:00.000Z"))).toBe("not_ready");
    expect(code(applyAmendment(approved(), "a1", "2026-03-15T00:00:00.000Z"))).toBe("not_ready");
  });

  it("adds a new version and leaves the old one untouched", () => {
    const before = approved();
    const after = must(applyAmendment(before, "a1", "2026-04-01T00:00:00.000Z"));
    expect(after.versions.map((v) => v.version)).toEqual([1, 2]);
    expect(after.versions[0]?.sections.scope).toBe("Original scope");
    expect(latestVersion(after).sections).toEqual({ scope: "Wider scope", data: "Original data rules" });
    expect(after.amendments[0]?.status).toBe("effective");
    expect(code(applyAmendment(after, "a1", "2026-04-02T00:00:00.000Z"))).toBe("wrong_state");
  });

  it("finds the version in force on a date", () => {
    const after = must(applyAmendment(approved(), "a1", "2026-04-01T00:00:00.000Z"));
    expect(versionOn(after, "2026-03-31")?.version).toBe(1);
    expect(versionOn(after, "2026-04-01")?.version).toBe(2);
    expect(versionOn(after, "2025-12-31")).toBeUndefined();
  });
});
