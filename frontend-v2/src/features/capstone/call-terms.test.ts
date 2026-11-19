import { describe, expect, it } from "vitest";
import {
  acceptTerms,
  acceptanceIsCurrent,
  diffTerms,
  emptyHistory,
  latestTerms,
  publishTerms,
  termsVersion,
  validateTerms,
  verifyTermsVersion,
  type CallTerms,
} from "./call-terms";

const terms = (over: Partial<CallTerms> = {}): CallTerms => ({
  eligibility: "Final-year students in good standing.",
  evaluation: "Proposals are scored on rigor and feasibility.",
  ip: "Participants keep authorship; the sponsor gets a license.",
  conduct: "Follow the institution's research code of conduct.",
  data: "Datasets must be shareable under an open licence.",
  funding: "Funds are released per milestone.",
  publication: "Results are published openly after review.",
  completion: "Projects finish with a final report and demo.",
  ...over,
});

describe("call terms versioning", () => {
  it("snapshots all sections as version 1 with a digest", async () => {
    const r = await publishTerms(emptyHistory("cal_1"), terms(), "2026-02-01");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.created).toBe(true);
      expect(r.version).toMatchObject({ version: 1, publishedOn: "2026-02-01" });
      expect(r.version.digest).toMatch(/^[0-9a-f]{64}$/);
      expect(r.history.versions).toHaveLength(1);
    }
  });

  it("creates a new version only when the text changes (idempotent publish)", async () => {
    const h0 = emptyHistory("cal_1");
    const a = await publishTerms(h0, terms(), "2026-02-01");
    if (!a.ok) throw new Error("invalid");
    const same = await publishTerms(a.history, terms({ ip: terms().ip + "  \r\n" }), "2026-02-02");
    expect(same).toMatchObject({ ok: true, created: false });
    if (same.ok) expect(same.history.versions).toHaveLength(1);
    const changed = await publishTerms(a.history, terms({ funding: "Funds are released in one payment." }), "2026-02-10");
    if (!changed.ok) throw new Error("invalid");
    expect(changed.version.version).toBe(2);
    expect(changed.history.versions).toHaveLength(2);
    expect(a.history.versions).toHaveLength(1); // earlier history untouched
  });

  it("keeps earlier versions immutable and retrievable", async () => {
    const a = await publishTerms(emptyHistory("c"), terms(), "2026-02-01");
    if (!a.ok) throw new Error();
    const b = await publishTerms(a.history, terms({ ip: "All rights belong to the participants." }), "2026-03-01");
    if (!b.ok) throw new Error();
    expect(termsVersion(b.history, 1)?.terms.ip).toBe(terms().ip);
    expect(latestTerms(b.history)?.version).toBe(2);
    expect(diffTerms(b.history.versions[0], b.history.versions[1])).toEqual(["ip"]);
  });

  it("detects tampering with a stored version", async () => {
    const a = await publishTerms(emptyHistory("c"), terms(), "2026-02-01");
    if (!a.ok) throw new Error();
    expect(await verifyTermsVersion(a.version)).toBe(true);
    expect(await verifyTermsVersion({ ...a.version, terms: { ...a.version.terms, ip: "changed" } })).toBe(false);
  });

  it("rejects missing, short or oversized sections", async () => {
    expect(validateTerms({}).map((i) => i.section)).toHaveLength(8);
    const r = await publishTerms(emptyHistory("c"), terms({ data: "short", ip: "x".repeat(8001) }), "2026-02-01");
    expect(r).toMatchObject({ ok: false, code: "INVALID_TERMS" });
    if (!r.ok) expect(r.issues.map((i) => i.section).sort()).toEqual(["data", "ip"]);
  });

  it("binds acceptance to a version and requires re-acceptance after a new version", async () => {
    const a = await publishTerms(emptyHistory("c"), terms(), "2026-02-01");
    if (!a.ok) throw new Error();
    const acceptance = acceptTerms(a.history, "stu1", 1);
    expect(acceptance).toMatchObject({ applicantId: "stu1", version: 1, callId: "c" });
    expect(acceptTerms(a.history, "stu1", 9)).toBeNull();
    if (!acceptance) throw new Error();
    expect(acceptanceIsCurrent(a.history, acceptance)).toBe(true);
    const b = await publishTerms(a.history, terms({ conduct: "Updated conduct requirements apply." }), "2026-03-01");
    if (!b.ok) throw new Error();
    expect(acceptanceIsCurrent(b.history, acceptance)).toBe(false);
  });
});
