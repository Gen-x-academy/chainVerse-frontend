import { describe, expect, it } from "vitest";
import {
  buildTimeline,
  canViewHistory,
  currentStatus,
  orderEvents,
  summarizeVersions,
  type ProposalEvent,
  type Viewer,
} from "./proposal-history";

const OWNER = "u1";
const ev = (over: Partial<ProposalEvent> & Pick<ProposalEvent, "id" | "kind" | "at">): ProposalEvent => ({ proposalId: "prp_1", version: 1, actorId: OWNER, ...over });
const events: ProposalEvent[] = [
  ev({ id: "e1", kind: "created", at: "2026-04-01T09:00:00Z" }),
  ev({ id: "e2", kind: "submitted", at: "2026-04-01T10:00:00Z" }),
  ev({ id: "e3", kind: "review_started", at: "2026-04-02T10:00:00Z", actorId: "rev1", note: "Strong team, check budget" }),
  ev({ id: "e4", kind: "withdrawn", at: "2026-04-03T10:00:00Z", note: "Changing scope" }),
  ev({ id: "e5", kind: "resubmitted", at: "2026-04-10T10:00:00Z", version: 2 }),
  ev({ id: "e6", kind: "decided", at: "2026-04-20T10:00:00Z", version: 2, actorId: "rev2", outcome: "accepted", note: "Welcome aboard" }),
];
const owner: Viewer = { userId: OWNER, role: "owner" };
const reviewer: Viewer = { userId: "rev1", role: "reviewer" };

describe("proposal history", () => {
  it("orders events by time, then lifecycle order, then id", () => {
    const shuffled = [events[5], events[2], events[0], events[4], events[1], events[3]] as ProposalEvent[];
    expect(orderEvents(shuffled, "prp_1").map((e) => e.id)).toEqual(["e1", "e2", "e3", "e4", "e5", "e6"]);

    const sameTime = [ev({ id: "b", kind: "decided", at: "2026-05-01T00:00:00Z" }), ev({ id: "a", kind: "submitted", at: "2026-05-01T00:00:00Z" })];
    expect(orderEvents(sameTime, "prp_1").map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("shows a replayed event once and ignores other proposals and unreadable timestamps", () => {
    const noisy = [...events, events[1] as ProposalEvent, ev({ id: "x", kind: "submitted", at: "2026-04-01T10:00:00Z", proposalId: "prp_2" }), ev({ id: "y", kind: "submitted", at: "not a date" })];
    expect(orderEvents(noisy, "prp_1")).toHaveLength(6);
  });

  it("is deny-by-default: only the owner, reviewers and admins can view", () => {
    expect(canViewHistory(owner, OWNER)).toBe(true);
    expect(canViewHistory({ userId: "u9", role: "owner" }, OWNER)).toBe(false);
    expect(canViewHistory(reviewer, OWNER)).toBe(true);
    expect(canViewHistory({ userId: "a", role: "admin" }, OWNER)).toBe(true);
    expect(canViewHistory({ userId: "z", role: "other" }, OWNER)).toBe(false);
    expect(buildTimeline(events, "prp_1", OWNER, { userId: "z", role: "other" })).toEqual([]);
    expect(buildTimeline(events, "prp_1", OWNER, { userId: "u9", role: "owner" })).toEqual([]);
  });

  it("builds labelled entries without exposing actor ids", () => {
    const timeline = buildTimeline(events, "prp_1", OWNER, owner);
    expect(timeline.map((t) => t.label)).toEqual(["Draft created", "Submitted", "Review started", "Withdrawn", "Resubmitted", "Decision recorded: Accepted"]);
    expect(timeline.map((t) => t.actorLabel)).toEqual(["You", "You", "Review team", "You", "You", "Review team"]);
    expect(JSON.stringify(timeline)).not.toMatch(/rev1|rev2|"u1"/);
  });

  it("hides internal review notes from the applicant but not from reviewers", () => {
    const forOwner = buildTimeline(events, "prp_1", OWNER, owner);
    expect(forOwner.find((t) => t.id === "e3")).not.toHaveProperty("note");
    expect(forOwner.find((t) => t.id === "e4")).toHaveProperty("note", "Changing scope");
    expect(forOwner.find((t) => t.id === "e6")).toMatchObject({ note: "Welcome aboard", outcome: "accepted" });

    const forReviewer = buildTimeline(events, "prp_1", OWNER, reviewer);
    expect(forReviewer.find((t) => t.id === "e3")).toHaveProperty("note", "Strong team, check budget");
    expect(forReviewer.map((t) => t.actorLabel)).toEqual(["Applicant", "Applicant", "Review team", "Applicant", "Applicant", "Review team"]);
  });

  it("drops blank notes", () => {
    const blank = [ev({ id: "n", kind: "withdrawn", at: "2026-04-03T10:00:00Z", note: "   " })];
    expect(buildTimeline(blank, "prp_1", OWNER, owner)[0]).not.toHaveProperty("note");
  });

  it("derives the current status from the latest event", () => {
    expect(currentStatus(events, "prp_1")).toEqual({ status: "accepted", version: 2, since: "2026-04-20T10:00:00Z" });
    expect(currentStatus(events.slice(0, 1), "prp_1")?.status).toBe("draft");
    expect(currentStatus(events.slice(0, 2), "prp_1")?.status).toBe("submitted");
    expect(currentStatus(events.slice(0, 3), "prp_1")?.status).toBe("under_review");
    expect(currentStatus(events.slice(0, 4), "prp_1")?.status).toBe("withdrawn");
    expect(currentStatus(events.slice(0, 5), "prp_1")?.status).toBe("submitted");
    expect(currentStatus([], "prp_1")).toBeNull();
    expect(currentStatus(events, "prp_other")).toBeNull();
  });

  it("summarises each submitted version and how it ended", () => {
    expect(summarizeVersions(events, "prp_1")).toEqual([
      { version: 1, submittedAt: "2026-04-01T10:00:00Z", end: "withdrawn", endedAt: "2026-04-03T10:00:00Z" },
      { version: 2, submittedAt: "2026-04-10T10:00:00Z", end: "accepted", endedAt: "2026-04-20T10:00:00Z" },
    ]);
    expect(summarizeVersions(events.slice(0, 2), "prp_1")).toEqual([{ version: 1, submittedAt: "2026-04-01T10:00:00Z", end: "open" }]);
    expect(summarizeVersions([], "prp_1")).toEqual([]);
  });
});
