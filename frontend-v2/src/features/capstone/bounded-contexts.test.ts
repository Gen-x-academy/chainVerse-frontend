import { describe, expect, it } from "vitest";
import { CONTEXTS, CONTEXT_NAMES, checkInvariants, contextOfId, isReferenceAllowed, type Snapshot } from "./bounded-contexts";

const good = (): Snapshot => ({
  call: { id: "cal_1", state: "published", fundingTotalMinor: "1000", teamSizeMin: 2, teamSizeMax: 4 },
  project: { id: "prj_1", callId: "cal_1", state: "active", startsOn: "2026-04-01", endsOn: "2026-09-01", supervisorId: "sup1" },
  team: { id: "tem_1", projectId: "prj_1", memberIds: ["a", "b", "c"], leadId: "a" },
  milestones: [{ id: "m1", projectId: "prj_1", dueOn: "2026-06-01", state: "planned" }],
  reviews: [{ id: "r1", projectId: "prj_1", reviewerId: "rev1", state: "assigned" }],
  funding: [{ id: "f1", projectId: "prj_1", amountMinor: "600", state: "awarded" }, { id: "f2", projectId: "prj_1", amountMinor: "300", state: "revoked" }],
  outputs: [{ id: "o1", projectId: "prj_1", state: "draft" }],
  publications: [{ id: "p1", projectId: "prj_1", outputIds: ["o1"], state: "draft" }],
});
const names = (s: Snapshot) => checkInvariants(s).map((v) => v.invariant);

describe("capstone bounded contexts", () => {
  it("defines the eight contexts with unique id prefixes, states and ownership", () => {
    expect(CONTEXT_NAMES).toEqual(["calls", "projects", "teams", "milestones", "reviews", "funding", "outputs", "publications"]);
    expect(new Set(CONTEXT_NAMES.map((n) => CONTEXTS[n].idPrefix)).size).toBe(8);
    for (const n of CONTEXT_NAMES) {
      expect(CONTEXTS[n].owner.length).toBeGreaterThan(0);
      expect(CONTEXTS[n].states.length).toBeGreaterThan(1);
      expect(CONTEXTS[n].private.length).toBeGreaterThan(0);
    }
    expect(CONTEXTS.projects.states).toHaveLength(13);
  });

  it("only references other contexts that exist, and never itself", () => {
    for (const n of CONTEXT_NAMES) {
      for (const ref of CONTEXTS[n].references) {
        expect(CONTEXT_NAMES).toContain(ref);
        expect(ref).not.toBe(n);
      }
    }
    expect(isReferenceAllowed("projects", "calls")).toBe(true);
    expect(isReferenceAllowed("calls", "projects")).toBe(false);
    expect(isReferenceAllowed("funding", "reviews")).toBe(false);
  });

  it("identifies the owning context from a public id", () => {
    expect(contextOfId("prj_0123456789ABCDEF")).toBe("projects");
    expect(contextOfId("cal_0123456789ABCDEF")).toBe("calls");
    expect(contextOfId("zzz_0123456789ABCDEF")).toBeNull();
    expect(contextOfId("prj_short")).toBeNull();
  });

  it("accepts a consistent snapshot", () => {
    expect(checkInvariants(good())).toEqual([]);
  });

  it("detects ownership and membership violations", () => {
    const s = good();
    s.project.callId = "cal_other";
    s.team.projectId = "prj_other";
    s.team.memberIds = ["a", "a", "sup1"];
    s.team.leadId = "zed";
    expect(names(s)).toEqual(expect.arrayContaining(["PROJECT_BELONGS_TO_CALL", "TEAM_BELONGS_TO_PROJECT", "TEAM_MEMBERS_UNIQUE", "TEAM_LEAD_IS_MEMBER", "SUPERVISOR_NOT_ON_TEAM"]));
  });

  it("enforces team size limits, ordered windows and milestone placement", () => {
    const s = good();
    s.team.memberIds = ["a"];
    s.project.endsOn = "2026-03-01";
    s.milestones.push({ id: "m2", projectId: "prj_other", dueOn: "2030-01-01", state: "planned" });
    expect(names(s)).toEqual(expect.arrayContaining(["TEAM_SIZE_WITHIN_CALL_LIMITS", "PROJECT_WINDOW_ORDERED", "MILESTONE_BELONGS_TO_PROJECT", "MILESTONE_INSIDE_PROJECT_WINDOW"]));
  });

  it("requires independent reviewers", () => {
    const s = good();
    s.reviews.push({ id: "r2", projectId: "prj_1", reviewerId: "b", state: "assigned" }, { id: "r3", projectId: "prj_1", reviewerId: "sup1", state: "assigned" });
    expect(names(s).filter((n) => n === "REVIEWER_INDEPENDENT")).toHaveLength(2);
  });

  it("keeps awards within the call total, ignoring revoked ones and checking exact amounts", () => {
    const s = good(); // 600 awarded + 300 revoked, total 1000
    expect(names(s)).not.toContain("FUNDING_WITHIN_CALL_TOTAL");
    s.funding.push({ id: "f3", projectId: "prj_1", amountMinor: "401", state: "awarded" });
    expect(names(s)).toContain("FUNDING_WITHIN_CALL_TOTAL");
    const big = good();
    big.call.fundingTotalMinor = "99999999999999999999";
    big.funding = [{ id: "f", projectId: "prj_1", amountMinor: "100000000000000000000", state: "awarded" }];
    expect(names(big)).toContain("FUNDING_WITHIN_CALL_TOTAL");
    big.funding = [{ id: "f", projectId: "prj_1", amountMinor: "1.5", state: "awarded" }];
    expect(names(big)).toContain("FUNDING_AMOUNT_VALID");
  });

  it("restricts publications to the project's own outputs and to completed projects", () => {
    const s = good();
    s.publications = [{ id: "p1", projectId: "prj_1", outputIds: ["o1", "other"], state: "published" }];
    expect(names(s)).toEqual(expect.arrayContaining(["PUBLICATION_USES_PROJECT_OUTPUTS", "PUBLISH_AFTER_COMPLETION"]));
    s.project.state = "completed";
    s.publications = [{ id: "p1", projectId: "prj_1", outputIds: ["o1"], state: "published" }];
    expect(names(s)).toEqual([]);
  });

  it("requires a published call for a running project", () => {
    const s = good();
    s.call.state = "draft";
    expect(names(s)).toContain("ACTIVE_PROJECT_HAS_PUBLISHED_CALL");
  });
});
