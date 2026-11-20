import { describe, expect, it } from "vitest";
import { actionableFindings, isPreflightCurrent, runPreflight, type PreflightContext } from "./proposal-preflight";

const ctx = (over: Partial<PreflightContext> = {}): PreflightContext => ({
  now: "2026-03-01T10:00:00.000Z",
  callStatus: "open",
  callClosesAt: "2026-04-01T00:00:00.000Z",
  teamSize: 3,
  minTeamSize: 2,
  maxTeamSize: 5,
  profileComplete: true,
  hasActiveSubmission: false,
  requiredDocuments: ["cv"],
  providedDocuments: ["cv", "letter"],
  supervisorRequired: true,
  supervisorNamed: true,
  ...over,
});
const failing = (r: ReturnType<typeof runPreflight>) => r.findings.filter((f) => f.outcome === "fail").map((f) => f.ruleId);

describe("proposal preflight", () => {
  it("passes when every rule passes", () => {
    const r = runPreflight(ctx());
    expect(r.status).toBe("pass");
    expect(r.findings.every((f) => f.message === "" && f.remediation === "")).toBe(true);
  });

  it("fails when the call is closed or past its deadline", () => {
    expect(failing(runPreflight(ctx({ callStatus: "closed" })))).toEqual(["call-open"]);
    expect(failing(runPreflight(ctx({ now: "2026-04-01T00:00:00.000Z" })))).toEqual(["call-open"]);
  });

  it("fails on team size, duplicates, documents and supervisor", () => {
    const r = runPreflight(ctx({ teamSize: 9, hasActiveSubmission: true, providedDocuments: [], supervisorNamed: false }));
    expect(r.status).toBe("fail");
    expect(failing(r)).toEqual(["team-size", "no-duplicate", "documents", "supervisor"]);
  });

  it("needs information when facts are not known yet", () => {
    const r = runPreflight(ctx({ teamSize: undefined, profileComplete: undefined }));
    expect(r.status).toBe("needs_information");
    expect(r.findings.filter((f) => f.outcome === "unknown").map((f) => f.ruleId)).toEqual(["team-size", "profile-complete"]);
  });

  it("a failure outranks missing information", () => {
    expect(runPreflight(ctx({ teamSize: undefined, callStatus: "closed" })).status).toBe("fail");
  });

  it("skips the supervisor check when none is required", () => {
    expect(runPreflight(ctx({ supervisorRequired: false, supervisorNamed: undefined })).status).toBe("pass");
  });

  it("gives remediation without repeating private data", () => {
    const r = runPreflight(ctx({ profileComplete: false }));
    const f = r.findings.find((x) => x.ruleId === "profile-complete");
    expect(f?.message).toBe("Your profile does not yet meet the call's requirements.");
    expect(f?.remediation.length).toBeGreaterThan(0);
  });

  it("lists failures before open questions", () => {
    const r = runPreflight(ctx({ teamSize: undefined, hasActiveSubmission: true }));
    expect(actionableFindings(r).map((f) => f.ruleId)).toEqual(["no-duplicate", "team-size"]);
  });

  it("goes stale when the facts change", () => {
    const passed = runPreflight(ctx());
    expect(isPreflightCurrent(passed, ctx())).toBe(true);
    expect(isPreflightCurrent(passed, ctx({ providedDocuments: [] }))).toBe(false);
  });
});
