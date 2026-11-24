import { describe, expect, it } from "vitest";
import {
  canManageSecrets,
  CLASSIFICATION_LEVELS,
  MASKED_PLACEHOLDER,
  rotateProjectSecret,
  sanitizeTelemetryPayload,
  SENSITIVE_CATEGORIES,
  SENSITIVE_DEFINITIONS,
  type ProjectSecretItem,
  type SecretActor,
} from "./secrets-protection";

describe("CAPSTONE-109: Project Secrets and Sensitive-Field Protection", () => {
  const now = "2026-11-20T12:00:00.000Z";

  const ownerActor: SecretActor = {
    id: "usr_owner_1",
    organizationId: "org_alpha",
    role: "student",
    isProjectOwner: true,
  };

  const studentActor: SecretActor = {
    id: "usr_student_2",
    organizationId: "org_alpha",
    role: "student",
    isProjectOwner: false,
  };

  const foreignAdminActor: SecretActor = {
    id: "usr_admin_beta",
    organizationId: "org_beta",
    role: "administrator",
  };

  const sampleSecrets: ProjectSecretItem[] = [
    {
      id: "sec_token_1",
      projectId: "prj_100",
      organizationId: "org_alpha",
      category: "provider_tokens",
      name: "OpenAI Compute API Key",
      maskedValue: MASKED_PLACEHOLDER,
      classification: "secret",
      keyVersion: 1,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      status: "active",
    },
    {
      id: "sec_evidence_1",
      projectId: "prj_100",
      organizationId: "org_alpha",
      category: "evidence_keys",
      name: "Provenance Bundle Signing Key",
      maskedValue: MASKED_PLACEHOLDER,
      classification: "secret",
      keyVersion: 1,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      status: "active",
    },
    {
      id: "sec_notes_1",
      projectId: "prj_100",
      organizationId: "org_alpha",
      category: "private_notes",
      name: "Ethics Committee Deliberations",
      maskedValue: MASKED_PLACEHOLDER,
      classification: "restricted",
      keyVersion: 1,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      status: "active",
    },
  ];

  it("covers all 7 required sensitive data categories with classifications", () => {
    expect(SENSITIVE_CATEGORIES).toEqual([
      "provider_tokens",
      "private_notes",
      "precise_locations",
      "unpublished_ip",
      "evidence_keys",
      "datasets",
      "payout_references",
    ]);

    expect(CLASSIFICATION_LEVELS).toEqual(["secret", "confidential", "restricted"]);

    for (const cat of SENSITIVE_CATEGORIES) {
      const def = SENSITIVE_DEFINITIONS[cat];
      expect(def).toBeDefined();
      expect(CLASSIFICATION_LEVELS).toContain(def.classification);
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
      expect(typeof def.supportsRotation).toBe("boolean");
      expect(def.allowedViewerRoles.length).toBeGreaterThan(0);
    }

    // Only provider_tokens and evidence_keys support rotation
    expect(SENSITIVE_DEFINITIONS.provider_tokens.supportsRotation).toBe(true);
    expect(SENSITIVE_DEFINITIONS.evidence_keys.supportsRotation).toBe(true);
    expect(SENSITIVE_DEFINITIONS.precise_locations.supportsRotation).toBe(false);
    expect(SENSITIVE_DEFINITIONS.payout_references.supportsRotation).toBe(false);
  });

  it("validates management authorization per actor role", () => {
    expect(canManageSecrets(ownerActor, "provider_tokens")).toBe(true);
    expect(canManageSecrets(studentActor, "provider_tokens")).toBe(false);
  });

  it("rotates supported secrets successfully without leaking tokens in metadata", () => {
    const result = rotateProjectSecret(sampleSecrets, {
      requestId: "req_rot_1",
      secretId: "sec_token_1",
      projectId: "prj_100",
      organizationId: "org_alpha",
      actor: ownerActor,
      now: "2026-11-20T12:30:00.000Z",
      expectedRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.keyVersion).toBe(2);
    expect(result.value.revision).toBe(2);
    expect(result.value.lastRotatedAt).toBe("2026-11-20T12:30:00.000Z");
    expect(result.value.maskedValue).toBe(MASKED_PLACEHOLDER);
    // Never reveals raw token
    expect((result.value as unknown as Record<string, unknown>).rawToken).toBeUndefined();
  });

  it("rejects rotation for categories that do not support it", () => {
    const result = rotateProjectSecret(sampleSecrets, {
      requestId: "req_rot_bad",
      secretId: "sec_notes_1",
      projectId: "prj_100",
      organizationId: "org_alpha",
      actor: ownerActor,
      now,
      expectedRevision: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("ROTATION_NOT_SUPPORTED");
  });

  it("rejects unauthorized actors from initiating rotation", () => {
    const result = rotateProjectSecret(sampleSecrets, {
      requestId: "req_unauth_rot",
      secretId: "sec_token_1",
      projectId: "prj_100",
      organizationId: "org_alpha",
      actor: studentActor,
      now,
      expectedRevision: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_PERMITTED");
  });

  it("rejects cross-tenant secret rotation requests", () => {
    const result = rotateProjectSecret(sampleSecrets, {
      requestId: "req_cross_tenant",
      secretId: "sec_token_1",
      projectId: "prj_100",
      organizationId: "org_alpha",
      actor: foreignAdminActor,
      now,
      expectedRevision: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("TENANT_MISMATCH");
  });

  it("detects stale revisions during rotation", () => {
    const result = rotateProjectSecret(sampleSecrets, {
      requestId: "req_stale_rot",
      secretId: "sec_token_1",
      projectId: "prj_100",
      organizationId: "org_alpha",
      actor: ownerActor,
      now,
      expectedRevision: 99,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("STALE_REVISION");
  });

  it("handles duplicate rotation requests idempotently", () => {
    const ledger = new Map();
    const req = {
      requestId: "req_idem_rot",
      secretId: "sec_evidence_1",
      projectId: "prj_100",
      organizationId: "org_alpha",
      actor: ownerActor,
      now,
      expectedRevision: 1,
    };

    const first = rotateProjectSecret(sampleSecrets, req, ledger);
    expect(first.ok).toBe(true);
    expect(first.replayed).toBeFalsy();

    const second = rotateProjectSecret(sampleSecrets, req, ledger);
    expect(second.ok).toBe(true);
    expect(second.replayed).toBe(true);
  });

  it("scrubs secrets and tokens from telemetry payloads", () => {
    const payload = sanitizeTelemetryPayload({
      eventName: "project_settings_viewed",
      payload: {
        projectId: "prj_100",
        providerApiKey: "sk-live-1234567890abcdef",
        userPasswordToken: "secret-token-value",
        safeCount: 42,
      },
    });

    expect(payload.projectId).toBe("prj_100");
    expect(payload.safeCount).toBe(42);
    expect(payload.providerApiKey).toBe("[REDACTED]");
    expect(payload.userPasswordToken).toBe("[REDACTED]");
  });
});
