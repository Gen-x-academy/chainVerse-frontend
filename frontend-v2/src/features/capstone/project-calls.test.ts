import { describe, expect, it } from "vitest";
import { createCallDraft, validateDraftFields, validateForPublish, type CallActor, type CallDraft } from "./project-calls";

const staff: CallActor = { id: "u1", role: "organization_staff", organizationId: "org1" };
const id = () => "cal_0000000000000001";
const complete = {
  organizationId: "org1",
  theme: "Climate data",
  problemStatement: "Communities lack open, reliable local climate data.",
  outcomes: ["Open dataset", "Prototype dashboard"],
  eligibility: "Enrolled final-year students",
  timeline: { opensOn: "2026-02-01", closesOn: "2026-03-01", projectsStartOn: "2026-03-15", projectsEndOn: "2026-09-01" },
  capacity: 12,
  funding: { currency: "USD", totalMinor: "5000000" },
  visibility: "public" as const,
};

describe("project calls", () => {
  it("lets authorized staff create a draft owned by them", () => {
    const r = createCallDraft(staff, complete, id);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.call).toMatchObject({ id: "cal_0000000000000001", ownerId: "u1", status: "draft", revision: 1, visibility: "public" });
  });

  it("denies every non-author role by default", () => {
    for (const role of ["student", "tutor", "supervisor", "reviewer", "sponsor"] as const) {
      expect(createCallDraft({ ...staff, role }, complete, id)).toEqual({ ok: false, code: "FORBIDDEN", issues: [] });
    }
  });

  it("enforces the tenant boundary except for administrators", () => {
    expect(createCallDraft({ ...staff, organizationId: "org2" }, complete, id)).toMatchObject({ ok: false, code: "TENANT_MISMATCH" });
    expect(createCallDraft({ id: "a", role: "administrator", organizationId: "platform" }, complete, id).ok).toBe(true);
  });

  it("allows an incomplete draft but defaults it to private", () => {
    const r = createCallDraft(staff, { organizationId: "org1", theme: "Climate data" }, id);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.call).toMatchObject({ visibility: "private", capacity: 0, outcomes: [] });
  });

  it("returns field-level issues for bad draft values", () => {
    const bad = { organizationId: "org1", theme: "x", capacity: 0, visibility: "everyone" as never, timeline: { opensOn: "tomorrow" }, funding: { currency: "usd", totalMinor: "1.5" } };
    expect(validateDraftFields(bad).map((i) => i.field).sort()).toEqual(["capacity", "funding.currency", "funding.totalMinor", "theme", "timeline.opensOn", "visibility"]);
    expect(createCallDraft(staff, bad, id)).toMatchObject({ ok: false, code: "INVALID" });
  });

  it("is publishable only when complete and the timeline is consistent", () => {
    const draft = (createCallDraft(staff, complete, id) as { ok: true; call: CallDraft }).call;
    expect(validateForPublish(draft)).toEqual([]);
    const empty = (createCallDraft(staff, { organizationId: "org1" }, id) as { ok: true; call: CallDraft }).call;
    expect(validateForPublish(empty).map((i) => i.field)).toEqual(expect.arrayContaining(["theme", "problemStatement", "outcomes", "eligibility", "capacity", "funding", "timeline.opensOn"]));
  });

  it("rejects inconsistent timelines", () => {
    const base = (createCallDraft(staff, complete, id) as { ok: true; call: CallDraft }).call;
    const issuesFor = (timeline: CallDraft["timeline"]) => validateForPublish({ ...base, timeline }).map((i) => i.field);
    expect(issuesFor({ ...base.timeline, closesOn: "2026-01-01" })).toContain("timeline.closesOn");
    expect(issuesFor({ ...base.timeline, projectsStartOn: "2026-02-15" })).toContain("timeline.projectsStartOn");
    expect(issuesFor({ ...base.timeline, projectsEndOn: "2026-03-15" })).toContain("timeline.projectsEndOn");
  });
});
