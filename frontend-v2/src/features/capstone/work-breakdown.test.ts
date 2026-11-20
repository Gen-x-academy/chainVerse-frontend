import { describe, expect, it } from "vitest";
import {
  estimateByAssignee,
  movePackage,
  packageEstimate,
  projectProgress,
  totalEstimate,
  validateWbs,
  type WbsTask,
  type WorkPackage,
} from "./work-breakdown";

const task = (id: string, order: number, over: Partial<WbsTask> = {}): WbsTask => ({ id, title: `Task ${id}`, order, estimateHours: 10, dependsOn: [], acceptance: "Reviewed and merged", ...over });
const wbs = (): WorkPackage[] => [
  { id: "p1", title: "Research", order: 1, weight: 40, tasks: [task("t1", 1, { assigneeId: "u1" }), task("t2", 2, { estimateHours: 30, dependsOn: ["t1"], assigneeId: "u2" })] },
  { id: "p2", title: "Build", order: 2, weight: 60, tasks: [task("t3", 1, { dependsOn: ["t2"] })] },
];
const members = ["u1", "u2"];
const paths = (issues: { path: string }[]) => issues.map((i) => i.path);

describe("work breakdown validation", () => {
  it("accepts an ordered, weighted structure", () => {
    expect(validateWbs(wbs(), members)).toEqual([]);
  });

  it("needs at least one package, and each package at least one task", () => {
    expect(paths(validateWbs([], members))).toEqual(["packages"]);
    const empty = wbs();
    (empty[1] as WorkPackage).tasks = [];
    expect(paths(validateWbs(empty, members))).toEqual(["packages[1].tasks"]);
  });

  it("requires contiguous order numbers for packages and tasks", () => {
    const packages = wbs();
    (packages[0] as WorkPackage).order = 2;
    (packages[1] as WorkPackage).tasks[0] = task("t3", 3);
    expect(paths(validateWbs(packages, members))).toEqual(["packages[0].order", "packages[1].tasks[0].order"]);
  });

  it("requires weights above zero that add up to 100", () => {
    const off = wbs();
    (off[1] as WorkPackage).weight = 50;
    expect(validateWbs(off, members).map((i) => i.message)).toEqual(["package weights must add up to 100 (they add up to 90)"]);
    const zero = wbs();
    (zero[0] as WorkPackage).weight = 0;
    expect(paths(validateWbs(zero, members))).toContain("packages[0].weight");
  });

  it("bounds estimates and requires acceptance conditions", () => {
    const packages = wbs();
    const first = (packages[0] as WorkPackage).tasks;
    first[0] = task("t1", 1, { estimateHours: 0, acceptance: "  " });
    first[1] = task("t2", 2, { estimateHours: 401 });
    expect(paths(validateWbs(packages, members)).sort()).toEqual(["packages[0].tasks[0].acceptance", "packages[0].tasks[0].estimateHours", "packages[0].tasks[1].estimateHours"]);
  });

  it("requires assignees to be team members", () => {
    const packages = wbs();
    (packages[0] as WorkPackage).tasks[0] = task("t1", 1, { assigneeId: "stranger" });
    expect(paths(validateWbs(packages, members))).toEqual(["packages[0].tasks[0].assigneeId"]);
  });

  it("checks dependencies exist and are not self references", () => {
    const packages = wbs();
    (packages[1] as WorkPackage).tasks[0] = task("t3", 1, { dependsOn: ["ghost", "t3"] });
    expect(validateWbs(packages, members).map((i) => i.message)).toEqual(['dependency "ghost" was not found', "a task cannot depend on itself"]);
  });

  it("requires unique package and task ids across the project", () => {
    const packages = wbs();
    (packages[1] as WorkPackage).id = "p1";
    (packages[1] as WorkPackage).tasks[0] = task("t1", 1);
    const found = paths(validateWbs(packages, members));
    expect(found).toContain("packages[1].id");
    expect(found).toContain("packages");
  });
});

describe("work breakdown totals and progress", () => {
  it("totals estimates by package and project", () => {
    expect(packageEstimate(wbs()[0] as WorkPackage)).toBe(40);
    expect(totalEstimate(wbs())).toBe(50);
    expect(totalEstimate([])).toBe(0);
  });

  it("splits estimated hours by assignee and counts unassigned work", () => {
    expect(estimateByAssignee(wbs())).toEqual({ byAssignee: { u1: 10, u2: 30 }, unassigned: 10 });
  });

  it("weights task progress by estimate and package progress by weight", () => {
    expect(projectProgress(wbs(), {})).toBe(0);
    expect(projectProgress(wbs(), { t1: 1, t2: 1, t3: 1 })).toBe(100);
    // Package 1 is 10 of 40 hours done (25%), package 2 untouched: 0.25 * 40 / 100.
    expect(projectProgress(wbs(), { t1: 1 })).toBe(10);
    expect(projectProgress(wbs(), { t3: 0.5 })).toBe(30);
  });

  it("clamps and ignores unusable progress values", () => {
    expect(projectProgress(wbs(), { t1: 5, t2: -1, t3: Number.NaN })).toBe(10);
    expect(projectProgress([], {})).toBe(0);
  });

  it("moves a package and renumbers without changing the input", () => {
    const input = wbs();
    const moved = movePackage(input, "p2", 1);
    expect(moved.map((p) => [p.id, p.order])).toEqual([["p2", 1], ["p1", 2]]);
    expect(input.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(movePackage(input, "p1", 99).map((p) => p.id)).toEqual(["p2", "p1"]);
    expect(movePackage(input, "p1", 0).map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(movePackage(input, "nope", 1).map((p) => p.id)).toEqual(["p1", "p2"]);
  });
});
