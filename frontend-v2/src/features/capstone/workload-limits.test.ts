import { describe, expect, it } from "vitest";
import { DEFAULT_LIMITS, checkParticipant, checkSupervisor, remainingCapacity, staleReservations, type WorkloadEntry } from "./workload-limits";

const entry = (projectId: string, weeklyHours: number, state: WorkloadEntry["state"] = "active", periodId = "2026-s1"): WorkloadEntry => ({ projectId, weeklyHours, state, periodId });
const codes = (v: { code: string }[]) => v.map((x) => x.code);

describe("participant limits", () => {
  it("allows a request inside every limit", () => {
    expect(checkParticipant([entry("a", 8)], { periodId: "2026-s1", projectId: "b", weeklyHours: 8, teamSizeAfter: 4 })).toEqual([]);
  });

  it("counts pending reservations like active projects", () => {
    const v = checkParticipant([entry("a", 5), entry("b", 5, "pending")], { periodId: "2026-s1", projectId: "c", weeklyHours: 5, teamSizeAfter: 3 });
    expect(codes(v)).toEqual(["too_many_projects"]);
    expect(v[0]).toMatchObject({ limit: 2, wouldBe: 3 });
  });

  it("flags hours and team size", () => {
    const v = checkParticipant([entry("a", 15)], { periodId: "2026-s1", projectId: "b", weeklyHours: 10, teamSizeAfter: 9 });
    expect(codes(v)).toEqual(["too_many_hours", "team_too_large"]);
    expect(v[0]?.wouldBe).toBe(25);
  });

  it("ignores other academic periods and the project being joined", () => {
    const entries = [entry("a", 19, "active", "2025-s2"), entry("b", 19)];
    expect(checkParticipant(entries, { periodId: "2026-s1", projectId: "b", weeklyHours: 10, teamSizeAfter: 2 })).toEqual([]);
  });
});

describe("supervisor limits", () => {
  it("stops at the supervision cap", () => {
    const supervised = Array.from({ length: 8 }, (_, i) => entry(`p${i}`, 0));
    expect(codes(checkSupervisor(supervised, "2026-s1", "new"))).toEqual(["supervision_full"]);
    expect(checkSupervisor(supervised.slice(0, 7), "2026-s1", "new")).toEqual([]);
  });

  it("does not count the same project twice", () => {
    const supervised = Array.from({ length: 8 }, (_, i) => entry(`p${i}`, 0));
    expect(checkSupervisor(supervised, "2026-s1", "p3")).toEqual([]);
  });
});

describe("remaining capacity and stale reservations", () => {
  it("reports what is left", () => {
    expect(remainingCapacity([entry("a", 6)], "2026-s1")).toEqual({ projects: 1, weeklyHours: 14 });
    expect(remainingCapacity([entry("a", 30), entry("b", 5), entry("c", 5)], "2026-s1", DEFAULT_LIMITS)).toEqual({ projects: 0, weeklyHours: 0 });
  });

  it("finds reservations older than the window", () => {
    const now = new Date("2026-03-10T00:00:00.000Z");
    expect(staleReservations([{ projectId: "a", reservedAt: "2026-03-01T00:00:00.000Z" }, { projectId: "b", reservedAt: "2026-03-09T00:00:00.000Z" }], now)).toEqual(["a"]);
  });
});
