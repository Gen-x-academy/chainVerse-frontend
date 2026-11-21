import { describe, expect, it } from "vitest";
import { approversFor, approvePause, daysBetween, pauseImpact, pauseStateOn, requestPause, resumeBlockers, resumeProject, type PauseRequest, type PauseResult } from "./project-pause";

const input = { id: "p1", reason: "illness" as const, startsOn: "2026-05-01", endsOn: "2026-05-11", requestedBy: "u1" };
const must = <T,>(r: PauseResult<T>): T => {
  if (!r.ok) throw new Error(r.code);
  return r.value;
};
const code = <T,>(r: PauseResult<T>) => (r.ok ? "ok" : r.code);

describe("requesting a pause", () => {
  it("counts days and picks approvers by length", () => {
    expect(daysBetween("2026-05-01", "2026-05-11")).toBe(10);
    expect(approversFor(10)).toEqual(["lead"]);
    expect(approversFor(20)).toEqual(["lead", "supervisor"]);
    expect(approversFor(45)).toEqual(["lead", "supervisor", "coordinator"]);
  });

  it("refuses bad dates, over-long pauses and a missing note for Other", () => {
    expect(code(requestPause({ ...input, endsOn: input.startsOn }, []))).toBe("bad_dates");
    expect(code(requestPause({ ...input, endsOn: "2026-08-01" }, []))).toBe("too_long");
    expect(code(requestPause({ ...input, reason: "other" }, []))).toBe("needs_note");
    expect(code(requestPause({ ...input, reason: "other", note: "Moving house" }, []))).toBe("ok");
  });

  it("stops at the total allowance and at overlaps", () => {
    const first = must(requestPause({ ...input, endsOn: "2026-06-30" }, []));
    expect(code(requestPause({ ...input, id: "p2", startsOn: "2026-06-15", endsOn: "2026-06-25" }, [first]))).toBe("overlaps");
    expect(code(requestPause({ ...input, id: "p2", startsOn: "2026-07-01", endsOn: "2026-08-01" }, [first]))).toBe("total_exceeded");
    expect(code(requestPause({ ...input, id: "p2", startsOn: "2026-07-01", endsOn: "2026-07-10" }, [first]))).toBe("ok");
  });
});

describe("impact", () => {
  it("shows the new deadline and the funding tranches that fall inside the pause", () => {
    const impact = pauseImpact(input, "2026-09-01", ["2026-04-30", "2026-05-05", "2026-05-11"]);
    expect(impact).toEqual({ days: 10, newDeadline: "2026-09-11", fundingTranchesAffected: 1 });
  });
});

describe("approval and state", () => {
  it("needs every required role", () => {
    let p = must(requestPause({ ...input, endsOn: "2026-05-25" }, []));
    p = must(approvePause(p, "lead"));
    expect(p.status).toBe("requested");
    expect(must(approvePause(p, "lead")).approvals).toEqual(["lead"]);
    expect(code(approvePause(p, "coordinator"))).toBe("wrong_state");
    p = must(approvePause(p, "supervisor"));
    expect(p.status).toBe("approved");
  });

  it("becomes active on its start day and expires on its end day", () => {
    const p = must(approvePause(must(requestPause(input, [])), "lead"));
    expect(pauseStateOn(p, "2026-04-30")).toBe("approved");
    expect(pauseStateOn(p, "2026-05-01")).toBe("active");
    expect(pauseStateOn(p, "2026-05-11")).toBe("expired");
  });
});

describe("resuming", () => {
  const active = (): PauseRequest => must(approvePause(must(requestPause(input, [])), "lead"));

  it("resumes early when nothing blocks", () => {
    const r = must(resumeProject(active(), "2026-05-05", []));
    expect(r).toMatchObject({ status: "resumed", resumedOn: "2026-05-05" });
  });

  it("refuses before the pause starts, and while blocked", () => {
    expect(code(resumeProject(active(), "2026-04-20", []))).toBe("wrong_state");
    expect(code(resumeProject(active(), "2026-05-05", ["the charter needs approval again"]))).toBe("blocked");
  });

  it("frees the unused days of an early resume", () => {
    const resumed = must(resumeProject(active(), "2026-05-03", []));
    expect(code(requestPause({ ...input, id: "p2", startsOn: "2026-05-03", endsOn: "2026-05-10" }, [resumed]))).toBe("ok");
  });

  it("lists what blocks a restart", () => {
    expect(resumeBlockers({ teamActiveMembers: 1, minTeamSize: 2, charterAccepted: false, guardianConsentsValid: false })).toHaveLength(3);
    expect(resumeBlockers({ teamActiveMembers: 3, minTeamSize: 2, charterAccepted: true, guardianConsentsValid: true })).toEqual([]);
  });
});
