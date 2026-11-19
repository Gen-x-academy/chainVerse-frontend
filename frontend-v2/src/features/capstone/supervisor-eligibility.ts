/**
 * Supervisor eligibility verification (CAPSTONE-012).
 *
 * Tracks organization approval, an identity *reference*, credentials, conflicts,
 * expiry, suspension and re-verification. Raw documents and identity numbers are
 * never stored or shown here: only opaque references and digests, masked on display.
 */

export type OrgApproval = "pending" | "approved" | "rejected";

export interface EligibilityCredentialRef {
  /** Opaque reference to the credential record (not the document). */
  ref: string;
  verified: boolean;
  expiresOn?: string;
}

export interface EligibilityRecord {
  supervisorId: string;
  orgApproval: OrgApproval;
  /** Opaque reference to an identity check performed elsewhere. */
  identityRef?: string;
  identityVerifiedOn?: string;
  credentials: EligibilityCredentialRef[];
  /** Declared conflicts of interest (project or sponsor public ids), not free text. */
  conflicts: string[];
  suspended: boolean;
  /** When the whole verification lapses and must be repeated. */
  validUntil?: string;
}

export type EligibilityReason =
  | "ORG_APPROVAL_PENDING"
  | "ORG_APPROVAL_REJECTED"
  | "IDENTITY_NOT_VERIFIED"
  | "NO_VERIFIED_CREDENTIAL"
  | "VERIFICATION_EXPIRED"
  | "SUSPENDED";

export type EligibilityStatus = "eligible" | "ineligible" | "reverification_due";

export interface EligibilityResult {
  status: EligibilityStatus;
  reasons: EligibilityReason[];
  /** True when eligible now but `validUntil` is within the warning window. */
  expiringSoon: boolean;
  /** Public ids of projects this supervisor cannot supervise because of declared conflicts. */
  conflictsWith: string[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (date: string, days: number): string => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** `today` is injected so results are deterministic. */
export function evaluateEligibility(record: EligibilityRecord, today: string, warnDays = 30): EligibilityResult {
  if (!DATE.test(today)) throw new RangeError("today must be YYYY-MM-DD");
  const reasons: EligibilityReason[] = [];

  if (record.suspended) reasons.push("SUSPENDED");
  if (record.orgApproval === "pending") reasons.push("ORG_APPROVAL_PENDING");
  if (record.orgApproval === "rejected") reasons.push("ORG_APPROVAL_REJECTED");
  if (!record.identityRef || !record.identityVerifiedOn) reasons.push("IDENTITY_NOT_VERIFIED");
  if (!record.credentials.some((c) => c.verified && (c.expiresOn === undefined || c.expiresOn >= today))) reasons.push("NO_VERIFIED_CREDENTIAL");

  const expired = record.validUntil !== undefined && record.validUntil < today;
  if (expired) reasons.push("VERIFICATION_EXPIRED");

  const blocking = reasons.filter((r) => r !== "VERIFICATION_EXPIRED");
  const status: EligibilityStatus = blocking.length > 0 ? "ineligible" : expired ? "reverification_due" : "eligible";
  return {
    status,
    reasons,
    expiringSoon: status === "eligible" && record.validUntil !== undefined && record.validUntil <= addDays(today, warnDays),
    conflictsWith: [...new Set(record.conflicts)].sort(),
  };
}

/** A suspended supervisor stays suspended through re-verification until explicitly cleared. */
export function suspend(record: EligibilityRecord): EligibilityRecord {
  return { ...record, suspended: true };
}

export function clearSuspension(record: EligibilityRecord): EligibilityRecord {
  return { ...record, suspended: false };
}

/** Re-verification restarts the validity window and keeps declared conflicts. */
export function reverify(record: EligibilityRecord, verifiedOn: string, validForDays: number): EligibilityRecord {
  if (!DATE.test(verifiedOn)) throw new RangeError("verifiedOn must be YYYY-MM-DD");
  if (!Number.isInteger(validForDays) || validForDays < 1) throw new RangeError("validForDays must be a positive integer");
  return { ...record, identityVerifiedOn: verifiedOn, validUntil: addDays(verifiedOn, validForDays) };
}

/** Can this supervisor take a given project? Conflicts block even an eligible supervisor. */
export function canSupervise(record: EligibilityRecord, projectPublicId: string, today: string): boolean {
  return evaluateEligibility(record, today).status === "eligible" && !record.conflicts.includes(projectPublicId);
}

export interface EligibilityDisplay {
  supervisorId: string;
  orgApproval: OrgApproval;
  identityRef: string | null;
  credentialCount: number;
  verifiedCredentialCount: number;
  suspended: boolean;
  validUntil: string | null;
}

/** Display form: references are masked and no raw document or identity value is carried. */
export function toEligibilityDisplay(record: EligibilityRecord): EligibilityDisplay {
  const mask = (ref: string) => (ref.length <= 4 ? "****" : `${"*".repeat(ref.length - 4)}${ref.slice(-4)}`);
  return {
    supervisorId: record.supervisorId,
    orgApproval: record.orgApproval,
    identityRef: record.identityRef ? mask(record.identityRef) : null,
    credentialCount: record.credentials.length,
    verifiedCredentialCount: record.credentials.filter((c) => c.verified).length,
    suspended: record.suspended,
    validUntil: record.validUntil ?? null,
  };
}
