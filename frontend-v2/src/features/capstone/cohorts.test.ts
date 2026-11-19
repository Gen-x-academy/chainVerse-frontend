import { describe, expect, it } from "vitest";
import { assignToCohort, cohortPhase, groupByCohort, validateCohort, type CohortInput } from "./cohorts";

const cohort = (): CohortInput => ({
  id: "co_2026_fall",
  program: "BSc Computer Science",
  term: "fall",
  year: 2026,
  intakeOpensOn: "2026-06-01",
  intakeClosesOn: "2026-07-31",
  capacity: 2,
  coordinators: ["u1", "u2"],
  deadlines: { applications: "2026-07-15", teamFormation: "2026-09-01", midReview: "2026-11-01", finalSubmission: "2027-01-15" },
});

describe("cohorts and academic periods", () => {
  it("accepts a consistent cohort", () => {
    expect(validateCohort(cohort())).toEqual([]);
  });

  it("reports field-level issues", () => {
    const issues = validateCohort({ ...cohort(), program: " ", term: "monsoon" as never, year: 1999, capacity: 0, coordinators: ["u1", "u1"] });
    expect(issues.map((i) => i.field).sort()).toEqual(["capacity", "coordinators", "program", "term", "year"]);
    expect(validateCohort({ ...cohort(), coordinators: [] }).map((i) => i.field)).toEqual(["coordinators"]);
  });

  it("rejects non-dates and impossible dates", () => {
    const bad = validateCohort({ ...cohort(), intakeOpensOn: "2026-02-30", deadlines: { ...cohort().deadlines, midReview: "next week" } });
    expect(bad.map((i) => i.field).sort()).toEqual(["deadlines.midReview", "intakeOpensOn"]);
  });

  it("requires the timeline to be strictly ordered", () => {
    const wrong = validateCohort({ ...cohort(), deadlines: { ...cohort().deadlines, teamFormation: "2026-07-01" } });
    expect(wrong.map((i) => i.field)).toContain("deadlines.teamFormation");
    expect(validateCohort({ ...cohort(), intakeClosesOn: "2026-05-01" }).map((i) => i.field)).toContain("intakeClosesOn");
  });

  it("assigns projects up to capacity and rejects duplicates and wrong cohorts", () => {
    const c = cohort();
    const first = assignToCohort(c, [], { id: "p1", cohortId: c.id });
    expect(first).toEqual({ ok: true, assigned: ["p1"] });
    const second = assignToCohort(c, ["p1"], { id: "p2", cohortId: c.id });
    expect(second).toEqual({ ok: true, assigned: ["p1", "p2"] });
    expect(assignToCohort(c, ["p1", "p2"], { id: "p3", cohortId: c.id })).toEqual({ ok: false, code: "COHORT_FULL" });
    expect(assignToCohort(c, ["p1"], { id: "p1", cohortId: c.id })).toEqual({ ok: false, code: "ALREADY_ASSIGNED" });
    expect(assignToCohort(c, [], { id: "p1", cohortId: "other" })).toEqual({ ok: false, code: "WRONG_COHORT" });
  });

  it("derives the phase from cohort-specific deadlines", () => {
    const c = cohort();
    const at = (d: string) => cohortPhase(c, d);
    expect(at("2026-05-31")).toBe("before_intake");
    expect(at("2026-06-01")).toBe("intake");
    expect(at("2026-07-15")).toBe("intake");
    expect(at("2026-07-16")).toBe("applications_closed");
    expect(at("2026-08-15")).toBe("team_formation");
    expect(at("2026-10-01")).toBe("in_progress");
    expect(at("2026-12-01")).toBe("final_review");
    expect(at("2027-01-16")).toBe("ended");
  });

  it("groups projects by cohort keeping order", () => {
    const grouped = groupByCohort([
      { id: "a", cohortId: "x" },
      { id: "b", cohortId: "y" },
      { id: "c", cohortId: "x" },
    ]);
    expect(grouped.get("x")?.map((p) => p.id)).toEqual(["a", "c"]);
    expect(grouped.get("y")?.map((p) => p.id)).toEqual(["b"]);
  });
});
