import { describe, expect, it } from "vitest";
import { CLONEABLE_FIELDS, acceptsApplications, archiveCall, cloneCall, dueForArchive, sunsetCall, type CallRecord } from "./call-lifecycle";

const source = (): CallRecord => ({
  id: "cal_a",
  status: "published",
  title: "Climate Capstone 2026",
  theme: "climate data",
  problemStatement: "Local climate data is scarce.",
  outcomes: ["dataset", "dashboard"],
  eligibilityRule: { type: "enrollment", required: true },
  termsTemplate: "terms-v3",
  capacity: 20,
  deliveryMode: "hybrid",
  cohortId: "co_2026",
  version: 7,
  participants: [{ id: "u1" }],
  applications: [{ id: "app1" }],
  decisions: [{ id: "d1" }],
  evidence: [{ id: "e1" }],
  budget: { total: "5000000" },
  payments: [{ id: "pay1" }],
  auditLog: [{ at: "x" }],
});

describe("call clone, archive and sunset", () => {
  it("clones safe configuration into a fresh draft", () => {
    const copy = cloneCall(source(), "cal_b");
    expect(copy).toMatchObject({ id: "cal_b", status: "draft", version: 1, title: "Climate Capstone 2026 (copy)", theme: "climate data", capacity: 20, deliveryMode: "hybrid", termsTemplate: "terms-v3" });
    expect(copy.eligibilityRule).toEqual({ type: "enrollment", required: true });
  });

  it("never copies participants, decisions, evidence or financial records", () => {
    const copy = cloneCall(source(), "cal_b") as unknown as Record<string, unknown>;
    for (const forbidden of ["participants", "applications", "decisions", "evidence", "budget", "payments", "auditLog", "sunsetOn", "archivedOn"]) {
      expect(copy).not.toHaveProperty(forbidden);
    }
    expect(Object.keys(copy).sort()).toEqual(["capacity", "deliveryMode", "eligibilityRule", "id", "outcomes", "problemStatement", "status", "termsTemplate", "theme", "title", "version"]);
    expect(CLONEABLE_FIELDS).not.toContain("participants" as never);
  });

  it("deep-copies nested configuration so the clone cannot alias the source", () => {
    const s = source();
    const copy = cloneCall(s, "cal_b");
    copy.outcomes.push("extra");
    (copy.eligibilityRule as { required: boolean }).required = false;
    expect(s.outcomes).toEqual(["dataset", "dashboard"]);
    expect(s.eligibilityRule).toEqual({ type: "enrollment", required: true });
  });

  it("applies title and cohort overrides", () => {
    expect(cloneCall(source(), "cal_c", { title: " Climate 2027 ", cohortId: "co_2027" })).toMatchObject({ title: "Climate 2027", cohortId: "co_2027" });
  });

  it("sunsets a published call and stops applications from that date", () => {
    const r = sunsetCall(source(), "2026-06-30", "2026-06-01");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.call).toMatchObject({ status: "sunset", sunsetOn: "2026-06-30", version: 8 });
    expect(acceptsApplications(r.call, "2026-06-29")).toBe(true);
    expect(acceptsApplications(r.call, "2026-06-30")).toBe(false);
    expect(r.call.participants).toHaveLength(1); // history is untouched
  });

  it("validates sunset requests", () => {
    expect(sunsetCall(source(), "2026-05-31", "2026-06-01")).toEqual({ ok: false, error: "SUNSET_IN_PAST" });
    expect(sunsetCall(source(), "June", "2026-06-01")).toEqual({ ok: false, error: "INVALID_DATE" });
    expect(sunsetCall({ ...source(), status: "draft" }, "2026-06-30", "2026-06-01")).toEqual({ ok: false, error: "NOT_PUBLISHED" });
  });

  it("archives a call once and keeps its history", () => {
    const r = archiveCall(source(), "2026-07-01");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.call).toMatchObject({ status: "archived", archivedOn: "2026-07-01", version: 8 });
    expect(r.call.decisions).toHaveLength(1);
    expect(archiveCall(r.call, "2026-07-02")).toEqual({ ok: false, error: "ALREADY_ARCHIVED" });
    expect(acceptsApplications(r.call, "2026-07-02")).toBe(false);
  });

  it("finds sunset calls that are due to be archived", () => {
    const a = (id: string, sunsetOn: string): CallRecord => ({ ...source(), id, status: "sunset", sunsetOn });
    expect(dueForArchive([a("x", "2026-06-30"), a("y", "2026-07-30"), source()], "2026-06-30")).toEqual(["x"]);
  });
});
