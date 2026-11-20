import { describe, expect, it } from "vitest";
import { cancel, canMove, complete, confirmConsent, decide, inviteSuccessor, openRequest, recordTeamConsent, respondToInvite, startReview, writePlan, type RematchRequest, type RematchResult } from "./team-rematching";

const must = (r: RematchResult): RematchRequest => {
  if (!r.ok) throw new Error(r.code);
  return r.request;
};
const code = (r: RematchResult) => (r.ok ? "ok" : r.code);
const plan = { handoverNotes: "Docs in the wiki", coverage: [{ item: "Data cleaning", coveredBy: "u2" }], handoverBy: "2026-05-01" };

function approved(): RematchRequest {
  let r = must(openRequest({ id: "r1", teamId: "t1", requestedBy: "u1", reason: "member_departure", departingUserId: "u3" }));
  r = must(startReview(r, "coord"));
  return must(decide(r, true, "Reasonable request"));
}

describe("opening a request", () => {
  it("needs the skills or the departing member, depending on the reason", () => {
    expect(code(openRequest({ id: "r", teamId: "t", requestedBy: "u", reason: "skill_gap" }))).toBe("needs_reason_detail");
    expect(code(openRequest({ id: "r", teamId: "t", requestedBy: "u", reason: "member_departure" }))).toBe("needs_reason_detail");
    expect(code(openRequest({ id: "r", teamId: "t", requestedBy: "u", reason: "skill_gap", neededSkills: ["stats"] }))).toBe("ok");
  });
});

describe("coordinator review", () => {
  it("requires a note and moves in order", () => {
    let r = must(openRequest({ id: "r1", teamId: "t1", requestedBy: "u1", reason: "workload" }));
    expect(code(decide(r, true, "ok"))).toBe("wrong_state");
    r = must(startReview(r, "coord"));
    expect(code(decide(r, true, "  "))).toBe("needs_note");
    expect(must(decide(r, false, "Not needed")).status).toBe("rejected");
  });

  it("does not allow moving out of a finished state", () => {
    expect(canMove("completed", "cancelled")).toBe(false);
    expect(canMove("rejected", "in_review")).toBe(false);
  });
});

describe("successor invitations and consent", () => {
  it("does not invite twice", () => {
    const r = must(inviteSuccessor(approved(), "s1", "2026-04-01"));
    expect(r.status).toBe("successor_invited");
    expect(code(inviteSuccessor(r, "s1", "2026-04-02"))).toBe("already_invited");
  });

  it("only invited people can answer, and answering twice changes nothing", () => {
    let r = must(inviteSuccessor(approved(), "s1", "2026-04-01"));
    expect(code(respondToInvite(r, "zz", "accepted"))).toBe("not_invited");
    r = must(respondToInvite(r, "s1", "accepted"));
    const again = must(respondToInvite(r, "s1", "declined"));
    expect(again.invites[0]?.response).toBe("accepted");
  });

  it("needs both the team and the successor to consent", () => {
    let r = must(inviteSuccessor(approved(), "s1", "2026-04-01"));
    expect(code(confirmConsent(r))).toBe("needs_consent");
    r = must(respondToInvite(r, "s1", "accepted"));
    expect(code(confirmConsent(r))).toBe("needs_consent");
    r = must(recordTeamConsent(r));
    expect(must(confirmConsent(r)).status).toBe("consented");
  });
});

describe("completion", () => {
  function consented(): RematchRequest {
    let r = must(inviteSuccessor(approved(), "s1", "2026-04-01"));
    r = must(respondToInvite(r, "s1", "accepted"));
    r = must(recordTeamConsent(r));
    return must(confirmConsent(r));
  }

  it("needs the continuity plan", () => {
    expect(code(complete(consented()))).toBe("needs_plan");
    expect(code(writePlan(consented(), { ...plan, handoverNotes: " " }))).toBe("needs_plan");
  });

  it("completes with the accepted successor", () => {
    const done = must(complete(must(writePlan(consented(), plan))));
    expect(done).toMatchObject({ status: "completed", completedWith: "s1" });
    expect(code(writePlan(done, plan))).toBe("wrong_state");
  });

  it("can be cancelled before completion only", () => {
    expect(must(cancel(consented())).status).toBe("cancelled");
    const done = must(complete(must(writePlan(consented(), plan))));
    expect(code(cancel(done))).toBe("wrong_state");
  });
});
