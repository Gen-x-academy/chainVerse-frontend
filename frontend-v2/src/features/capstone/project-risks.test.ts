import { describe, expect, it } from "vitest";
import { canView, dueForReview, rankRisks, riskRating, riskScore, summary, updateRisk, validateRisk, visibleRisks, type ProjectRisk } from "./project-risks";

const risk = (id: string, over: Partial<ProjectRisk> = {}): ProjectRisk => ({
  id,
  title: `Risk ${id}`,
  category: "technical",
  likelihood: 3,
  impact: 3,
  ownerId: "u1",
  mitigation: "Prototype early",
  contingency: "Use the fallback library",
  nextReviewOn: "2026-04-01",
  status: "open",
  visibility: "team",
  history: [],
  ...over,
});
const members = ["u1", "u2"];
const paths = (issues: { path: string }[]) => issues.map((i) => i.path);

describe("scoring", () => {
  it("multiplies likelihood and impact and rates the result", () => {
    expect(riskScore(risk("a", { likelihood: 4, impact: 5 }))).toBe(20);
    expect([riskRating(5), riskRating(6), riskRating(12), riskRating(20)]).toEqual(["low", "medium", "high", "critical"]);
  });
});

describe("validation", () => {
  it("accepts a complete risk", () => {
    expect(validateRisk(risk("a"), members)).toEqual([]);
  });

  it("needs a title, a team member as owner and a review date", () => {
    expect(paths(validateRisk(risk("a", { title: " ", ownerId: "zz", nextReviewOn: "soon" }), members))).toEqual(["title", "ownerId", "nextReviewOn"]);
  });

  it("needs mitigation while active and contingency above low scores", () => {
    expect(paths(validateRisk(risk("a", { mitigation: " ", contingency: "" }), members))).toEqual(["mitigation", "contingency"]);
    expect(validateRisk(risk("a", { likelihood: 1, impact: 2, contingency: "" }), members)).toEqual([]);
    expect(validateRisk(risk("a", { status: "closed", mitigation: "", contingency: "" }), members)).toEqual([]);
  });

  it("keeps sensitive categories off the whole-team view", () => {
    expect(paths(validateRisk(risk("a", { category: "funding", visibility: "team" }), members))).toEqual(["visibility"]);
    expect(validateRisk(risk("a", { category: "funding", visibility: "leads_and_supervisors" }), members)).toEqual([]);
  });
});

describe("updates and history", () => {
  it("records a score or status change", () => {
    const next = updateRisk(risk("a"), { likelihood: 5 }, "u2", "2026-03-10T00:00:00.000Z");
    expect(next.likelihood).toBe(5);
    expect(next.history).toEqual([{ at: "2026-03-10T00:00:00.000Z", by: "u2", likelihood: 5, impact: 3, status: "open" }]);
  });

  it("does not add history for text-only edits", () => {
    const next = updateRisk(risk("a"), { mitigation: "New plan" }, "u2", "2026-03-10T00:00:00.000Z");
    expect(next.mitigation).toBe("New plan");
    expect(next.history).toEqual([]);
  });

  it("leaves the original untouched", () => {
    const original = risk("a");
    updateRisk(original, { status: "closed" }, "u1", "2026-03-10T00:00:00.000Z");
    expect(original.status).toBe("open");
    expect(original.history).toEqual([]);
  });
});

describe("visibility", () => {
  const list = [risk("t"), risk("l", { visibility: "leads_and_supervisors", ownerId: "u2" }), risk("c", { visibility: "coordinators", ownerId: "u2" })];

  it("denies by default and widens by role", () => {
    expect(canView(list[0] as ProjectRisk, "outsider")).toBe(false);
    expect(visibleRisks(list, "team_member").map((r) => r.id)).toEqual(["t"]);
    expect(visibleRisks(list, "supervisor").map((r) => r.id)).toEqual(["t", "l"]);
    expect(visibleRisks(list, "coordinator").map((r) => r.id)).toEqual(["t", "l", "c"]);
  });

  it("always shows an owner their own risk", () => {
    expect(visibleRisks(list, "team_member", "u2").map((r) => r.id)).toEqual(["t", "l", "c"]);
  });
});

describe("register views", () => {
  const list = [risk("a", { likelihood: 2, impact: 2 }), risk("b", { likelihood: 5, impact: 5, nextReviewOn: "2026-03-01" }), risk("c", { likelihood: 5, impact: 5, nextReviewOn: "2026-02-01" }), risk("d", { status: "closed", nextReviewOn: "2026-01-01" })];

  it("ranks by score then review date", () => {
    expect(rankRisks(list).map((r) => r.id)).toEqual(["c", "b", "d", "a"]);
  });

  it("lists tracked risks that are due for review", () => {
    expect(dueForReview(list, "2026-03-15").map((r) => r.id)).toEqual(["b", "c"]);
  });

  it("counts tracked risks by rating", () => {
    expect(summary(list)).toEqual({ low: 1, medium: 0, high: 0, critical: 2 });
  });
});
