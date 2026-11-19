import { describe, expect, it } from "vitest";
import { buildOpportunityDetail, nextActions, type OpportunitySource, type ViewerContext } from "./opportunity-detail";

const source = (over: Partial<OpportunitySource> = {}): OpportunitySource => ({
  id: "cal_1",
  title: "Climate dashboard",
  status: "open",
  problemStatement: "Communities lack local climate data.",
  outcomes: ["Open dataset"],
  prerequisites: ["Statistics 101"],
  timeline: { opensOn: "2026-02-01", closesOn: "2026-03-01", startsOn: "2026-03-15", endsOn: "2026-09-01" },
  roles: [{ name: "Analyst", seats: 2, description: "Analyses data" }],
  sponsor: { name: "Example Foundation", disclosed: true },
  termsVersion: 3,
  seats: { total: 5, taken: 2, waitlistOpen: true },
  internalNotes: "Prefers applicants from region X",
  reviewerIds: ["r1", "r2"],
  budgetMinor: "5000000",
  applicantCount: 41,
  ...over,
});
const view = (state: ViewerContext["state"], over: Partial<ViewerContext> = {}): ViewerContext => ({ state, ...over });
const TODAY = "2026-02-15";
const ids = (o: OpportunitySource, v: ViewerContext, today = TODAY) => nextActions(o, v, today).map((a) => a.id);

describe("opportunity detail", () => {
  it("presents the public sections", () => {
    const d = buildOpportunityDetail(source(), view("anonymous"), TODAY);
    expect(d).toMatchObject({
      title: "Climate dashboard",
      problemStatement: "Communities lack local climate data.",
      outcomes: ["Open dataset"],
      prerequisites: ["Statistics 101"],
      roles: [{ name: "Analyst" }],
      sponsor: { name: "Example Foundation" },
      termsVersion: 3,
      seats: { total: 5, remaining: 3, label: "3 of 5 seats left" },
    });
  });

  it("never exposes restricted data to non-staff", () => {
    const d = buildOpportunityDetail(source(), view("signed_in"), TODAY);
    const text = JSON.stringify(d);
    for (const leaked of ["Prefers applicants", "5000000", "r1", "41", "internalNotes", "budgetMinor"]) expect(text).not.toContain(leaked);
    expect(d).not.toHaveProperty("staff");
  });

  it("gives staff the restricted summary", () => {
    const d = buildOpportunityDetail(source(), view("signed_in", { staff: true }), TODAY);
    expect(d.staff).toEqual({ internalNotes: "Prefers applicants from region X", reviewerCount: 2, applicantCount: 41, budgetMinor: "5000000" });
    expect(buildOpportunityDetail(source({ internalNotes: undefined, reviewerIds: undefined, applicantCount: undefined, budgetMinor: undefined }), view("anonymous", { staff: true }), TODAY).staff).toEqual({ internalNotes: null, reviewerCount: 0, applicantCount: null, budgetMinor: null });
  });

  it("respects the sponsor disclosure setting", () => {
    expect(buildOpportunityDetail(source({ sponsor: { name: "Secret Org", disclosed: false } }), view("anonymous"), TODAY).sponsor).toEqual({ name: null, note: "Sponsor name is shared on request." });
    expect(JSON.stringify(buildOpportunityDetail(source({ sponsor: { name: "Secret Org", disclosed: false } }), view("anonymous"), TODAY))).not.toContain("Secret Org");
    expect(buildOpportunityDetail(source({ sponsor: undefined }), view("anonymous"), TODAY).sponsor).toBeNull();
  });

  it("offers one clear primary action per viewer state", () => {
    const open = source();
    expect(ids(open, view("anonymous"))).toEqual(["sign_in", "view_terms"]);
    expect(ids(open, view("signed_in", { profileComplete: false }))).toEqual(["complete_profile", "view_terms"]);
    expect(ids(open, view("signed_in", { eligible: false }))).toEqual(["none", "view_terms"]);
    expect(ids(open, view("signed_in", { eligible: true, profileComplete: true }))).toEqual(["apply", "view_terms"]);
    expect(ids(source({ seats: { total: 2, taken: 2, waitlistOpen: true } }), view("signed_in"))).toEqual(["join_waitlist", "view_terms"]);
    expect(ids(source({ seats: { total: 2, taken: 2, waitlistOpen: false } }), view("signed_in"))).toEqual(["none", "view_terms"]);
    expect(ids(open, view("reserved"))).toEqual(["confirm_seat", "withdraw", "view_terms"]);
    for (const state of ["applied", "waitlisted", "confirmed"] as const) expect(ids(open, view(state))).toEqual(["withdraw", "view_terms"]);
    for (const state of ["anonymous", "signed_in", "reserved", "confirmed"] as const) {
      expect(nextActions(open, view(state), TODAY).filter((a) => a.primary).length).toBeLessThanOrEqual(1);
    }
  });

  it("explains why applications are closed", () => {
    const late = nextActions(source(), view("signed_in"), "2026-03-02");
    expect(late[0]).toMatchObject({ id: "none", hint: "Closed on 2026-03-01" });
    expect(nextActions(source({ status: "archived" }), view("signed_in"), TODAY)[0].hint).toBe("This opportunity is archived");
  });

  it("labels seats when full", () => {
    expect(buildOpportunityDetail(source({ seats: { total: 2, taken: 2, waitlistOpen: true } }), view("anonymous"), TODAY).seats).toEqual({ total: 2, remaining: 0, label: "Full, waitlist open" });
    expect(buildOpportunityDetail(source({ seats: { total: 2, taken: 3, waitlistOpen: false } }), view("anonymous"), TODAY).seats.label).toBe("Full");
  });

  it("copies lists so the page cannot mutate the source", () => {
    const s = source();
    const d = buildOpportunityDetail(s, view("anonymous"), TODAY);
    d.outcomes.push("x");
    d.roles[0].name = "changed";
    expect(s.outcomes).toEqual(["Open dataset"]);
    expect(s.roles[0].name).toBe("Analyst");
  });
});
