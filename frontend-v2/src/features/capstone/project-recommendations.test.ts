import { describe, expect, it } from "vitest";
import { MIN_SCORE, profileSignals, recommendProjects, type RecommendableOpportunity, type RecommendationProfile } from "./project-recommendations";

const profile = (over: Partial<RecommendationProfile> = {}): RecommendationProfile => ({
  interests: ["Open Science", "Climate"],
  skills: ["Python", "Statistics"],
  goals: ["publish a paper"],
  availabilityHours: 10,
  preferredModes: ["remote"],
  ...over,
});
const opp = (id: string, over: Partial<RecommendableOpportunity> = {}): RecommendableOpportunity => ({
  id,
  title: `Project ${id}`,
  themes: ["climate"],
  skills: ["python"],
  goalsServed: [],
  weeklyHours: 8,
  mode: "remote",
  eligible: true,
  ...over,
});

describe("project recommendations", () => {
  it("ranks by score and explains every recommendation with reasons that sum to the score", () => {
    const r = recommendProjects(profile(), [
      opp("weak", { themes: [], skills: ["rust"], mode: "in_person", weeklyHours: 20 }),
      opp("best", { themes: ["Climate", "open science"], skills: ["python", "statistics"], goalsServed: ["Publish a paper"] }),
      opp("mid", { themes: ["climate"], skills: ["go"] }),
    ]);
    expect(r.recommendations.map((x) => x.opportunityId)).toEqual(["best", "mid"]);
    for (const rec of r.recommendations) {
      expect(rec.reasons.length).toBeGreaterThan(0);
      expect(rec.reasons.reduce((n, x) => n + x.points, 0)).toBe(rec.score);
      expect(rec.score).toBeGreaterThanOrEqual(MIN_SCORE);
    }
    expect(r.recommendations[0].reasons.map((x) => x.kind).sort()).toEqual(["goal", "interest", "mode", "schedule", "skill"]);
    expect(r.recommendations[0].score).toBe(100);
  });

  it("only recommends eligible opportunities and counts the rest", () => {
    const r = recommendProjects(profile(), [opp("a", { eligible: false }), opp("b")]);
    expect(r.recommendations.map((x) => x.opportunityId)).toEqual(["b"]);
    expect(r.excluded.ineligible).toBe(1);
  });

  it("respects program constraints", () => {
    const r = recommendProjects(profile({ program: { term: "Fall" } }), [opp("a", { term: "spring" }), opp("b", { term: "fall" }), opp("c")]);
    expect(r.recommendations.map((x) => x.opportunityId)).toEqual(["b", "c"]);
    expect(r.excluded.blockedByProgram).toBe(1);
  });

  it("breaks ties deterministically by id and honours the limit", () => {
    const same = ["z", "m", "a", "k"].map((id) => opp(id));
    const r = recommendProjects(profile(), same, 3);
    expect(r.recommendations.map((x) => x.opportunityId)).toEqual(["a", "k", "m"]);
    expect(recommendProjects(profile(), [...same].reverse(), 3)).toEqual(r);
  });

  it("says so instead of guessing when the profile is sparse", () => {
    const sparse = profile({ interests: [], skills: [], goals: [], availabilityHours: undefined, preferredModes: ["remote"] });
    expect(profileSignals(sparse)).toBe(1);
    const r = recommendProjects(sparse, [opp("a")]);
    expect(r.recommendations).toEqual([]);
    expect(r.note).toMatch(/Add a few/);
  });

  it("explains an empty result", () => {
    const r = recommendProjects(profile(), [opp("a", { themes: [], skills: ["rust"], mode: "in_person", weeklyHours: 40 })]);
    expect(r.recommendations).toEqual([]);
    expect(r.note).toMatch(/No eligible opportunities/);
  });

  it("never reads protected or unknown fields", () => {
    const base = recommendProjects(profile(), [opp("a"), opp("b", { themes: [] })]);
    const withExtras = recommendProjects(profile({ age: 17, gender: "x", nationality: "y", disability: true } as Partial<RecommendationProfile>), [opp("a"), opp("b", { themes: [] })]);
    expect(withExtras).toEqual(base);
  });
});
