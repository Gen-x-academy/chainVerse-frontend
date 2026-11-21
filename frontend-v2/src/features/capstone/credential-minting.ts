/**
 * Completion and contribution credential minting (CAPSTONE-094 / issue #1520).
 *
 * Credentials are minted only when completion rules pass and the contributor
 * has an explicit approval. They carry an issuer, a public subject reference,
 * a role and a revocation state — never emails, names or private research
 * content. Idempotent on request id and de-duplicated by subject/role/project.
 */
import { canonicalize, sha256Hex } from "./portfolio-export";

export const CREDENTIAL_SCHEMA_VERSION = 1;
export const CREDENTIAL_ROLES = ["contributor", "team_lead", "supervisor", "reviewer"] as const;
export type CredentialRole = (typeof CREDENTIAL_ROLES)[number];

/** Public opaque reference; personal identifiers are never accepted. */
export const SUBJECT_REFERENCE_PATTERN = /^sub_[0-9A-HJKMNP-TV-Z]{16}$/;
const MINTER_ROLES = ["organization_staff", "administrator"];

export interface CredentialActor {
  id: string;
  role: string;
  organizationId: string;
}

export interface CompletionRules {
  state: string;
  revision: number;
  requiredMilestones: readonly string[];
  acceptedMilestones: readonly string[];
  requiredCriteria: readonly string[];
  acceptedCriteria: readonly string[];
  withinWindow: boolean;
}

export interface CredentialProject {
  id: string;
  organizationId: string;
  completion: CompletionRules;
}

export interface CredentialSubject {
  /** Public, opaque reference to the person, never an email or private id. */
  reference: string;
  role: CredentialRole | string;
  approval: "approved" | "pending" | "rejected" | undefined;
  approvedBy?: string;
}

export interface MintRequest {
  requestId: string;
  actor: CredentialActor;
  project: CredentialProject;
  subject: CredentialSubject;
  issuerId: string;
  now: string;
}

export interface Credential {
  schemaVersion: 1;
  kind: "capstone-credential";
  id: string;
  issuer: { id: string; organizationId: string };
  subjectReference: string;
  projectId: string;
  role: CredentialRole;
  issuedAt: string;
  revokedAt?: string;
  integrity: { algorithm: "SHA-256"; digest: string };
}

export type MintErrorCode =
  | "UNKNOWN_ROLE"
  | "NOT_PERMITTED"
  | "TENANT_MISMATCH"
  | "STALE_REVISION"
  | "PROJECT_NOT_COMPLETE"
  | "APPROVAL_MISSING"
  | "INVALID_SUBJECT"
  | "INVALID_ROLE"
  | "ALREADY_MINTED";

export type MintResult =
  | { ok: true; credential: Credential; replayed: boolean }
  | { ok: false; code: MintErrorCode; message: string };

export type MintLedger = Map<string, MintResult>;
export type CredentialIndex = Set<string>;

export function credentialKey(projectId: string, subjectReference: string, role: CredentialRole): string {
  return `${projectId}:${subjectReference}:${role}`;
}

export function completionSatisfied(completion: CompletionRules): boolean {
  if (completion.state !== "completed" || !completion.withinWindow) return false;
  const covers = (required: readonly string[], accepted: readonly string[]) =>
    required.length > 0 && required.every((id) => accepted.includes(id));
  return covers(completion.requiredMilestones, completion.acceptedMilestones) &&
    covers(completion.requiredCriteria, completion.acceptedCriteria);
}

export async function mintCredential(
  request: MintRequest,
  ledger: MintLedger = new Map(),
  index: CredentialIndex = new Set(),
): Promise<MintResult> {
  const earlier = ledger.get(request.requestId);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;
  const record = (result: MintResult): MintResult => {
    ledger.set(request.requestId, result);
    return result;
  };
  const fail = (code: MintErrorCode, message: string) => record({ ok: false, code, message });

  // Deny by default: only org staff/administrators in the project's tenant.
  if (!MINTER_ROLES.includes(request.actor.role)) return fail("UNKNOWN_ROLE", "This role cannot mint credentials.");
  if (request.actor.role === "administrator" && request.actor.organizationId !== request.project.organizationId) {
    return fail("TENANT_MISMATCH", "The project belongs to another organization.");
  }
  if (request.actor.role === "organization_staff" &&
    (request.actor.organizationId !== request.project.organizationId || request.actor.id !== request.issuerId)) {
    return fail("NOT_PERMITTED", "Only the project's issuer can mint its credentials.");
  }
  if (request.project.completion.revision <= 0) return fail("STALE_REVISION", "Reload the project before minting.");
  if (!completionSatisfied(request.project.completion)) return fail("PROJECT_NOT_COMPLETE", "Completion rules have not passed.");
  if (request.subject.approval !== "approved" || !request.subject.approvedBy) {
    return fail("APPROVAL_MISSING", "The contributor has not been approved.");
  }
  if (!(CREDENTIAL_ROLES as readonly string[]).includes(request.subject.role)) return fail("INVALID_ROLE", "Unknown credential role.");
  if (!SUBJECT_REFERENCE_PATTERN.test(request.subject.reference)) return fail("INVALID_SUBJECT", "Use a public subject reference.");

  const role = request.subject.role as CredentialRole;
  const key = credentialKey(request.project.id, request.subject.reference, role);
  if (index.has(key)) return fail("ALREADY_MINTED", "A credential for this contribution already exists.");

  const body = {
    schemaVersion: CREDENTIAL_SCHEMA_VERSION as const,
    kind: "capstone-credential" as const,
    id: `crd_${request.requestId.replace(/[^0-9A-Za-z]/g, "").slice(0, 16).padEnd(16, "0")}`,
    issuer: { id: request.issuerId, organizationId: request.project.organizationId },
    subjectReference: request.subject.reference,
    projectId: request.project.id,
    role,
    issuedAt: request.now,
  };
  const digest = await sha256Hex(canonicalize(body));
  const result: MintResult = {
    ok: true,
    credential: { ...body, integrity: { algorithm: "SHA-256", digest } },
    replayed: false,
  };
  index.add(key);
  return record(result);
}

/** Revocation is idempotent and keeps the original credential content intact. */
export function revokeCredential(
  credential: Credential,
  request: { requestId: string; actor: CredentialActor; now: string },
  ledger: MintLedger = new Map(),
): MintResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;
  const fail = (code: MintErrorCode, message: string) => {
    const result: MintResult = { ok: false, code, message };
    ledger.set(request.requestId, result);
    return result;
  };
  if (request.actor.organizationId !== credential.issuer.organizationId ||
    (request.actor.role !== "administrator" && request.actor.id !== credential.issuer.id)) {
    return fail("NOT_PERMITTED", "Only the issuer or an administrator can revoke this credential.");
  }
  if (credential.revokedAt) {
    const result: MintResult = { ok: true, credential, replayed: true };
    ledger.set(request.requestId, result);
    return result;
  }
  const result: MintResult = {
    ok: true,
    credential: { ...credential, revokedAt: request.now },
    replayed: false,
  };
  ledger.set(request.requestId, result);
  return result;
}

/** Audit entries never contain subject references, approvals or role details. */
export function credentialAudit(result: MintResult): Record<string, string | boolean> {
  if (!result.ok) return { outcome: "denied", code: result.code };
  return {
    outcome: "credential",
    projectId: result.credential.projectId,
    revoked: Boolean(result.credential.revokedAt),
    replayed: result.replayed,
  };
}
