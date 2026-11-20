import { describe, expect, it } from "vitest";
import { acceptanceProgress, activateTeam, cancelAcceptance, recordApproval, updateTerms, type Approval, type TeamAcceptance } from "./team-acceptance";

const team = (over: Partial<TeamAcceptance> = {}): TeamAcceptance => ({
  teamId: "t1",
  requiredMemberIds: ["u1", "u2"],
  requiredSupervisors: 1,
  currentTermsVersion: 2,
  approvals: [],
  reservedSupervisorSlots: 1,
  status: "pending",
  ...over,
});
const ok = (userId: string, role: Approval["role"] = "member", termsVersion = 2): Approval => ({ userId, role, termsVersion, approvedAt: "2026-03-01T00:00:00.000Z" });

describe("team acceptance", () => {
  it("is not ready until every member and supervisor has approved", () => {
    let t = team();
    t = recordApproval(t, ok("u1")).team;
    expect(acceptanceProgress(t)).toMatchObject({ missingMembers: ["u2"], supervisorsMissing: 1, ready: false });
    t = recordApproval(t, ok("u2")).team;
    t = recordApproval(t, ok("s1", "supervisor")).team;
    expect(acceptanceProgress(t).ready).toBe(true);
  });

  it("ignores a repeated approval", () => {
    const first = recordApproval(team(), ok("u1")).team;
    const again = recordApproval(first, ok("u1"));
    expect(again.team).toBe(first);
    expect(again.error).toBeUndefined();
  });

  it("refuses approvals for old terms, strangers and closed teams", () => {
    expect(recordApproval(team(), ok("u1", "member", 1)).error).toBe("stale_terms");
    expect(recordApproval(team(), ok("zz")).error).toBe("not_required");
    expect(recordApproval(team({ status: "active" }), ok("u1")).error).toBe("not_pending");
  });

  it("drops approvals when the terms change", () => {
    let t = recordApproval(team(), ok("u1")).team;
    t = updateTerms(t, 3);
    expect(acceptanceProgress(t)).toMatchObject({ missingMembers: ["u1", "u2"], staleApprovers: ["u1"] });
    expect(updateTerms(t, 1)).toBe(t);
  });

  it("activates only with all approvals and reserved capacity", () => {
    let t = team({ reservedSupervisorSlots: 0 });
    for (const a of [ok("u1"), ok("u2"), ok("s1", "supervisor")]) t = recordApproval(t, a).team;
    expect(activateTeam(t).blockers).toEqual(["supervisor capacity is not reserved"]);
    const held = { ...t, reservedSupervisorSlots: 1 };
    expect(activateTeam(held).team.status).toBe("active");
  });

  it("lists what is still missing", () => {
    expect(activateTeam(team()).blockers).toEqual(["waiting for 2 member approval(s)", "waiting for 1 supervisor approval(s)"]);
  });

  it("releases capacity when cancelled", () => {
    const c = cancelAcceptance(team());
    expect(c).toMatchObject({ status: "cancelled", reservedSupervisorSlots: 0 });
    expect(cancelAcceptance(c)).toBe(c);
  });
});
