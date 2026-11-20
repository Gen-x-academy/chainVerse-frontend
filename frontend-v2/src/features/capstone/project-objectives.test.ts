import { describe, expect, it } from "vitest";
import {
  MAX_OBJECTIVES,
  objectiveProgress,
  prioritize,
  validateObjective,
  validateObjectiveSet,
  visibleObjectives,
  type Objective,
  type ObjectiveContext,
} from "./project-objectives";

const ctx: ObjectiveContext = { memberIds: ["u1", "u2"], window: { startsOn: "2026-04-01", endsOn: "2026-09-01" }, charterClauseIds: ["c1", "c2"] };
const obj = (over: Partial<Objective> = {}): Objective => ({
  id: "o1",
  title: "Publish the open dataset",
  priority: "must",
  ownerId: "u1",
  baseline: 0,
  target: 100,
  unit: "datasets",
  direction: "increase",
  startsOn: "2026-04-15",
  dueOn: "2026-08-15",
  visibility: "team",
  charterClauseId: "c1",
  ...over,
});
const fields = (issues: { field: string }[]) => issues.map((i) => i.field).sort();

describe("project objectives", () => {
  it("accepts a measurable objective inside the project window", () => {
    expect(validateObjective(obj(), ctx)).toEqual([]);
  });

  it("requires a title of 5 to 120 characters and a unit", () => {
    expect(fields(validateObjective(obj({ title: "abc" }), ctx))).toEqual(["title"]);
    expect(fields(validateObjective(obj({ title: "x".repeat(121) }), ctx))).toEqual(["title"]);
    expect(fields(validateObjective(obj({ unit: "  " }), ctx))).toEqual(["unit"]);
    expect(fields(validateObjective(obj({ unit: "x".repeat(21) }), ctx))).toEqual(["unit"]);
  });

  it("makes the target differ from the baseline in the stated direction", () => {
    expect(fields(validateObjective(obj({ baseline: 10, target: 10 }), ctx))).toEqual(["target"]);
    expect(fields(validateObjective(obj({ baseline: 10, target: 5 }), ctx))).toEqual(["target"]);
    expect(validateObjective(obj({ baseline: 10, target: 2, direction: "decrease" }), ctx)).toEqual([]);
    expect(fields(validateObjective(obj({ baseline: 2, target: 10, direction: "decrease" }), ctx))).toEqual(["target"]);
    expect(fields(validateObjective(obj({ baseline: Number.NaN }), ctx))).toEqual(["baseline"]);
    expect(fields(validateObjective(obj({ target: Number.POSITIVE_INFINITY }), ctx))).toEqual(["target"]);
  });

  it("requires an owner who is on the team", () => {
    expect(fields(validateObjective(obj({ ownerId: "stranger" }), ctx))).toEqual(["ownerId"]);
  });

  it("checks dates are real, ordered and inside the project window", () => {
    expect(fields(validateObjective(obj({ dueOn: "soon" }), ctx))).toEqual(["dueOn"]);
    expect(fields(validateObjective(obj({ startsOn: "2026-06-01", dueOn: "2026-05-01" }), ctx))).toEqual(["dueOn"]);
    expect(fields(validateObjective(obj({ startsOn: "2026-03-01" }), ctx))).toEqual(["dueOn"]);
    expect(fields(validateObjective(obj({ dueOn: "2026-10-01" }), ctx))).toEqual(["dueOn"]);
    expect(fields(validateObjective(obj({ dueOn: "2026-02-30" }), ctx))).toEqual(["dueOn"]);
  });

  it("checks the charter link only when clauses are provided", () => {
    expect(fields(validateObjective(obj({ charterClauseId: "c9" }), ctx))).toEqual(["charterClauseId"]);
    expect(validateObjective(obj({ charterClauseId: "c9" }), { ...ctx, charterClauseIds: undefined })).toEqual([]);
    expect(validateObjective(obj({ charterClauseId: undefined }), ctx)).toEqual([]);
  });

  it("rejects unknown priority and visibility values", () => {
    expect(fields(validateObjective(obj({ priority: "urgent" as never, visibility: "everyone" as never }), ctx))).toEqual(["priority", "visibility"]);
  });
});

describe("objective sets", () => {
  it("accepts a set with a must objective", () => {
    expect(validateObjectiveSet([obj(), obj({ id: "o2", title: "Run two workshops", priority: "could" })], ctx)).toEqual([]);
  });

  it("requires at least one objective, and one with priority must", () => {
    expect(validateObjectiveSet([], ctx).map((i) => i.message)).toEqual(["add at least one objective"]);
    expect(validateObjectiveSet([obj({ priority: "should" })], ctx).map((i) => i.message)).toEqual(["at least one objective must have priority must"]);
  });

  it("caps the number of objectives", () => {
    const many = Array.from({ length: MAX_OBJECTIVES + 1 }, (_, i) => obj({ id: `o${i}`, title: `Objective number ${i}` }));
    expect(validateObjectiveSet(many, ctx).some((i) => /at most 12/.test(i.message))).toBe(true);
  });

  it("requires unique ids and unique titles, ignoring case", () => {
    const issues = validateObjectiveSet([obj(), obj({ title: "PUBLISH THE OPEN DATASET" })], ctx);
    expect(issues.map((i) => i.field).sort()).toEqual(["id", "title"]);
  });

  it("reports the offending objective for each problem", () => {
    const issues = validateObjectiveSet([obj(), obj({ id: "o2", title: "Another objective", ownerId: "x" })], ctx);
    expect(issues).toEqual([{ objectiveId: "o2", field: "ownerId", message: "the owner must be a member of the team" }]);
  });
});

describe("prioritizing, progress and visibility", () => {
  it("orders by priority, then due date, then id, without mutating the input", () => {
    const list = [
      obj({ id: "c", priority: "could", dueOn: "2026-05-01" }),
      obj({ id: "b", priority: "must", dueOn: "2026-08-01" }),
      obj({ id: "a", priority: "must", dueOn: "2026-06-01" }),
      obj({ id: "d", priority: "should", dueOn: "2026-05-01" }),
      obj({ id: "e", priority: "should", dueOn: "2026-05-01" }),
    ];
    const copy = [...list];
    expect(prioritize(list).map((o) => o.id)).toEqual(["a", "b", "d", "e", "c"]);
    expect(list).toEqual(copy);
  });

  it("computes progress from baseline to target in either direction, clamped to 0..1", () => {
    expect(objectiveProgress({ baseline: 0, target: 100 }, 25)).toBe(0.25);
    expect(objectiveProgress({ baseline: 0, target: 100 }, 150)).toBe(1);
    expect(objectiveProgress({ baseline: 0, target: 100 }, -5)).toBe(0);
    expect(objectiveProgress({ baseline: 10, target: 0 }, 5)).toBe(0.5);
  });

  it("returns null when progress cannot be computed", () => {
    expect(objectiveProgress({ baseline: 5, target: 5 }, 5)).toBeNull();
    expect(objectiveProgress({ baseline: 0, target: 10 }, Number.NaN)).toBeNull();
  });

  it("shows each audience only what its visibility allows", () => {
    const list = [obj({ id: "t", visibility: "team" }), obj({ id: "s", visibility: "supervisors" }), obj({ id: "p", visibility: "public" })];
    expect(visibleObjectives(list, "team").map((o) => o.id)).toEqual(["t", "s", "p"]);
    expect(visibleObjectives(list, "supervisor").map((o) => o.id)).toEqual(["s", "p"]);
    expect(visibleObjectives(list, "public").map((o) => o.id)).toEqual(["p"]);
    expect(visibleObjectives(list, "stranger" as never)).toEqual([]);
  });
});
