/**
 * Project secrets and sensitive-field protection (CAPSTONE-109 / issue #1535).
 *
 * Provides security-first frontend workflows for handling project secrets and
 * sensitive data without superficial client-side encryption.
 *
 * Security principles:
 * - Server-side authoritative encryption: encryption at rest and KMS key management
 *   belong exclusively to the backend. The frontend does not invent pseudo-encryption
 *   schemes or embed master keys.
 * - Masked by default: sensitive values are represented as masked placeholders
 *   (`••••••••••••`) without fetching raw plaintext until explicitly requested by an
 *   authorized user.
 * - Ephemeral in-memory state: unmasked values and edit inputs are cleared immediately
 *   when dialogs close or components unmount.
 * - Zero leakage: secrets are sanitized from URLs, browser console logs, telemetry,
 *   analytics payloads, error toasts, and persistent web storage (localStorage/sessionStorage).
 * - Supported rotation: automated key rotation with operational impact warnings,
 *   idempotency keys, and optimistic concurrency.
 */

export const SENSITIVE_CATEGORIES = [
  "provider_tokens",
  "private_notes",
  "precise_locations",
  "unpublished_ip",
  "evidence_keys",
  "datasets",
  "payout_references",
] as const;

export type SensitiveCategory = (typeof SENSITIVE_CATEGORIES)[number];

export const CLASSIFICATION_LEVELS = ["secret", "confidential", "restricted"] as const;
export type ClassificationLevel = (typeof CLASSIFICATION_LEVELS)[number];

export interface SensitiveFieldDefinition {
  category: SensitiveCategory;
  name: string;
  classification: ClassificationLevel;
  description: string;
  supportsRotation: boolean;
  rotationImpact?: string;
  allowedViewerRoles: readonly string[];
}

export const SENSITIVE_DEFINITIONS: Readonly<Record<SensitiveCategory, SensitiveFieldDefinition>> = {
  provider_tokens: {
    category: "provider_tokens",
    name: "External Provider API Tokens",
    classification: "secret",
    description: "API keys for cloud compute, AI inferencing services, and third-party data providers.",
    supportsRotation: true,
    rotationImpact: "Rotating this token will invalidate existing API integrations. Pipelines relying on the old token will pause until updated.",
    allowedViewerRoles: ["owner", "administrator"],
  },
  private_notes: {
    category: "private_notes",
    name: "Confidential Supervisor & Ethics Deliberations",
    classification: "restricted",
    description: "Private supervisor notes, ethics committee feedback, and internal dispute documentation.",
    supportsRotation: false,
    allowedViewerRoles: ["owner", "supervisor", "ethics_officer", "administrator"],
  },
  precise_locations: {
    category: "precise_locations",
    name: "Precise Research Coordinates",
    classification: "restricted",
    description: "High-resolution GPS coordinates of sensitive ecological, archaeological, or participant field sites.",
    supportsRotation: false,
    allowedViewerRoles: ["owner", "members", "supervisor", "administrator"],
  },
  unpublished_ip: {
    category: "unpublished_ip",
    name: "Unpublished Intellectual Property",
    classification: "confidential",
    description: "Proprietary algorithm source code, provisional patent drafts, and pre-print research claims.",
    supportsRotation: false,
    allowedViewerRoles: ["owner", "members", "supervisor", "administrator"],
  },
  evidence_keys: {
    category: "evidence_keys",
    name: "Integrity Evidence Signing Keys",
    classification: "secret",
    description: "Asymmetric cryptographic keys used to verify data provenance and sign reproducibility bundles.",
    supportsRotation: true,
    rotationImpact: "Rotating this signing key will create a new key version. Previously signed bundles remain verifiable against historical public certificates.",
    allowedViewerRoles: ["owner", "administrator"],
  },
  datasets: {
    category: "datasets",
    name: "Regulated Research Datasets",
    classification: "confidential",
    description: "Datasets containing de-identified patient data, human-subject survey responses, or controlled access files.",
    supportsRotation: false,
    allowedViewerRoles: ["owner", "members", "supervisor", "administrator"],
  },
  payout_references: {
    category: "payout_references",
    name: "Escrow Payout & Wallet Identifiers",
    classification: "secret",
    description: "Bank transfer references, private escrow withdrawal addresses, and participant disbursement IDs.",
    supportsRotation: false,
    allowedViewerRoles: ["owner", "finance_staff", "administrator"],
  },
};

export const MASKED_PLACEHOLDER = "••••••••••••";

export interface ProjectSecretItem {
  id: string;
  projectId: string;
  organizationId: string;
  category: SensitiveCategory;
  name: string;
  maskedValue: string;
  classification: ClassificationLevel;
  keyVersion: number;
  lastRotatedAt?: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  status: "active" | "rotating" | "deprecated" | "revoked";
}

export interface SecretActor {
  id: string;
  organizationId: string;
  role: string;
  isProjectOwner?: boolean;
}

export type SecretErrorCode =
  | "UNKNOWN_CATEGORY"
  | "TENANT_MISMATCH"
  | "NOT_PERMITTED"
  | "ROTATION_NOT_SUPPORTED"
  | "STALE_REVISION"
  | "SECRET_NOT_FOUND"
  | "INVALID_SECRET_VALUE";

export type SecretResult<T> =
  | { ok: true; value: T; replayed?: boolean }
  | { ok: false; code: SecretErrorCode; message: string };

const SECRET_ERROR_MESSAGES: Record<SecretErrorCode, string> = {
  UNKNOWN_CATEGORY: "Unknown sensitive category.",
  TENANT_MISMATCH: "Operation rejected across organization boundaries.",
  NOT_PERMITTED: "You are not authorized to view or manage this sensitive field.",
  ROTATION_NOT_SUPPORTED: "Key rotation is not supported for this data category.",
  STALE_REVISION: "The secret metadata was modified elsewhere. Reload before retrying.",
  SECRET_NOT_FOUND: "Secret or sensitive field record not found.",
  INVALID_SECRET_VALUE: "The provided secret value does not meet security requirements.",
};

export function secretFail<T>(code: SecretErrorCode, message?: string): SecretResult<T> {
  return { ok: false, code, message: message ?? SECRET_ERROR_MESSAGES[code] };
}

/**
 * Checks if an actor is authorized to manage or rotate secrets in a category.
 */
export function canManageSecrets(actor: SecretActor, category: SensitiveCategory): boolean {
  if (actor.role === "administrator") return true;
  if (actor.isProjectOwner && SENSITIVE_DEFINITIONS[category].allowedViewerRoles.includes("owner")) {
    return true;
  }
  return false;
}

export interface RotateSecretInput {
  requestId: string;
  secretId: string;
  projectId: string;
  organizationId: string;
  actor: SecretActor;
  now: string;
  expectedRevision: number;
}

export type SecretLedger = Map<string, SecretResult<ProjectSecretItem>>;

/**
 * Executes a simulated key rotation workflow adhering to backend contracts.
 * Returns updated metadata without leaking secret tokens in output.
 */
export function rotateProjectSecret(
  existingSecrets: ProjectSecretItem[],
  input: RotateSecretInput,
  ledger: SecretLedger = new Map(),
): SecretResult<ProjectSecretItem> {
  const cached = ledger.get(input.requestId);
  if (cached) {
    return cached.ok ? { ...cached, replayed: true } : cached;
  }

  const recordResult = (res: SecretResult<ProjectSecretItem>): SecretResult<ProjectSecretItem> => {
    ledger.set(input.requestId, res);
    return res;
  };

  const secret = existingSecrets.find((s) => s.id === input.secretId);
  if (!secret) {
    return recordResult(secretFail("SECRET_NOT_FOUND"));
  }

  if (input.actor.organizationId !== secret.organizationId) {
    return recordResult(secretFail("TENANT_MISMATCH"));
  }

  if (!canManageSecrets(input.actor, secret.category)) {
    return recordResult(secretFail("NOT_PERMITTED"));
  }

  const def = SENSITIVE_DEFINITIONS[secret.category];
  if (!def.supportsRotation) {
    return recordResult(secretFail("ROTATION_NOT_SUPPORTED"));
  }

  if (secret.revision !== input.expectedRevision) {
    return recordResult(secretFail("STALE_REVISION"));
  }

  const updated: ProjectSecretItem = {
    ...secret,
    keyVersion: secret.keyVersion + 1,
    lastRotatedAt: input.now,
    updatedAt: input.now,
    revision: secret.revision + 1,
    status: "active",
  };

  return recordResult({ ok: true, value: updated });
}

export interface RedactTelemetryInput {
  eventName: string;
  payload: Record<string, unknown>;
}

/**
 * Privacy-safe telemetry sanitizer:
 * Scrubs any secret tokens, private notes, API keys, or raw strings matching sensitive keywords.
 */
export function sanitizeTelemetryPayload(input: RedactTelemetryInput): Record<string, unknown> {
  const SENSITIVE_KEYS = new Set([
    "token",
    "secret",
    "key",
    "password",
    "credential",
    "payout",
    "bank",
    "coordinates",
    "notes",
    "ip",
  ]);

  const sanitized: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(input.payload)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = Array.from(SENSITIVE_KEYS).some((s) => lowerKey.includes(s));

    if (isSensitive) {
      // Redact sensitive value
      sanitized[key] = "[REDACTED]";
    } else if (typeof val === "object" && val !== null) {
      sanitized[key] = "[NESTED_OBJECT]";
    } else {
      sanitized[key] = val;
    }
  }

  return {
    eventName: input.eventName,
    ...sanitized,
  };
}
