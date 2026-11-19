import { describe, expect, it } from "vitest";
import { completeness, newDraft, submitDraft, updateField, validateForSubmit, validateLimits, type CallWindow, type ProposalDraft } from "./proposal-drafts";

const call: CallWindow = { id: "cal_1", projectsStartOn: "2026-03-15", projectsEndOn: "2026-09-01", open: true };
const long = (n: number) => "x".repeat(n);
const complete = (): ProposalDraft => ({
  ...newDraft("prp_1", "u1", "cal_1"),
  title: "Open climate dashboard",
  abstract: long(60),
  problem: long(60),
  objectives: ["Publish an open dataset"],
  methods: long(40),
  expectedOutputs: ["Dataset", "Dashboard"],
  timeline: { startsOn: "2026-04-01", endsOn: "2026-08-01", milestones: [{ title: "Prototype", dueOn: "2026-06-01" }] },
  risks: ["Data access delays"],
  resources: "Laptop and cloud credits",
  preferredRoles: ["developer"],
});
const fields = (issues: { field: string }[]) => issues.map((i) => i.field).sort();

describe("proposal drafts", () => {
  it("starts empty, owned and revision 1", () => {
    expect(newDraft("p", "u1")).toMatchObject({ status: "draft", revision: 1, objectives: [], timeline: {} });
    expect(newDraft("p", "u1", "cal_1").callId).toBe("cal_1");
  });

  it("accepts a complete draft linked to an open call", () => {
    expect(validateForSubmit(complete(), call)).toEqual([]);
    expect(completeness(complete(), call)).toEqual({ done: 11, total: 11 });
  });

  it("lists everything missing from an empty draft", () => {
    expect(fields(validateForSubmit(newDraft("p", "u1"), undefined))).toEqual(["abstract", "callId", "expectedOutputs", "methods", "objectives", "preferredRoles", "problem", "risks", "timeline", "title"]);
    expect(completeness(newDraft("p", "u1"), undefined).done).toBeLessThan(11);
  });

  it("checks the linked call: it must exist, match and be open", () => {
    expect(fields(validateForSubmit(complete(), undefined))).toEqual(["callId"]);
    expect(fields(validateForSubmit(complete(), { ...call, id: "other" }))).toEqual(["callId"]);
    expect(validateForSubmit(complete(), { ...call, open: false })[0].message).toMatch(/not accepting/);
  });

  it("requires the timeline to be ordered and inside the call's project window", () => {
    const withTimeline = (timeline: ProposalDraft["timeline"]) => validateForSubmit({ ...complete(), timeline }, call).map((i) => i.message);
    expect(withTimeline({ startsOn: "2026-05-01", endsOn: "2026-04-01" })[0]).toMatch(/after the start/);
    expect(withTimeline({ startsOn: "2026-03-01", endsOn: "2026-08-01" })[0]).toMatch(/must fit between/);
    expect(withTimeline({ startsOn: "2026-04-01", endsOn: "2026-10-01" })[0]).toMatch(/must fit between/);
    expect(withTimeline({ startsOn: "2026-04-01", endsOn: "2026-08-01", milestones: [{ title: "Late", dueOn: "2026-09-01" }] })[0]).toMatch(/milestone "Late"/);
    expect(withTimeline({})[0]).toMatch(/start and end date/);
  });

  it("bounds text and list sizes even for incomplete drafts", () => {
    const d = { ...newDraft("p", "u1"), title: long(121), objectives: Array.from({ length: 13 }, () => "x") };
    expect(fields(validateLimits(d))).toEqual(["objectives", "title"]);
    expect(updateField(newDraft("p", "u1"), "title", long(121))).toMatchObject({ ok: false, error: "TOO_LONG" });
    expect(updateField(newDraft("p", "u1"), "risks", ["r".repeat(301)])).toMatchObject({ ok: false, error: "TOO_LONG" });
  });

  it("updates one field at a time, bumping the revision and leaving the original untouched", () => {
    const d = newDraft("p", "u1");
    const r = updateField(d, "title", "A new title");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.draft).toMatchObject({ title: "A new title", revision: 2 });
    expect(d.title).toBe("");
  });

  it("submits only when valid, once, and freezes the draft", () => {
    expect(submitDraft(newDraft("p", "u1"), call)).toMatchObject({ ok: false });
    const first = submitDraft(complete(), call);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.draft).toMatchObject({ status: "submitted", revision: 2 });
    expect(submitDraft(first.draft, call)).toEqual({ ok: true, draft: first.draft }); // idempotent
    expect(updateField(first.draft, "title", "Changed")).toEqual({ ok: false, error: "SUBMITTED", issues: [] });
  });
});
