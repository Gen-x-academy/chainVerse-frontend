import { describe, expect, it } from "vitest";
import {
  ancestors,
  buildTaxonomy,
  descendants,
  filterId,
  filterMatches,
  meetsProficiency,
  parseFilterId,
  resolveTerm,
  type TaxonomyNodeInput,
} from "./expertise-taxonomy";

const nodes: TaxonomyNodeInput[] = [
  { id: "stats", label: "Statistics", kind: "method", aliases: ["stats"] },
  { id: "stats.bayesian", label: "Bayesian Statistics", kind: "method", parentId: "stats", aliases: ["bayes"] },
  { id: "stats.freq", label: "Frequentist Statistics", kind: "method", parentId: "stats", deprecated: { replacedBy: "stats" } },
  { id: "bio", label: "Biology", kind: "discipline" },
  { id: "bio.genomics", label: "Genomics", kind: "discipline", parentId: "bio" },
];

function build(list = nodes) {
  const r = buildTaxonomy(list);
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.taxonomy;
}

describe("expertise taxonomy", () => {
  it("builds a valid hierarchy and exposes ancestors and descendants", () => {
    const t = build();
    expect(ancestors(t, "stats.bayesian")).toEqual(["stats"]);
    expect(descendants(t, "stats")).toEqual(["stats.bayesian", "stats.freq"]);
    expect(descendants(t, "bio.genomics")).toEqual([]);
  });

  it("resolves labels and aliases case-insensitively", () => {
    const t = build();
    expect(resolveTerm(t, "  BAYES ")?.id).toBe("stats.bayesian");
    expect(resolveTerm(t, "genomics")?.id).toBe("bio.genomics");
    expect(resolveTerm(t, "astrology")).toBeUndefined();
  });

  it("resolves a deprecated node to its replacement", () => {
    expect(resolveTerm(build(), "Frequentist Statistics")?.id).toBe("stats");
  });

  it("reports every structural problem", () => {
    const r = buildTaxonomy([
      { id: "A Bad Id", label: "x", kind: "method" },
      { id: "a", label: "Dup", kind: "method" },
      { id: "a", label: "Dup2", kind: "method" },
      { id: "orphan", label: "Orphan", kind: "method", parentId: "missing" },
      { id: "mixed", label: "Mixed", kind: "method", parentId: "bio" },
      { id: "bio", label: "Biology", kind: "discipline" },
      { id: "t1", label: "Same", kind: "method" },
      { id: "t2", label: "same", kind: "method" },
      { id: "gone", label: "Gone", kind: "method", deprecated: { replacedBy: "nope" } },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const text = r.issues.map((i) => `${i.id}:${i.message}`).join("|");
      for (const part of ["lowercase slug", "duplicate id", "parent missing", "same kind", "already used", "replacement nope"]) expect(text).toContain(part);
    }
  });

  it("detects parent cycles", () => {
    const r = buildTaxonomy([
      { id: "a", label: "A", kind: "method", parentId: "b" },
      { id: "b", label: "B", kind: "method", parentId: "a" },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some((i) => /cycle/.test(i.message))).toBe(true);
  });

  it("uses stable filter identifiers that match a node and its subtree", () => {
    const t = build();
    expect(filterId("stats")).toBe("tax:stats");
    expect(parseFilterId("tax:stats.bayesian")).toBe("stats.bayesian");
    expect(parseFilterId("stats")).toBeNull();
    expect(parseFilterId("tax:Bad Id")).toBeNull();
    expect(filterMatches(t, "tax:stats", "stats.bayesian")).toBe(true);
    expect(filterMatches(t, "tax:stats.bayesian", "stats")).toBe(false);
    expect(filterMatches(t, "tax:unknown", "stats")).toBe(false);
  });

  it("orders proficiency levels", () => {
    expect(meetsProficiency("advanced", "working")).toBe(true);
    expect(meetsProficiency("novice", "working")).toBe(false);
    expect(meetsProficiency("expert", "expert")).toBe(true);
  });
});
