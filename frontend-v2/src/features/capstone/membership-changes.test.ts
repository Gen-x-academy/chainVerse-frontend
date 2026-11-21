import { describe, expect, it } from "vitest";
import { activeMembers, applyChange, everMembers, upcomingChanges, wasMemberOn, type ChangeResult, type TeamRoster } from "./membership-changes";

const roster = (): TeamRoster => ({
  teamId: "t1",
  maxSize: 3,
  members: [
    { userId: "lead", roleKeys: ["lead"], joinedOn: "2026-01-01" },
    { userId: "u2", roleKeys: ["developer"], joinedOn: "2026-01-01" },
  ],
  log: [],
});
const must = (r: ChangeResult): TeamRoster => {
  if (!r.ok) throw new Error(r.code);
  return r.roster;
};
const code = (r: ChangeResult) => (r.ok ? "ok" : r.code);

describe("join", () => {
  it("adds a member and logs the change", () => {
    const next = must(applyChange(roster(), { id: "c1", type: "join", userId: "u3", roleKeys: ["writer"], effectiveOn: "2026-02-01" }));
    expect(activeMembers(next).map((m) => m.userId)).toEqual(["lead", "u2", "u3"]);
    expect(next.log).toHaveLength(1);
  });

  it("refuses duplicates, a full team and a second lead", () => {
    expect(code(applyChange(roster(), { id: "c1", type: "join", userId: "u2", roleKeys: ["writer"], effectiveOn: "2026-02-01" }))).toBe("already_member");
    expect(code(applyChange(roster(), { id: "c1", type: "join", userId: "u3", roleKeys: ["lead"], effectiveOn: "2026-02-01" }))).toBe("second_lead");
    const full = must(applyChange(roster(), { id: "c1", type: "join", userId: "u3", roleKeys: ["writer"], effectiveOn: "2026-02-01" }));
    expect(code(applyChange(full, { id: "c2", type: "join", userId: "u4", roleKeys: ["writer"], effectiveOn: "2026-02-02" }))).toBe("team_full");
  });

  it("is safe to retry", () => {
    const change = { id: "c1", type: "join", userId: "u3", roleKeys: ["writer"], effectiveOn: "2026-02-01" } as const;
    const once = must(applyChange(roster(), change));
    expect(code(applyChange(once, change))).toBe("duplicate_change");
  });
});

describe("leave and removal", () => {
  it("keeps the departed member on record", () => {
    const next = must(applyChange(roster(), { id: "c1", type: "leave", userId: "u2", effectiveOn: "2026-03-01" }));
    expect(activeMembers(next).map((m) => m.userId)).toEqual(["lead"]);
    expect(everMembers(next)).toContain("u2");
    expect(wasMemberOn(next, "u2", "2026-02-15")).toBe(true);
    expect(wasMemberOn(next, "u2", "2026-03-01")).toBe(false);
  });

  it("needs a reason to remove, and never removes the lead", () => {
    expect(code(applyChange(roster(), { id: "c1", type: "removal", userId: "u2", reason: " ", effectiveOn: "2026-03-01" }))).toBe("needs_reason");
    expect(code(applyChange(roster(), { id: "c1", type: "removal", userId: "lead", reason: "inactive", effectiveOn: "2026-03-01" }))).toBe("would_leave_no_lead");
    expect(code(applyChange(roster(), { id: "c1", type: "leave", userId: "ghost", effectiveOn: "2026-03-01" }))).toBe("not_a_member");
  });

  it("rejects a date before the person joined", () => {
    expect(code(applyChange(roster(), { id: "c1", type: "leave", userId: "u2", effectiveOn: "2025-12-31" }))).toBe("bad_date");
  });
});

describe("role change and substitution", () => {
  it("changes a role but keeps exactly one lead", () => {
    expect(must(applyChange(roster(), { id: "c1", type: "role_change", userId: "u2", roleKeys: ["analyst"], effectiveOn: "2026-02-01" })).members[1]?.roleKeys).toEqual(["analyst"]);
    expect(code(applyChange(roster(), { id: "c1", type: "role_change", userId: "u2", roleKeys: ["lead"], effectiveOn: "2026-02-01" }))).toBe("second_lead");
    expect(code(applyChange(roster(), { id: "c1", type: "role_change", userId: "lead", roleKeys: ["developer"], effectiveOn: "2026-02-01" }))).toBe("would_leave_no_lead");
  });

  it("substitutes a lead and passes the roles on", () => {
    const next = must(applyChange(roster(), { id: "c1", type: "substitution", outgoingUserId: "lead", incomingUserId: "u9", effectiveOn: "2026-04-01" }));
    expect(activeMembers(next).find((m) => m.userId === "u9")?.roleKeys).toEqual(["lead"]);
    expect(wasMemberOn(next, "lead", "2026-03-31")).toBe(true);
    expect(wasMemberOn(next, "lead", "2026-04-01")).toBe(false);
  });

  it("refuses substituting in someone already on the team", () => {
    expect(code(applyChange(roster(), { id: "c1", type: "substitution", outgoingUserId: "u2", incomingUserId: "lead", effectiveOn: "2026-04-01" }))).toBe("already_member");
  });
});

describe("effective dates", () => {
  it("rejects malformed dates and lists future changes", () => {
    expect(code(applyChange(roster(), { id: "c1", type: "leave", userId: "u2", effectiveOn: "soon" }))).toBe("bad_date");
    const next = must(applyChange(roster(), { id: "c1", type: "leave", userId: "u2", effectiveOn: "2026-09-01" }));
    expect(upcomingChanges(next, "2026-06-01").map((c) => c.id)).toEqual(["c1"]);
    expect(upcomingChanges(next, "2026-09-01")).toEqual([]);
  });
});
