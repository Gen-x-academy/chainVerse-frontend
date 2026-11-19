import { describe, expect, it } from "vitest";
import { calculateReadiness, MIN_SIGNAL_ITEMS, type ReadinessInput } from "./profile-readiness";

const full: ReadinessInput = {
  displayName: "Ada Okoye",
  skills: ["rust", "ts", "stats"],
  interests: ["open science"],
  availabilityHours: 10,
  portfolioCount: 2,
  preferredRoles: ["developer"],
  identityVerified: true,
};

describe("profile readiness", () => {
  it("scores a complete profile as ready with every item explained", () => {
    const r = calculateReadiness(full);
    expect(r).toMatchObject({ status: "ready", percent: 100, nextSteps: [], eligibility: { canApply: true, blockers: [] } });
    expect(r.items.every((i) => i.met && i.reason.length > 0)).toBe(true);
    expect(r.items.reduce((n, i) => n + i.weight, 0)).toBe(100);
  });

  it("does not show a score for sparse data", () => {
    const r = calculateReadiness({ displayName: "Ada" });
    expect(r.status).toBe("insufficient_data");
    expect(r.percent).toBeNull();
    expect(MIN_SIGNAL_ITEMS).toBe(2);
    expect(r.nextSteps[0]).toBe("At least 3 skills"); // most valuable first
    expect(calculateReadiness({}).percent).toBeNull();
  });

  it("reports an incomplete profile with weighted next steps", () => {
    const r = calculateReadiness({ displayName: "Ada Okoye", skills: ["a", "b", "c"], interests: ["x"] });
    expect(r.status).toBe("incomplete");
    expect(r.percent).toBe(50);
    expect(r.nextSteps).toEqual(["A portfolio item", "Weekly availability", "A preferred role"]);
  });

  it("keeps eligibility separate from completeness and explains blockers", () => {
    const r = calculateReadiness({ ...full, identityVerified: false });
    expect(r.status).toBe("ready");
    expect(r.eligibility).toEqual({ canApply: false, blockers: ["Identity is not verified yet."] });
    const noSkills = calculateReadiness({ ...full, skills: ["a"] });
    expect(noSkills.eligibility.blockers).toContain("Add at least 3 skills to apply.");
  });

  it("never reads unknown or protected fields", () => {
    const base = calculateReadiness(full);
    const withExtras = calculateReadiness({ ...full, age: 17, gender: "x", nationality: "y", disability: true, healthNotes: "z" });
    expect(withExtras).toEqual(base);
  });

  it("is deterministic and ignores whitespace-only entries", () => {
    expect(calculateReadiness(full)).toEqual(calculateReadiness({ ...full }));
    expect(calculateReadiness({ ...full, skills: ["a", " ", "b"] }).items.find((i) => i.id === "skills")?.met).toBe(false);
  });
});
