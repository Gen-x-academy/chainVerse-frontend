/**
 * Public verification of project outputs (CAPSTONE-095 / issue #1521).
 *
 * A verification code resolves to one public state (valid, revoked,
 * superseded, embargoed, unknown or malformed). The registry holds only public
 * identifiers and state metadata: no participant, proposal or safety data is
 * stored here or returned by any result. Verification is read-only and safe to
 * retry concurrently.
 */

export const VERIFICATION_STATES = ["valid", "revoked", "superseded", "embargoed", "unknown", "malformed"] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

/** Public verification code: prefix + Crockford base32, no ambiguous characters. */
export const VERIFICATION_CODE_PATTERN = /^vrf_[0-9A-HJKMNP-TV-Z]{16}$/;

export interface VerificationRecord {
  projectId: string;
  outputId: string;
  state: "valid" | "revoked" | "superseded" | "embargoed";
  supersededBy?: string;
  validUntil?: string;
  embargoUntil?: string;
  /** Optional integrity digest of the published output, never its content. */
  sha256?: string;
}

/** Public identifiers only; the key is the verification code. */
export type VerificationRegistry = ReadonlyMap<string, VerificationRecord>;

export interface VerificationResult {
  state: VerificationState;
  /** Stable, actionable reason code; never a prose error with private data. */
  code: string;
  /** Public references are present only for states that may disclose them. */
  projectId?: string;
  outputId?: string;
  supersededBy?: string;
  sha256?: string;
}

export function isVerificationCode(value: unknown): value is string {
  return typeof value === "string" && VERIFICATION_CODE_PATTERN.test(value);
}

function publicRecord(record: VerificationRecord): Pick<VerificationRecord, "projectId" | "outputId" | "sha256"> {
  return { projectId: record.projectId, outputId: record.outputId, ...(record.sha256 ? { sha256: record.sha256 } : {}) };
}

/**
 * Verify a code at a given instant. Unknown and embargoed codes deliberately
 * disclose no record fields, so unrelated participant data cannot be probed.
 */
export function verifyOutput(
  rawCode: unknown,
  registry: VerificationRegistry,
  now: string = new Date().toISOString(),
): VerificationResult {
  if (!isVerificationCode(rawCode)) return { state: "malformed", code: "MALFORMED_CODE" };
  const record = registry.get(rawCode);
  if (!record) return { state: "unknown", code: "UNKNOWN_CODE" };

  const at = Date.parse(now);
  if (record.state === "embargoed") {
    if (record.embargoUntil && Number.isFinite(Date.parse(record.embargoUntil)) && Date.parse(record.embargoUntil) <= at) {
      return { state: "valid", code: "EMBARGO_LIFTED", ...publicRecord(record) };
    }
    return { state: "embargoed", code: "UNDER_EMBARGO" };
  }
  if (record.state === "revoked") return { state: "revoked", code: "REVOKED", ...publicRecord(record) };
  if (record.validUntil && Number.isFinite(Date.parse(record.validUntil)) && Date.parse(record.validUntil) <= at) {
    return { state: "revoked", code: "ACCESS_EXPIRED", ...publicRecord(record) };
  }
  if (record.state === "superseded") {
    return {
      state: "superseded",
      code: "SUPERSEDED",
      ...(record.supersededBy ? { supersededBy: record.supersededBy } : {}),
    };
  }
  if (record.state !== "valid") return { state: "unknown", code: "UNKNOWN_CODE" };
  return { state: "valid", code: "VALID", ...publicRecord(record) };
}

/** Audit payload contains the code and outcome only; no private payloads. */
export function verificationAudit(rawCode: unknown, result: VerificationResult): Record<string, string> {
  return {
    code: isVerificationCode(rawCode) ? rawCode : "MALFORMED",
    state: result.state,
    reason: result.code,
  };
}
