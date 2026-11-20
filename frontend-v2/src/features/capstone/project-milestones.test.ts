import { describe, expect, it } from "vitest";
import { canStart, isComplete, moveMilestone, nextMilestone, overdue, reviewerIssues, validateMilestones, type Milestone, type ProjectWindow } from "./project-milestones";

const window: ProjectWindow = { startsOn: "2026-02-01", endsOn: "2026-12-01", memberIds: ["u1", "u2"], trancheIds: ["f1", "f2"] };
const ms = (id: string, order: number, dueOn: string, over: Partial<Milestone> = {}): Milestone => ({
  id,
  title: `Milestone ${id}`,
  order,
  dueOn,
  dependsOn: [],
  reviewerId: "rev1",
  deliverables: [{ id: `${id}-d1`, title: "Report", required: true }],
  completionRule: "both",
  status: "planned",
  ...over,
});
const plan = (): Milestone[] => [ms("m1", 1, "2026-03-01"), ms("m2", 2, "2026-05-01", { dependsOn: ["m1"] }), ms("m3", 3, "2026-08-01", { dependsOn: ["m2"] })];
const paths = (issues: { path: string }[]) => issues.map((i) => i.path);

describe("validation", () => {
  it("accepts a well formed plan", () => {
    expect(validateMilestones(plan(), window)).toEqual([]);
  });

  it("needs at least one milestone", () => {
    expect(paths(validateMilestones([], window))).toEqual(["milestones"]);
  });

  it("checks order, dates and window", () => {
    const list = plan();
    list[1] = ms("m2", 3, "2026-01-01");
    expect(paths(validateMilestones(list, window))).toEqual(["milestones[1].order", "milestones[1].dueOn", "milestones[1].dueOn"]);
  });

  it("only allows dependencies on earlier milestones", () => {
    const list = plan();
    (list[0] as Milestone).dependsOn = ["m3"];
    (list[1] as Milestone).dependsOn = ["m2", "ghost"];
    expect(paths(validateMilestones(list, window))).toEqual(["milestones[0].dependsOn", "milestones[1].dependsOn", "milestones[1].dependsOn"]);
  });

  it("checks deliverables and completion rules", () => {
    const list = plan();
    (list[0] as Milestone).deliverables = [];
    (list[1] as Milestone).deliverables = [{ id: "x", title: "Optional", required: false }];
    expect(paths(validateMilestones(list, window))).toEqual(["milestones[0].deliverables", "milestones[0].completionRule", "milestones[1].completionRule"]);
    (list[1] as Milestone).completionRule = "reviewer_sign_off";
    expect(paths(validateMilestones(list, window))).not.toContain("milestones[1].completionRule");
  });

  it("links each funding tranche to one milestone that exists", () => {
    const list = plan();
    (list[0] as Milestone).fundingTrancheId = "f1";
    (list[1] as Milestone).fundingTrancheId = "f1";
    (list[2] as Milestone).fundingTrancheId = "nope";
    expect(paths(validateMilestones(list, window))).toEqual(["milestones[1].fundingTrancheId", "milestones[2].fundingTrancheId"]);
  });

  it("keeps reviewers independent of the team", () => {
    const list = plan();
    (list[1] as Milestone).reviewerId = "u1";
    expect(paths(reviewerIssues(list, window.memberIds))).toEqual(["milestones[1].reviewerId"]);
  });
});

describe("progress", () => {
  it("can start only once its dependencies are complete", () => {
    const list = plan();
    expect(canStart(list[1] as Milestone, list)).toBe(false);
    (list[0] as Milestone).status = "completed";
    expect(canStart(list[1] as Milestone, list)).toBe(true);
  });

  it("applies the completion rule", () => {
    const m = ms("m1", 1, "2026-03-01");
    expect(isComplete(m, ["m1-d1"], false)).toBe(false);
    expect(isComplete(m, ["m1-d1"], true)).toBe(true);
    expect(isComplete({ ...m, completionRule: "all_required_deliverables" }, ["m1-d1"], false)).toBe(true);
    expect(isComplete({ ...m, completionRule: "reviewer_sign_off" }, [], true)).toBe(true);
  });

  it("finds the next and overdue milestones", () => {
    const list = plan();
    (list[0] as Milestone).status = "completed";
    expect(nextMilestone(list)?.id).toBe("m2");
    expect(overdue(list, "2026-06-01").map((m) => m.id)).toEqual(["m2"]);
  });

  it("reorders without changing the input", () => {
    const list = plan();
    expect(moveMilestone(list, "m3", 1).map((m) => [m.id, m.order])).toEqual([["m3", 1], ["m1", 2], ["m2", 3]]);
    expect(list[0]?.id).toBe("m1");
  });
});
