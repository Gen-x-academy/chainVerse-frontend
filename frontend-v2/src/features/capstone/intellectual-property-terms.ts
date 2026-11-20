/**
 * Capstone intellectual property terms (CAPSTONE-091).
 *
 * Represents ownership, licence, sponsor rights, embargo, commercialisation,
 * reuse and participant acceptance without ever exposing private agreements.
 * Pure and deterministic: the caller supplies the current state and context.
 * Authorization is deny-by-default, transitions check the version the caller
 * last saw, and a retried request id returns its original outcome so a retry
 * can never record a second acceptance. Audit records carry identifiers only.
 */

export const IP_STATUSES = ["draft", "pending_acceptance", "accepted", "rejected", "superseded"] as const;
export type IpStatus = (typeof IP_STATUSES)[number];

export const IP_LICENSES = ["cc-by-4.0", "cc-by-sa-4.0", "cc-by-nc-4.0", "mit", "apache-2.0", "proprietary"] as const;
export type IpLicense = (typeof IP_LICENSES)[number];

export const COMMERCIALIZATION = ["prohibited", "with-approval", "allowed"] as const;
export type Commercialization = (typeof COMMERCIALIZATION)[number];

export const REUSE = ["none", "with-attribution", "open"] as const;
export type Reuse = (typeof REUSE)[number];

export const SPONSOR_RIGHTS = ["acknowledgement", "review", "embargo", "non-exclusive-use"] as const;
export type SponsorRight = (typeof SPONSOR_RIGHTS)[number];

export interface IpTerms {
  id: string;
  projectId: string;
  organizationId: string;
  /** Increments on every accepted change. */
  version: number;
  status: IpStatus;
  license: IpLicense;
  /** A short, public-safe summary of ownership. Private deeds are referenced, never stored here. */
  ownership: string;
  /** Opaque reference to a private agreement; the content never enters this model. */
  privateAgreementRef?: string;
  /** ISO date (YYYY-MM-DD) or null when no embargo applies. */
  embargoUntil: string | null;
  commercialization: Commercialization;
  reuse: Reuse;
  sponsorRights: readonly SponsorRight[];
  fundingAcknowledgement?: string;
  participantIds: readonly string[];
}

export interface IpIssue {
  field: keyof IpTerms | "set";
  message: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const REF = /^ref_[A-Za-z0-9_-]{1,64}$/;
const isDate = (value: string) => DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** Problems with one set of terms, or an empty list when it is valid. */
export function validateIpTerms(terms: IpTerms): IpIssue[] {
  const issues: IpIssue[] = [];
  const bad = (field: keyof IpTerms, message: string) => issues.push({ field, message });

  if (!Number.isInteger(terms.version) || terms.version < 1) bad("version", "version must be a positive whole number");
  if (!(IP_STATUSES as readonly string[]).includes(terms.status)) bad("status", "choose a valid term status");
  if (!(IP_LICENSES as readonly string[]).includes(terms.license)) bad("license", "choose a supported licence");
  if (!(COMMERCIALIZATION as readonly string[]).includes(terms.commercialization)) bad("commercialization", "choose a valid commercialization option");
  if (!(REUSE as readonly string[]).includes(terms.reuse)) bad("reuse", "choose a valid reuse option");

  const ownership = terms.ownership.trim();
  if (ownership.length < 5 || ownership.length > 500) bad("ownership", "the ownership summary needs 5 to 500 characters");
  if (terms.privateAgreementRef !== undefined && !REF.test(terms.privateAgreementRef)) {
    bad("privateAgreementRef", "reference a private agreement with an opaque ref_ id, not its contents");
  }
  if (terms.embargoUntil !== null && (!isDate(terms.embargoUntil) || terms.embargoUntil.trim() !== terms.embargoUntil)) {
    bad("embargoUntil", "use an embargo date in YYYY-MM-DD form or null");
  }
  if (terms.fundingAcknowledgement !== undefined && terms.fundingAcknowledgement.length > 300) {
    bad("fundingAcknowledgement", "the funding acknowledgement can be at most 300 characters");
  }
  for (const right of terms.sponsorRights) {
    if (!(SPONSOR_RIGHTS as readonly string[]).includes(right)) bad("sponsorRights", "unknown sponsor right");
  }
  if (new Set(terms.sponsorRights).size !== terms.sponsorRights.length) bad("sponsorRights", "sponsor rights must be unique");
  if (terms.participantIds.length === 0) bad("participantIds", "at least one participant must accept the terms");
  if (new Set(terms.participantIds).size !== terms.participantIds.length) bad("participantIds", "participant ids must be unique");
  return issues;
}

/** True while an embargo is still active on the given ISO date. */
export function isEmbargoed(terms: Pick<IpTerms, "embargoUntil">, today: string): boolean {
  return terms.embargoUntil !== null && isDate(terms.embargoUntil) && terms.embargoUntil > today;
}

/**
 * The only shape allowed onto a public showcase page. Private agreement
 * references, sponsor rights, participant identities and tenant ids are
 * deliberately absent, so a future change cannot leak them by accident.
 */
export interface PublicIpTerms {
  license: IpLicense;
  ownership: string;
  reuse: Reuse;
  commercialization: Commercialization;
  embargoUntil: string | null;
  fundingAcknowledgement: string | null;
}

export function publicIpTerms(terms: IpTerms): PublicIpTerms {
  return {
    license: terms.license,
    ownership: terms.ownership.trim(),
    reuse: terms.reuse,
    commercialization: terms.commercialization,
    embargoUntil: terms.embargoUntil,
    fundingAcknowledgement: terms.fundingAcknowledgement?.trim() || null,
  };
}

export interface AcceptanceState {
  version: number;
  decisions: Readonly<Record<string, "accepted" | "rejected">>;
}

export interface AcceptanceRequest {
  requestId: string;
  participantId: string;
  decision: "accepted" | "rejected";
  /** The version whose terms the participant saw. */
  expectedVersion: number;
}

export type AcceptanceErrorCode = "UNKNOWN_PARTICIPANT" | "STALE_VERSION" | "INVALID_DECISION" | "TERMS_CLOSED" | "VERSION_MISMATCH";

export type AcceptanceResult =
  | { ok: true; state: AcceptanceState; status: IpStatus; replayed: boolean }
  | { ok: false; code: AcceptanceErrorCode; message: string };

export type AcceptanceLedger = Map<string, AcceptanceResult>;

/** Record one participant's decision. Replays never apply a decision twice. */
export function recordAcceptance(
  terms: IpTerms,
  state: AcceptanceState,
  request: AcceptanceRequest,
  ledger: AcceptanceLedger = new Map(),
): AcceptanceResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;

  const fail = (code: AcceptanceErrorCode, message: string): AcceptanceResult => {
    const result: AcceptanceResult = { ok: false, code, message };
    ledger.set(request.requestId, result);
    return result;
  };

  if (terms.status !== "pending_acceptance" && terms.status !== "draft") {
    return fail("TERMS_CLOSED", `Terms are ${terms.status}; a new version is required before accepting.`);
  }
  if (!terms.participantIds.includes(request.participantId)) {
    return fail("UNKNOWN_PARTICIPANT", "Only listed participants can accept these terms.");
  }
  if (request.decision !== "accepted" && request.decision !== "rejected") {
    return fail("INVALID_DECISION", "Decision must be accepted or rejected.");
  }
  if (request.expectedVersion !== state.version || request.expectedVersion !== terms.version) {
    return fail("STALE_VERSION", `Terms changed (version ${terms.version}); review them again before deciding.`);
  }

  const decisions = { ...state.decisions, [request.participantId]: request.decision };
  const values = Object.values(decisions);
  const status: IpStatus = values.includes("rejected")
    ? "rejected"
    : terms.participantIds.every((id) => decisions[id] === "accepted")
      ? "accepted"
      : "pending_acceptance";
  const result: AcceptanceResult = { ok: true, state: { version: state.version, decisions }, status, replayed: false };
  ledger.set(request.requestId, result);
  return result;
}

/** Whether every participant has accepted the same version of the terms. */
export function acceptanceComplete(terms: IpTerms, state: AcceptanceState): boolean {
  return state.version === terms.version && terms.participantIds.length > 0 && terms.participantIds.every((id) => state.decisions[id] === "accepted");
}

export type IpAuditAction = "terms.updated" | "terms.submitted" | "terms.accepted" | "terms.rejected" | "terms.published";

/** Identifiers and metadata only — no agreement text, funding figures or private payloads. */
export function ipAuditEvent(action: IpAuditAction, terms: IpTerms, actorId: string, at: string): Readonly<Record<string, string | number>> {
  return Object.freeze({
    type: `ip.${action}`,
    organizationId: terms.organizationId,
    projectId: terms.projectId,
    termsId: terms.id,
    version: terms.version,
    actorId,
    at,
  });
}
