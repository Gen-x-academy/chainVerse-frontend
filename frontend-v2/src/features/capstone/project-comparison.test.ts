import { describe, expect, it } from "vitest";
import { MAX_COMPARED, addToComparison, compareOpportunities, type ComparableOpportunity } from "./project-comparison";

const o = (id: string, over: Partial<ComparableOpportunity> = {}): ComparableOpportunity => ({
  id,
  title: `Project ${id}`,
  skills: ["Python", "Statistics"],
  startsOn: "2026-09-01",
  endsOn: "2027-01-31",
  mode: "in_person",
  fundingMinor: "100000",
  currency: "USD",
  teamSize: { min: 3, max: 5 },
  prerequisites: ["Stats 101"],
  trustSignals: ["sponsor-verified"],
  ...over,
});
const rowOf = (r: ReturnType<typeof compareOpportunities>, key: string) => {
  if (!r.ok) throw new Error(r.error);
  const found = r.rows.find((x) => x.key === key);
  if (!found) throw new Error(key);
  return found;
};

describe("project comparison", () => {
  it("compares two to four opportunities and rejects other sizes and duplicates", () => {
    expect(compareOpportunities([o("a")])).toEqual({ ok: false, error: "TOO_FEW" });
    expect(compareOpportunities(Array.from({ length: MAX_COMPARED + 1 }, (_, i) => o(`x${i}`)))).toEqual({ ok: false, error: "TOO_MANY" });
    expect(compareOpportunities([o("a"), o("a")])).toEqual({ ok: false, error: "DUPLICATE" });
    expect(compareOpportunities([o("a"), o("b")]).ok).toBe(true);
  });

  it("produces every row and flags only the rows that differ", () => {
    const r = compareOpportunities([o("a"), o("b", { mode: "remote", prerequisites: [] })]);
    if (!r.ok) throw new Error();
    expect(r.rows.map((x) => x.key)).toEqual(["skills", "schedule", "mode", "funding", "teamSize", "prerequisites", "trustSignals"]);
    expect(r.rows.filter((x) => x.differs).map((x) => x.key)).toEqual(["mode", "prerequisites"]);
    expect(rowOf(r, "mode").cells.map((c) => c.display)).toEqual(["in-person", "remote"]);
    expect(rowOf(r, "prerequisites").cells[1].display).toBe("None");
  });

  it("normalizes skills and reports the ones all share", () => {
    const r = compareOpportunities([o("a", { skills: ["Python", " Statistics "] }), o("b", { skills: ["statistics", "R"] })]);
    if (!r.ok) throw new Error();
    expect(r.commonSkills).toEqual(["statistics"]);
    expect(rowOf(r, "skills").cells[0].display).toBe("python, statistics");
  });

  it("highlights the highest funding (exact) and earliest start, with no overall winner", () => {
    const r = compareOpportunities([o("a", { fundingMinor: "99999999999999999999" }), o("b", { fundingMinor: "100000000000000000000", startsOn: "2026-08-01" }), o("c", { fundingMinor: undefined })]);
    expect(rowOf(r, "funding").cells.map((c) => c.highlight)).toEqual([false, true, false]);
    expect(rowOf(r, "funding").cells[2].display).toBe("Unfunded");
    expect(rowOf(r, "schedule").cells.map((c) => c.highlight)).toEqual([false, true, false]);
    if (!r.ok) throw new Error();
    expect(JSON.stringify(r)).not.toMatch(/winner|score|rank/i);
  });

  it("does not highlight funding across different currencies", () => {
    const r = compareOpportunities([o("a", { currency: "USD" }), o("b", { currency: "EUR", fundingMinor: "900000" })]);
    expect(rowOf(r, "funding").cells.every((c) => !c.highlight)).toBe(true);
  });

  it("formats team size and titles", () => {
    const r = compareOpportunities([o("a", { teamSize: { min: 4, max: 4 } }), o("b")]);
    expect(rowOf(r, "teamSize").cells.map((c) => c.display)).toEqual(["4", "3-5"]);
    if (r.ok) expect(r.titles).toEqual({ a: "Project a", b: "Project b" });
  });

  it("manages the comparison set within its limit", () => {
    expect(addToComparison(["a"], "b")).toEqual({ ok: true, ids: ["a", "b"] });
    expect(addToComparison(["a"], "a")).toEqual({ ok: false, error: "DUPLICATE" });
    expect(addToComparison(["a", "b", "c", "d"], "e")).toEqual({ ok: false, error: "FULL" });
  });
});
