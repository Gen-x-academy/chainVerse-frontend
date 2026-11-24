import { describe, expect, it } from "vitest";
import {
  AUDIENCE_DEFINITIONS,
  AUDIENCES,
  CATEGORY_DEFINITIONS,
  FIELD_CATEGORIES,
  filterProjectFieldsByAudience,
  initializeProjectPrivacy,
  isConsequentialPrivacyChange,
  updateFieldPrivacy,
  viewerSatisfiesAudience,
  type PrivacyActor,
  type ProjectDataFields,
} from "./field-privacy";

describe("CAPSTONE-106: Project Field-Level Privacy Controls", () => {
  const now = "2026-11-20T12:00:00.000Z";

  const ownerActor: PrivacyActor = {
    id: "usr_owner_1",
    organizationId: "org_alpha",
    role: "student",
    isProjectOwner: true,
  };

  const supervisorActor: PrivacyActor = {
    id: "usr_sup_1",
    organizationId: "org_alpha",
    role: "supervisor",
    isSupervisor: true,
  };

  const memberActor: PrivacyActor = {
    id: "usr_member_2",
    organizationId: "org_alpha",
    role: "student",
    isProjectOwner: false,
  };

  const foreignAdminActor: PrivacyActor = {
    id: "usr_admin_foreign",
    organizationId: "org_beta",
    role: "administrator",
  };

  it("covers all 9 required field categories and 6 audience choices", () => {
    expect(FIELD_CATEGORIES).toEqual([
      "profiles",
      "proposals",
      "membership",
      "notes",
      "progress",
      "outputs",
      "locations",
      "funding",
      "achievements",
    ]);

    expect(AUDIENCES).toEqual([
      "owner",
      "members",
      "collaborators",
      "providers",
      "organization_admin",
      "public",
    ]);

    for (const cat of FIELD_CATEGORIES) {
      const def = CATEGORY_DEFINITIONS[cat];
      expect(def).toBeDefined();
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
      expect(AUDIENCES).toContain(def.defaultAudience);
      expect(def.allowedAudiences.length).toBeGreaterThan(0);
    }

    for (const aud of AUDIENCES) {
      const def = AUDIENCE_DEFINITIONS[aud];
      expect(def).toBeDefined();
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
      expect(typeof def.rank).toBe("number");
    }
  });

  it("initializes project privacy policy with policy locks where required", () => {
    const policy = initializeProjectPrivacy("prj_100", "org_alpha", now, "usr_owner_1");
    expect(policy.projectId).toBe("prj_100");
    expect(policy.organizationId).toBe("org_alpha");
    expect(policy.revision).toBe(1);

    // Locations is policy locked
    expect(policy.settings.locations.isLocked).toBe(true);
    expect(policy.settings.locations.lockReason).toBeDefined();

    // Achievements defaults to public
    expect(policy.settings.achievements.effectiveAudience).toBe("public");

    // Proposals defaults to members
    expect(policy.settings.proposals.effectiveAudience).toBe("members");
  });

  it("allows project owner or supervisor to update field privacy", () => {
    const policy = initializeProjectPrivacy("prj_100", "org_alpha", now, "usr_owner_1");
    const result = updateFieldPrivacy(policy, {
      requestId: "req_update_1",
      projectId: "prj_100",
      organizationId: "org_alpha",
      category: "progress",
      newAudience: "public",
      expectedRevision: 1,
      actor: ownerActor,
      now: "2026-11-20T12:05:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.revision).toBe(2);
    expect(result.value.settings.progress.effectiveAudience).toBe("public");
    expect(result.value.settings.progress.updatedBy).toBe("usr_owner_1");
  });

  it("rejects unauthorized regular members from changing privacy settings", () => {
    const policy = initializeProjectPrivacy("prj_100", "org_alpha", now, "usr_owner_1");
    const result = updateFieldPrivacy(policy, {
      requestId: "req_unauth_1",
      projectId: "prj_100",
      organizationId: "org_alpha",
      category: "progress",
      newAudience: "public",
      expectedRevision: 1,
      actor: memberActor,
      now,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_PERMITTED");
  });

  it("rejects cross-tenant privacy updates", () => {
    const policy = initializeProjectPrivacy("prj_100", "org_alpha", now, "usr_owner_1");
    const result = updateFieldPrivacy(policy, {
      requestId: "req_cross_tenant",
      projectId: "prj_100",
      organizationId: "org_alpha",
      category: "progress",
      newAudience: "public",
      expectedRevision: 1,
      actor: foreignAdminActor,
      now,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("TENANT_MISMATCH");
  });

  it("prevents changing policy-locked fields", () => {
    const policy = initializeProjectPrivacy("prj_100", "org_alpha", now, "usr_owner_1");
    const result = updateFieldPrivacy(policy, {
      requestId: "req_locked_field",
      projectId: "prj_100",
      organizationId: "org_alpha",
      category: "locations",
      newAudience: "public",
      expectedRevision: 1,
      actor: supervisorActor,
      now,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("FIELD_LOCKED");
  });

  it("rejects disallowed audience levels for a category", () => {
    const policy = initializeProjectPrivacy("prj_100", "org_alpha", now, "usr_owner_1");
    // Notes does not allow public visibility
    const result = updateFieldPrivacy(policy, {
      requestId: "req_bad_audience",
      projectId: "prj_100",
      organizationId: "org_alpha",
      category: "notes",
      newAudience: "public",
      expectedRevision: 1,
      actor: ownerActor,
      now,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("AUDIENCE_NOT_ALLOWED");
  });

  it("detects stale revisions and prevents concurrent conflicts", () => {
    const policy = initializeProjectPrivacy("prj_100", "org_alpha", now, "usr_owner_1");
    const firstResult = updateFieldPrivacy(policy, {
      requestId: "req_1",
      projectId: "prj_100",
      organizationId: "org_alpha",
      category: "profiles",
      newAudience: "public",
      expectedRevision: 1,
      actor: ownerActor,
      now,
    });
    expect(firstResult.ok).toBe(true);

    // Stale update attempt using revision 1 instead of 2
    const staleResult = updateFieldPrivacy(firstResult.ok ? firstResult.value : policy, {
      requestId: "req_stale",
      projectId: "prj_100",
      organizationId: "org_alpha",
      category: "profiles",
      newAudience: "members",
      expectedRevision: 1,
      actor: ownerActor,
      now,
    });

    expect(staleResult.ok).toBe(false);
    if (staleResult.ok) return;
    expect(staleResult.code).toBe("STALE_REVISION");
  });

  it("flags consequential transitions that expose private data to wider audiences", () => {
    const pubCheck = isConsequentialPrivacyChange("proposals", "members", "public");
    expect(pubCheck.isConsequential).toBe(true);
    expect(pubCheck.warning).toContain("Public internet");

    const tightenCheck = isConsequentialPrivacyChange("proposals", "collaborators", "members");
    expect(tightenCheck.isConsequential).toBe(false);
  });

  it("evaluates viewer audience satisfaction accurately", () => {
    expect(viewerSatisfiesAudience("anonymous", "public")).toBe(true);
    expect(viewerSatisfiesAudience("anonymous", "members")).toBe(false);

    expect(viewerSatisfiesAudience("member", "members")).toBe(true);
    expect(viewerSatisfiesAudience("member", "owner")).toBe(false);

    expect(viewerSatisfiesAudience("owner", "owner")).toBe(true);
    expect(viewerSatisfiesAudience("owner", "members")).toBe(true);
    expect(viewerSatisfiesAudience("owner", "collaborators")).toBe(true);
  });

  it("scrubs restricted fields from unauthorized viewers in filterProjectFieldsByAudience", () => {
    const policy = initializeProjectPrivacy("prj_100", "org_alpha", now, "usr_owner_1");
    // policy has proposals = members, notes = members, achievements = public, funding = organization_admin

    const fullData: ProjectDataFields = {
      proposals: { title: "Quantum Computing for Logistics", budgetRequested: 50000 },
      notes: [{ id: "note_1", text: "Confidential reviewer meeting" }],
      achievements: [{ id: "ach_1", title: "Project Approved" }],
      funding: { pledgedAmount: "5000000" },
    };

    // Anonymous visitor should only see achievements
    const anonView = filterProjectFieldsByAudience(fullData, policy, "anonymous");
    expect(anonView.achievements).toBeDefined();
    expect(anonView.proposals).toBeUndefined();
    expect(anonView.notes).toBeUndefined();
    expect(anonView.funding).toBeUndefined();

    // Member should see achievements, proposals, and notes, but NOT funding
    const memberView = filterProjectFieldsByAudience(fullData, policy, "member");
    expect(memberView.achievements).toBeDefined();
    expect(memberView.proposals).toBeDefined();
    expect(memberView.notes).toBeDefined();
    expect(memberView.funding).toBeUndefined();

    // Org admin should see funding as well
    const adminView = filterProjectFieldsByAudience(fullData, policy, "organization_admin");
    expect(adminView.funding).toBeDefined();
  });
});
