import { describe, expect, it } from "vitest";
import { ACTIONS, FORBIDDEN, PERMISSIONS, ROLES, actionsFor, authorize, showsNavigation, type Actor, type Resource } from "./role-permissions";

const actor = (role: Actor["role"], id = "u1", organizationId = "org1"): Actor => ({ id, role, organizationId });
const resource = (over: Partial<Resource> = {}): Resource => ({ organizationId: "org1", ...over });
const reason = (d: ReturnType<typeof authorize>) => (d.allowed ? "allowed" : d.reason);

describe("capstone role and permission matrix", () => {
  it("covers all nine roles and denies everything not granted", () => {
    expect(ROLES).toHaveLength(9);
    for (const role of ROLES) {
      for (const action of ACTIONS) {
        const decision = authorize(actor(role), action, resource({ ownerId: "u1", assignedIds: ["u1"] }));
        const granted = PERMISSIONS[role][action] !== undefined && !FORBIDDEN[role]?.includes(action);
        expect(decision.allowed, `${role} ${action}`).toBe(granted);
      }
    }
  });

  it("grants no single role every action (least privilege)", () => {
    for (const role of ROLES) expect(actionsFor(role).length).toBeLessThan(ACTIONS.length);
  });

  it("separates duties: nobody who approves money can also decide proposals or review them", () => {
    for (const role of ROLES) {
      const actions = actionsFor(role);
      if (actions.includes("funding.approve")) {
        expect(actions).not.toContain("proposal.decide");
        expect(actions).not.toContain("proposal.review");
      }
    }
    expect(authorize(actor("administrator"), "funding.approve", resource())).toEqual({ allowed: false, reason: "FORBIDDEN_FOR_ROLE" });
    expect(authorize(actor("reviewer"), "proposal.decide", resource({ assignedIds: ["u1"] }))).toEqual({ allowed: false, reason: "FORBIDDEN_FOR_ROLE" });
  });

  it("limits students to their own records", () => {
    expect(reason(authorize(actor("student"), "proposal.view", resource({ ownerId: "u1" })))).toBe("allowed");
    expect(reason(authorize(actor("student"), "proposal.view", resource({ ownerId: "someone-else" })))).toBe("NOT_OWNER");
    expect(reason(authorize(actor("student"), "call.create", resource()))).toBe("NOT_GRANTED");
  });

  it("limits supervisors, reviewers and ethics officers to assigned records", () => {
    for (const [role, action] of [["supervisor", "proposal.decide"], ["reviewer", "proposal.review"], ["ethics_officer", "ethics.review"]] as const) {
      expect(reason(authorize(actor(role), action, resource({ assignedIds: ["u1"] })))).toBe("allowed");
      expect(reason(authorize(actor(role), action, resource({ assignedIds: ["other"] })))).toBe("NOT_ASSIGNED");
      expect(reason(authorize(actor(role), action, resource()))).toBe("NOT_ASSIGNED");
    }
  });

  it("enforces the tenant boundary for everyone except administrators", () => {
    expect(reason(authorize(actor("organization_staff"), "call.create", resource({ organizationId: "org2" })))).toBe("TENANT_MISMATCH");
    expect(reason(authorize(actor("finance_staff"), "funding.approve", resource({ organizationId: "org2" })))).toBe("TENANT_MISMATCH");
    expect(reason(authorize(actor("administrator", "a1", "platform"), "audit.view", resource({ organizationId: "org2" })))).toBe("allowed");
    expect(reason(authorize(actor("organization_staff"), "call.create", resource()))).toBe("allowed");
  });

  it("lets everyone view public calls without a resource, but requires a resource for anything else", () => {
    for (const role of ROLES) expect(reason(authorize(actor(role), "call.view_public"))).toBe("allowed");
    expect(reason(authorize(actor("supervisor"), "project.view"))).toBe("NOT_GRANTED");
  });

  it("keeps sponsors away from proposal content and funding limited to their own", () => {
    expect(reason(authorize(actor("sponsor"), "proposal.view", resource({ ownerId: "u1" })))).toBe("FORBIDDEN_FOR_ROLE");
    expect(reason(authorize(actor("sponsor"), "funding.view", resource({ ownerId: "u1" })))).toBe("allowed");
    expect(reason(authorize(actor("sponsor"), "funding.view", resource({ ownerId: "other" })))).toBe("NOT_OWNER");
  });

  it("rejects unknown roles and actions", () => {
    expect(authorize({ id: "x", role: "wizard" as never, organizationId: "org1" }, "call.view_public")).toEqual({ allowed: false, reason: "UNKNOWN_ROLE" });
    expect(authorize(actor("student"), "everything" as never, resource())).toEqual({ allowed: false, reason: "UNKNOWN_ACTION" });
  });

  it("derives navigation from the matrix", () => {
    expect(showsNavigation("organization_staff", "call.create")).toBe(true);
    expect(showsNavigation("student", "call.create")).toBe(false);
    expect(showsNavigation("sponsor", "proposal.view")).toBe(false);
    expect(actionsFor("student")).toEqual(["call.view_public", "milestone.submit", "project.view", "proposal.create", "proposal.view"]);
  });
});
