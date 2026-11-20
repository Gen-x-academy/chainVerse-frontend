import { describe, expect, it } from "vitest";
import { decide, findGroupConflicts, findReviewerConflicts, type Relationship } from "./conflict-of-interest";

const now = new Date("2026-06-01T00:00:00.000Z");
const rel = (id: string, a: string, b: string, kind: Relationship["kind"], endedOn?: string): Relationship => ({ id, between: [a, b], kind, ...(endedOn ? { endedOn } : {}) });

describe("group conflicts", () => {
  it("finds ties between any two people, in either order", () => {
    const found = findGroupConflicts(["u1", "u2", "s1"], [rel("r1", "s1", "u1", "grading"), rel("r2", "u2", "x9", "family")], now);
    expect(found.map((c) => c.relationshipId)).toEqual(["r1"]);
    expect(found[0]).toMatchObject({ severity: "blocking", kind: "grading" });
  });

  it("ignores ties that ended before the lookback window", () => {
    const old = rel("r1", "u1", "u2", "employment", "2022-01-01");
    const recent = rel("r2", "u1", "u2", "employment", "2025-01-01");
    expect(findGroupConflicts(["u1", "u2"], [old], now)).toEqual([]);
    expect(findGroupConflicts(["u1", "u2"], [recent], now)).toHaveLength(1);
  });

  it("does not repeat a person who is listed twice", () => {
    expect(findGroupConflicts(["u1", "u1", "u2"], [rel("r1", "u1", "u2", "sponsor")], now)).toHaveLength(1);
  });

  it("does not put the private detail in the message", () => {
    const [c] = findGroupConflicts(["u1", "u2"], [rel("r1", "u1", "u2", "financial")], now);
    expect(c?.message).toBe("These two people have a financial tie.");
  });
});

describe("reviewer conflicts", () => {
  it("flags a reviewer who is on the team", () => {
    const found = findReviewerConflicts("u1", ["u1", "u2"], [], now);
    expect(found).toHaveLength(1);
    expect(found[0]?.severity).toBe("blocking");
  });

  it("flags ties with any team member", () => {
    const found = findReviewerConflicts("r1", ["u1", "u2"], [rel("x", "u2", "r1", "supervision")], now);
    expect(found.map((c) => c.relationshipId)).toEqual(["x"]);
  });
});

describe("decision", () => {
  it("is clear with no conflicts", () => {
    expect(decide([])).toEqual({ status: "clear", conflicts: [] });
  });

  it("blocks on blocking ties even if approved", () => {
    const conflicts = findGroupConflicts(["u1", "u2"], [rel("r1", "u1", "u2", "family")], now);
    expect(decide(conflicts, ["r1"]).status).toBe("blocked");
  });

  it("sends declared ties to review until a coordinator approves", () => {
    const conflicts = findGroupConflicts(["u1", "u2"], [rel("r1", "u1", "u2", "declared")], now);
    expect(decide(conflicts).status).toBe("needs_review");
    expect(decide(conflicts, ["r1"])).toEqual({ status: "clear", conflicts: [] });
  });
});
