import { describe, expect, it } from "vitest";
import {
  assessConsentValidity,
  CONSENT_PURPOSES,
  createConsentLedgerStore,
  grantConsent,
  initializeProjectConsents,
  PURPOSE_DEFINITIONS,
  sanitizeAuditTrail,
  withdrawConsent,
  type ConsentActor,
} from "./consent-ledger";

describe("CAPSTONE-105: Capstone Consent Ledger", () => {
  const actorStudent: ConsentActor = {
    id: "usr_student_1",
    organizationId: "org_acme",
    role: "student",
  };

  const actorOtherStudent: ConsentActor = {
    id: "usr_student_2",
    organizationId: "org_acme",
    role: "student",
  };

  const actorForeignOrg: ConsentActor = {
    id: "usr_student_1",
    organizationId: "org_other",
    role: "student",
  };

  const now = "2026-11-20T12:00:00.000Z";

  it("covers all seven required distinct consent purposes with metadata", () => {
    expect(CONSENT_PURPOSES).toEqual([
      "matching",
      "collaboration",
      "provider_access",
      "integrity_checks",
      "analytics",
      "publication",
      "credentials",
    ]);

    for (const p of CONSENT_PURPOSES) {
      const def = PURPOSE_DEFINITIONS[p];
      expect(def).toBeDefined();
      expect(def.title.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
      expect(def.dataCovered.length).toBeGreaterThan(0);
      expect(typeof def.isOptional).toBe("boolean");
    }

    // Collaboration and integrity checks are required; others optional
    expect(PURPOSE_DEFINITIONS.collaboration.isOptional).toBe(false);
    expect(PURPOSE_DEFINITIONS.integrity_checks.isOptional).toBe(false);
    expect(PURPOSE_DEFINITIONS.analytics.isOptional).toBe(true);
    expect(PURPOSE_DEFINITIONS.publication.isOptional).toBe(true);

    // Consequential withdrawal flags
    expect(PURPOSE_DEFINITIONS.collaboration.isConsequentialOnWithdrawal).toBe(true);
    expect(PURPOSE_DEFINITIONS.integrity_checks.isConsequentialOnWithdrawal).toBe(true);
    expect(PURPOSE_DEFINITIONS.provider_access.isConsequentialOnWithdrawal).toBe(true);
  });

  it("initializes project consents distinctly without blanket bundling", () => {
    const records = initializeProjectConsents("prj_100", "usr_student_1", "org_acme", now);
    expect(records).toHaveLength(7);
    const purposes = records.map((r) => r.purpose);
    expect(new Set(purposes).size).toBe(7);
    for (const r of records) {
      expect(r.state).toBe("pending");
      expect(r.revision).toBe(1);
      expect(r.projectId).toBe("prj_100");
      expect(r.participantId).toBe("usr_student_1");
    }
  });

  it("grants consent from pending state and bumps revision with audit entry", () => {
    const store = createConsentLedgerStore();
    const result = grantConsent(store, {
      requestId: "req_1",
      recordId: "cns_1",
      projectId: "prj_100",
      participantId: "usr_student_1",
      organizationId: "org_acme",
      purpose: "collaboration",
      actor: actorStudent,
      now,
      expectedRevision: 1,
      expiresAt: "2027-11-20T12:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state).toBe("granted");
    expect(result.value.revision).toBe(2);
    expect(result.value.grantedAt).toBe(now);

    expect(store.auditTrail).toHaveLength(1);
    expect(store.auditTrail[0].eventType).toBe("consent.granted");
    expect(store.auditTrail[0].toState).toBe("granted");
    expect(store.auditTrail[0].revision).toBe(2);
  });

  it("withdraws consent from granted state and records audit entry", () => {
    const store = createConsentLedgerStore();
    grantConsent(store, {
      requestId: "req_1",
      recordId: "cns_1",
      projectId: "prj_100",
      participantId: "usr_student_1",
      organizationId: "org_acme",
      purpose: "matching",
      actor: actorStudent,
      now,
      expectedRevision: 1,
    });

    const withdrawResult = withdrawConsent(store, {
      requestId: "req_2",
      recordId: "cns_1",
      projectId: "prj_100",
      participantId: "usr_student_1",
      organizationId: "org_acme",
      actor: actorStudent,
      now: "2026-11-21T10:00:00.000Z",
      expectedRevision: 2,
    });

    expect(withdrawResult.ok).toBe(true);
    if (!withdrawResult.ok) return;
    expect(withdrawResult.value.state).toBe("withdrawn");
    expect(withdrawResult.value.revision).toBe(3);
    expect(withdrawResult.value.withdrawnAt).toBe("2026-11-21T10:00:00.000Z");

    expect(store.auditTrail).toHaveLength(2);
    expect(store.auditTrail[1].eventType).toBe("consent.withdrawn");
    expect(store.auditTrail[1].toState).toBe("withdrawn");
  });

  it("handles duplicate submissions idempotently", () => {
    const store = createConsentLedgerStore();
    const req = {
      requestId: "req_idem_1",
      recordId: "cns_1",
      projectId: "prj_100",
      participantId: "usr_student_1",
      organizationId: "org_acme",
      purpose: "credentials" as const,
      actor: actorStudent,
      now,
      expectedRevision: 1,
    };

    const first = grantConsent(store, req);
    expect(first.ok).toBe(true);
    expect(first.replayed).toBeFalsy();

    const second = grantConsent(store, req);
    expect(second.ok).toBe(true);
    expect(second.replayed).toBe(true);
    expect(store.auditTrail).toHaveLength(1); // No duplicate audit entries
  });

  it("rejects stale revisions with STALE_REVISION error", () => {
    const store = createConsentLedgerStore();
    grantConsent(store, {
      requestId: "req_1",
      recordId: "cns_1",
      projectId: "prj_100",
      participantId: "usr_student_1",
      organizationId: "org_acme",
      purpose: "analytics",
      actor: actorStudent,
      now,
      expectedRevision: 1,
    });

    // Attempting to withdraw with stale revision 1 when current revision is 2
    const staleResult = withdrawConsent(store, {
      requestId: "req_stale",
      recordId: "cns_1",
      projectId: "prj_100",
      participantId: "usr_student_1",
      organizationId: "org_acme",
      actor: actorStudent,
      now: "2026-11-22T00:00:00.000Z",
      expectedRevision: 1,
    });

    expect(staleResult.ok).toBe(false);
    if (staleResult.ok) return;
    expect(staleResult.code).toBe("STALE_REVISION");
  });

  it("rejects unauthorized actors and cross-tenant requests", () => {
    const store = createConsentLedgerStore();

    // Cross-tenant attempt
    const tenantResult = grantConsent(store, {
      requestId: "req_tenant",
      recordId: "cns_1",
      projectId: "prj_100",
      participantId: "usr_student_1",
      organizationId: "org_acme",
      purpose: "publication",
      actor: actorForeignOrg,
      now,
      expectedRevision: 1,
    });
    expect(tenantResult.ok).toBe(false);
    if (!tenantResult.ok) {
      expect(tenantResult.code).toBe("TENANT_MISMATCH");
    }

    // Unauthorized third-party student
    const unauthResult = grantConsent(store, {
      requestId: "req_unauth",
      recordId: "cns_1",
      projectId: "prj_100",
      participantId: "usr_student_1",
      organizationId: "org_acme",
      purpose: "publication",
      actor: actorOtherStudent,
      now,
      expectedRevision: 1,
    });
    expect(unauthResult.ok).toBe(false);
    if (!unauthResult.ok) {
      expect(unauthResult.code).toBe("UNAUTHORIZED");
    }
  });

  it("rejects invalid transitions such as withdrawing an already withdrawn consent", () => {
    const store = createConsentLedgerStore();
    grantConsent(store, {
      requestId: "req_1",
      recordId: "cns_1",
      projectId: "prj_100",
      participantId: "usr_student_1",
      organizationId: "org_acme",
      purpose: "provider_access",
      actor: actorStudent,
      now,
      expectedRevision: 1,
    });

    withdrawConsent(store, {
      requestId: "req_2",
      recordId: "cns_1",
      projectId: "prj_100",
      participantId: "usr_student_1",
      organizationId: "org_acme",
      actor: actorStudent,
      now,
      expectedRevision: 2,
    });

    // Repeat withdraw
    const repeatWithdraw = withdrawConsent(store, {
      requestId: "req_3",
      recordId: "cns_1",
      projectId: "prj_100",
      participantId: "usr_student_1",
      organizationId: "org_acme",
      actor: actorStudent,
      now,
      expectedRevision: 3,
    });
    expect(repeatWithdraw.ok).toBe(false);
    if (!repeatWithdraw.ok) {
      expect(repeatWithdraw.code).toBe("INVALID_TRANSITION");
    }
  });

  it("accurately assesses validity and expiry", () => {
    const validRecord = {
      id: "cns_1",
      projectId: "prj_100",
      participantId: "usr_1",
      organizationId: "org_1",
      purpose: "matching" as const,
      state: "granted" as const,
      required: false,
      expiresAt: "2027-01-01T00:00:00.000Z",
      updatedAt: now,
      revision: 2,
    };

    expect(assessConsentValidity(validRecord, "2026-12-01T00:00:00.000Z")).toBe("granted");
    expect(assessConsentValidity(validRecord, "2027-01-02T00:00:00.000Z")).toBe("expired");
  });

  it("sanitizes audit trail ensuring no private payloads leak", () => {
    const entries = sanitizeAuditTrail([
      {
        eventType: "consent.granted",
        recordId: "cns_1",
        projectId: "prj_1",
        organizationId: "org_1",
        participantId: "usr_1",
        purpose: "integrity_checks",
        fromState: "pending",
        toState: "granted",
        revision: 2,
        timestamp: now,
      },
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0]).not.toHaveProperty("proposalText");
    expect(entries[0]).not.toHaveProperty("privatePayload");
    expect(entries[0]).not.toHaveProperty("secretToken");
  });
});
