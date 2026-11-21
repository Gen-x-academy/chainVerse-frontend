import { describe, expect, it } from "vitest";
import { CHARTER_SECTIONS, REQUIRED_TERM_IDS, acceptTerm, canonicalText, changedSections, charterHash, emptyCharter, sealCharter, updateSection, validateDraft, validateForSeal, type Charter } from "./project-charters";

const current = { "code-of-conduct": 2, "ip-policy": 1, "data-policy": 1 };

function complete(): Charter {
  let c = emptyCharter("ch1", "p1");
  for (const s of CHARTER_SECTIONS) c = updateSection(c, s, `The ${s} section of this project is described here in full.`);
  for (const id of REQUIRED_TERM_IDS) c = acceptTerm(c, { termId: id, version: current[id] });
  return c;
}
const paths = (issues: { path: string }[]) => issues.map((i) => i.path);

describe("drafting", () => {
  it("allows blank sections while drafting", () => {
    expect(validateDraft(emptyCharter("ch1", "p1"))).toEqual([]);
  });

  it("rejects over-long sections and repeated or bad terms", () => {
    let c = updateSection(emptyCharter("ch1", "p1"), "scope", "x".repeat(5001));
    c = { ...c, acceptedTerms: [{ termId: "a", version: 1 }, { termId: "a", version: 0 }] };
    expect(paths(validateDraft(c))).toEqual(["sections.scope", "acceptedTerms[1]", "acceptedTerms[1].version"]);
  });

  it("replaces an earlier acceptance of the same term", () => {
    const c = acceptTerm(acceptTerm(emptyCharter("ch1", "p1"), { termId: "ip-policy", version: 1 }), { termId: "ip-policy", version: 2 });
    expect(c.acceptedTerms).toEqual([{ termId: "ip-policy", version: 2 }]);
  });
});

describe("sealing", () => {
  it("seals a complete charter", () => {
    const { charter, issues } = sealCharter(complete(), current, "2026-03-01T00:00:00.000Z");
    expect(issues).toEqual([]);
    expect(charter).toMatchObject({ status: "sealed", sealedAt: "2026-03-01T00:00:00.000Z" });
  });

  it("lists short sections and missing terms", () => {
    const c = updateSection(complete(), "funding", "short");
    expect(paths(validateForSeal(c, current))).toEqual(["sections.funding"]);
    expect(paths(validateForSeal(emptyCharter("ch1", "p1"), current))).toHaveLength(CHARTER_SECTIONS.length + REQUIRED_TERM_IDS.length);
  });

  it("asks for the current version of a changed term", () => {
    expect(paths(validateForSeal(complete(), { ...current, "ip-policy": 2 }))).toEqual(["acceptedTerms"]);
  });

  it("cannot be edited once sealed", () => {
    const sealed = sealCharter(complete(), current, "2026-03-01T00:00:00.000Z").charter;
    expect(updateSection(sealed, "scope", "A different scope entirely, written later.")).toBe(sealed);
    expect(acceptTerm(sealed, { termId: "ip-policy", version: 9 })).toBe(sealed);
  });
});

describe("hashing and comparison", () => {
  it("gives equal charters the same hash and changes it when content changes", async () => {
    const a = complete();
    const b = { ...complete(), acceptedTerms: [...complete().acceptedTerms].reverse() };
    expect(canonicalText(a)).toBe(canonicalText(b));
    const h = await charterHash(a);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await charterHash(b)).toBe(h);
    expect(await charterHash(updateSection(a, "scope", "A changed scope that is long enough."))).not.toBe(h);
  });

  it("lists the sections that differ", () => {
    const a = complete();
    const b = updateSection(updateSection(a, "data", "New data handling rules, written out in full."), "conduct", a.sections.conduct + " ");
    expect(changedSections(a, b)).toEqual(["data"]);
  });
});
