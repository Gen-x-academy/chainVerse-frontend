import { describe, expect, it } from "vitest";
import { buildCapstoneSeed } from "./seed-data";

describe("capstone seed data", () => {
  it("is deterministic for a seed and differs across seeds", () => {
    expect(buildCapstoneSeed({ seed: 7 })).toEqual(buildCapstoneSeed({ seed: 7 }));
    expect(buildCapstoneSeed({ seed: 7 })).not.toEqual(buildCapstoneSeed({ seed: 8 }));
  });

  it("covers every entity kind in the default dataset", () => {
    const seed = buildCapstoneSeed({ seed: 3, proposalsPerCall: 6 });
    expect(seed.supervisors.length).toBeGreaterThan(0);
    expect(seed.calls.length).toBe(3);
    expect(seed.proposals.length).toBe(18);
    expect(seed.teams.length).toBe(18);
    expect(seed.milestones.length).toBeGreaterThan(0);
    expect(seed.submissions.length).toBeGreaterThan(0);
    expect(seed.reviews.length).toBeGreaterThan(0);
    expect(seed.budgets.length).toBe(18);
    expect(new Set(seed.proposals.map((p) => p.state)).size).toBeGreaterThan(2);
  });

  it("keeps every cross reference valid and ids unique", () => {
    const s = buildCapstoneSeed({ seed: 11, proposalsPerCall: 8, calls: 4 });
    const ids = (items: { id: string }[]) => new Set(items.map((i) => i.id));
    const supervisors = ids(s.supervisors);
    const calls = ids(s.calls);
    const proposals = ids(s.proposals);
    const teams = ids(s.teams);
    const milestones = ids(s.milestones);
    const submissions = ids(s.submissions);
    for (const list of [s.supervisors, s.calls, s.proposals, s.teams, s.milestones, s.submissions, s.reviews, s.budgets, s.publications, s.disputes]) {
      expect(ids(list).size).toBe(list.length);
    }
    expect(s.calls.every((c) => supervisors.has(c.supervisorId))).toBe(true);
    expect(s.proposals.every((p) => calls.has(p.callId) && teams.has(p.teamId))).toBe(true);
    expect(s.milestones.every((m) => proposals.has(m.proposalId))).toBe(true);
    expect(s.submissions.every((x) => milestones.has(x.milestoneId))).toBe(true);
    expect(s.reviews.every((x) => submissions.has(x.submissionId) && supervisors.has(x.reviewerId))).toBe(true);
    expect(s.budgets.every((b) => proposals.has(b.proposalId))).toBe(true);
    expect(s.publications.every((p) => proposals.has(p.proposalId))).toBe(true);
    expect(s.disputes.every((d) => proposals.has(d.proposalId))).toBe(true);
  });

  it("only publishes or reviews approved work, and disputes only rejected work", () => {
    const s = buildCapstoneSeed({ seed: 5, proposalsPerCall: 10 });
    const state = new Map(s.proposals.map((p) => [p.id, p.state]));
    expect(s.milestones.every((m) => state.get(m.proposalId) === "approved")).toBe(true);
    expect(s.publications.every((p) => state.get(p.proposalId) === "approved")).toBe(true);
    expect(s.disputes.every((d) => state.get(d.proposalId) === "rejected")).toBe(true);
  });

  it("contains no real personal data: reserved email domain and fixed dates", () => {
    const s = buildCapstoneSeed({ seed: 9 });
    expect(s.supervisors.every((x) => /^[a-z0-9]+@example\.test$/.test(x.email))).toBe(true);
    const json = JSON.stringify(s);
    expect(json).not.toMatch(/@(gmail|yahoo|outlook|hotmail)\./i);
    expect(s.calls[0].opensOn).toBe("2026-01-12");
    expect(s.budgets.every((b) => /^[1-9][0-9]*$/.test(b.amountMinor))).toBe(true);
  });
});
