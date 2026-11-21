import { describe, expect, it } from "vitest";
import { addCheckIn, confidenceTrend, currentCheckIns, fullHistory, latestFor, openBlockers, overdueObjectives, validateCheckIn, type CheckIn, type CheckInHistory } from "./progress-checkins";

const ci = (id: string, createdAt: string, over: Partial<CheckIn> = {}): CheckIn => ({
  id,
  objectiveId: "o1",
  authorId: "u1",
  createdAt,
  status: "on_track",
  confidence: 4,
  summary: "Interviews are going well",
  blockers: [],
  evidenceRefs: [],
  nextActions: ["Transcribe interviews"],
  ...over,
});
const members = ["u1", "u2"];
const paths = (issues: { path: string }[]) => issues.map((i) => i.path);
const empty = (): CheckInHistory => ({ checkIns: [] });

describe("validation", () => {
  it("accepts a normal check-in", () => {
    expect(validateCheckIn(ci("c1", "2026-03-01T00:00:00.000Z"), members)).toEqual([]);
  });

  it("only team members may post, with a summary", () => {
    expect(paths(validateCheckIn(ci("c1", "2026-03-01T00:00:00.000Z", { authorId: "zz", summary: " " }), members))).toEqual(["authorId", "summary"]);
  });

  it("asks for blockers when blocked, next actions when not done, and evidence when done", () => {
    expect(paths(validateCheckIn(ci("c1", "2026-03-01T00:00:00.000Z", { status: "blocked", nextActions: [] }), members))).toEqual(["blockers", "nextActions"]);
    expect(paths(validateCheckIn(ci("c1", "2026-03-01T00:00:00.000Z", { status: "done", nextActions: [] }), members))).toEqual(["evidenceRefs"]);
    expect(validateCheckIn(ci("c1", "2026-03-01T00:00:00.000Z", { status: "done", nextActions: [], evidenceRefs: ["doc-1"] }), members)).toEqual([]);
  });

  it("limits and cleans lists", () => {
    const many = Array.from({ length: 11 }, (_, i) => `a${i}`);
    expect(paths(validateCheckIn(ci("c1", "2026-03-01T00:00:00.000Z", { nextActions: many }), members))).toEqual(["nextActions"]);
    expect(paths(validateCheckIn(ci("c1", "2026-03-01T00:00:00.000Z", { nextActions: ["ok", " "] }), members))).toEqual(["nextActions"]);
  });
});

describe("history", () => {
  it("never duplicates on retry", () => {
    const once = addCheckIn(empty(), ci("c1", "2026-03-01T00:00:00.000Z")).history;
    const again = addCheckIn(once, ci("c1", "2026-03-01T00:00:00.000Z")).history;
    expect(again.checkIns).toHaveLength(1);
  });

  it("corrects by adding a new entry and keeps the old one", () => {
    let h = addCheckIn(empty(), ci("c1", "2026-03-01T00:00:00.000Z", { confidence: 5 })).history;
    h = addCheckIn(h, ci("c2", "2026-03-02T00:00:00.000Z", { confidence: 3, supersedes: "c1" })).history;
    expect(currentCheckIns(h).map((c) => c.id)).toEqual(["c2"]);
    expect(fullHistory(h, "o1").map((c) => [c.id, c.replaced])).toEqual([["c1", true], ["c2", false]]);
    expect(h.checkIns[0]?.confidence).toBe(5);
  });

  it("refuses a correction of something that is not there or belongs to another objective", () => {
    expect(addCheckIn(empty(), ci("c2", "2026-03-02T00:00:00.000Z", { supersedes: "c1" })).error).toBe("unknown_replacement");
    const h = addCheckIn(empty(), ci("c1", "2026-03-01T00:00:00.000Z")).history;
    expect(addCheckIn(h, ci("c2", "2026-03-02T00:00:00.000Z", { objectiveId: "o2", supersedes: "c1" })).error).toBe("wrong_objective");
  });
});

describe("reading the history", () => {
  const h = (): CheckInHistory => ({
    checkIns: [ci("c1", "2026-03-01T00:00:00.000Z", { confidence: 5 }), ci("c2", "2026-03-20T00:00:00.000Z", { confidence: 2, status: "blocked", blockers: ["Waiting on ethics approval"] }), ci("d1", "2026-03-18T00:00:00.000Z", { objectiveId: "o2", status: "done", evidenceRefs: ["x"], nextActions: [] })],
  });

  it("finds the latest check-in and the confidence trend", () => {
    expect(latestFor(h(), "o1")?.id).toBe("c2");
    expect(confidenceTrend(h(), "o1")).toBe(-3);
    expect(confidenceTrend(h(), "o2")).toBe(0);
  });

  it("lists open blockers", () => {
    expect(openBlockers(h(), ["o1", "o2"])).toEqual([{ objectiveId: "o1", blockers: ["Waiting on ethics approval"] }]);
  });

  it("reminds about objectives with no recent update, but not finished ones", () => {
    expect(overdueObjectives(h(), ["o1", "o2", "o3"], "2026-03-25T00:00:00.000Z")).toEqual(["o3"]);
    expect(overdueObjectives(h(), ["o1", "o2", "o3"], "2026-04-10T00:00:00.000Z")).toEqual(["o1", "o3"]);
  });
});
