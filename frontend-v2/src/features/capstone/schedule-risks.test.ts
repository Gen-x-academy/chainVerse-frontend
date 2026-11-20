import { describe, expect, it } from "vitest";
import { analyseSchedule, canSaveSchedule, criticalPath, findCycle, wouldCreateCycle, type ScheduledItem } from "./schedule-risks";

const item = (id: string, startsOn: string, endsOn: string, over: Partial<ScheduledItem> = {}): ScheduledItem => ({ id, title: `Item ${id}`, startsOn, endsOn, dependsOn: [], done: false, ...over });
const kinds = (items: ScheduledItem[], deadline = "2026-12-31", today = "2026-03-01") => analyseSchedule(items, deadline, today).map((r) => r.kind);

describe("cycles", () => {
  it("finds a loop and names it", () => {
    const items = [item("a", "2026-03-01", "2026-03-05", { dependsOn: ["c"] }), item("b", "2026-03-06", "2026-03-10", { dependsOn: ["a"] }), item("c", "2026-03-11", "2026-03-15", { dependsOn: ["b"] })];
    const cycle = findCycle(items);
    expect(cycle?.[0]).toBe(cycle?.[cycle.length - 1]);
    expect(new Set(cycle)).toEqual(new Set(["a", "b", "c"]));
  });

  it("finds nothing in a plain chain", () => {
    expect(findCycle([item("a", "2026-03-01", "2026-03-05"), item("b", "2026-03-06", "2026-03-10", { dependsOn: ["a"] })])).toBeUndefined();
  });

  it("rejects an edit that would close a loop", () => {
    const items = [item("a", "2026-03-01", "2026-03-05"), item("b", "2026-03-06", "2026-03-10", { dependsOn: ["a"] })];
    expect(wouldCreateCycle(items, "a", "b")).toBe(true);
    expect(wouldCreateCycle(items, "a", "a")).toBe(true);
    expect(wouldCreateCycle(items, "b", "a")).toBe(false);
    expect(items[0]?.dependsOn).toEqual([]);
  });
});

describe("critical path", () => {
  it("follows the longest unfinished chain", () => {
    const items = [
      item("a", "2026-03-01", "2026-03-10"),
      item("b", "2026-03-11", "2026-03-12", { dependsOn: ["a"] }),
      item("c", "2026-03-11", "2026-03-30", { dependsOn: ["a"] }),
      item("d", "2026-04-01", "2026-04-02", { dependsOn: ["b", "c"] }),
    ];
    expect(criticalPath(items)).toEqual(["a", "c", "d"]);
  });

  it("skips finished work and is empty when there is a loop", () => {
    expect(criticalPath([item("a", "2026-03-01", "2026-03-05", { done: true }), item("b", "2026-03-06", "2026-03-08", { dependsOn: ["a"] })])).toEqual(["b"]);
    expect(criticalPath([item("a", "2026-03-01", "2026-03-05", { dependsOn: ["b"] }), item("b", "2026-03-06", "2026-03-08", { dependsOn: ["a"] })])).toEqual([]);
  });
});

describe("schedule risks", () => {
  it("reports impossible dates, missing dependencies and early starts as errors", () => {
    const items = [item("a", "2026-03-10", "2026-03-01"), item("b", "2026-03-01", "2026-03-05", { dependsOn: ["ghost"] }), item("c", "2026-04-01", "2026-04-10"), item("d", "2026-04-05", "2026-04-20", { dependsOn: ["c"] })];
    const found = kinds(items);
    expect(found).toEqual(expect.arrayContaining(["impossible_dates", "missing_dependency", "starts_before_dependency"]));
    expect(canSaveSchedule(analyseSchedule(items, "2026-12-31", "2026-03-01"))).toBe(false);
  });

  it("reports blocked work when a dependency is late and unfinished", () => {
    const items = [item("a", "2026-02-01", "2026-02-10"), item("b", "2026-02-11", "2026-03-20", { dependsOn: ["a"] })];
    expect(kinds(items)).toContain("blocked_critical_path");
    expect(kinds([item("a", "2026-02-01", "2026-02-10", { done: true }), item("b", "2026-02-11", "2026-03-20", { dependsOn: ["a"] })])).not.toContain("blocked_critical_path");
  });

  it("reports one owner booked twice at the same time", () => {
    const items = [item("a", "2026-03-01", "2026-03-10", { ownerId: "u1" }), item("b", "2026-03-05", "2026-03-15", { ownerId: "u1" }), item("c", "2026-03-05", "2026-03-15", { ownerId: "u2" })];
    expect(analyseSchedule(items, "2026-12-31", "2026-03-01").filter((r) => r.kind === "resource_conflict").map((r) => r.itemIds)).toEqual([["a", "b"]]);
  });

  it("reports work that ends after the deadline and chains that cannot fit", () => {
    expect(kinds([item("a", "2026-03-01", "2026-04-10")], "2026-04-01")).toContain("deadline_risk");
    const tight = [item("a", "2026-03-01", "2026-03-30"), item("b", "2026-03-31", "2026-04-20", { dependsOn: ["a"] })];
    const risks = analyseSchedule(tight, "2026-04-25", "2026-03-20");
    expect(risks.some((r) => r.kind === "deadline_risk" && r.message.includes("remain"))).toBe(true);
  });

  it("is quiet for a healthy plan, and warnings alone do not block saving", () => {
    const healthy = [item("a", "2026-03-01", "2026-03-10", { ownerId: "u1" }), item("b", "2026-03-11", "2026-03-20", { dependsOn: ["a"], ownerId: "u1" })];
    expect(analyseSchedule(healthy, "2026-12-31", "2026-03-01")).toEqual([]);
    const warned = analyseSchedule([item("a", "2026-03-01", "2026-04-10")], "2026-04-01", "2026-03-01");
    expect(canSaveSchedule(warned)).toBe(true);
  });
});
