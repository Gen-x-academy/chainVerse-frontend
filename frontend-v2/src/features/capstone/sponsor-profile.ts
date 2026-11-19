/**
 * Sponsor organization profiles (CAPSTONE-013).
 *
 * Represents approved sponsors, their research themes, contacts, funding
 * authority, disclosure policy and project visibility. Contact details are
 * never part of the public view, and only an approved sponsor can fund.
 */

export type SponsorStatus = "pending" | "approved" | "suspended";
export type DisclosurePolicy = "named" | "anonymous" | "on_request";
export type SponsorProjectVisibility = "public" | "participants" | "reviewers";

export interface SponsorContact {
  role: "program-lead" | "finance" | "legal";
  name: string;
  email: string;
}

export interface FundingAuthority {
  currency: string;
  /** Largest single award in minor units, as an integer string. */
  maxAwardMinor: string;
  /** Total budget still available in minor units. */
  remainingMinor: string;
}

export interface SponsorProfile {
  id: string;
  name: string;
  status: SponsorStatus;
  themes: string[];
  contacts: SponsorContact[];
  funding: FundingAuthority;
  disclosure: DisclosurePolicy;
  visibility: SponsorProjectVisibility;
}

export interface SponsorIssue {
  field: string;
  message: string;
}

export type SponsorValidation = { ok: true; profile: SponsorProfile } | { ok: false; issues: SponsorIssue[] };

const MINOR = /^(0|[1-9][0-9]*)$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSponsorProfile(input: SponsorProfile): SponsorValidation {
  const issues: SponsorIssue[] = [];
  if (!input.name || input.name.trim().length < 2 || input.name.length > 120) issues.push({ field: "name", message: "name must be 2-120 characters" });
  if (!["pending", "approved", "suspended"].includes(input.status)) issues.push({ field: "status", message: "unknown status" });

  const themes = [...new Set((input.themes ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))];
  if (themes.length === 0 || themes.length > 20) issues.push({ field: "themes", message: "provide 1-20 research themes" });

  (input.contacts ?? []).forEach((c, i) => {
    if (!EMAIL.test(c.email ?? "")) issues.push({ field: `contacts[${i}].email`, message: "invalid email" });
    if (!c.name?.trim()) issues.push({ field: `contacts[${i}].name`, message: "name is required" });
  });

  const f = input.funding;
  if (!f || !/^[A-Z]{3,5}$/.test(f.currency)) issues.push({ field: "funding.currency", message: "currency must be an uppercase code" });
  else {
    if (!MINOR.test(f.maxAwardMinor)) issues.push({ field: "funding.maxAwardMinor", message: "must be an integer string" });
    if (!MINOR.test(f.remainingMinor)) issues.push({ field: "funding.remainingMinor", message: "must be an integer string" });
    else if (MINOR.test(f.maxAwardMinor) && BigInt(f.maxAwardMinor) > BigInt(f.remainingMinor)) {
      issues.push({ field: "funding.maxAwardMinor", message: "a single award cannot exceed the remaining budget" });
    }
  }
  if (!["named", "anonymous", "on_request"].includes(input.disclosure)) issues.push({ field: "disclosure", message: "unknown disclosure policy" });
  if (!["public", "participants", "reviewers"].includes(input.visibility)) issues.push({ field: "visibility", message: "unknown visibility" });

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, profile: { ...input, name: input.name.trim(), themes } };
}

export type FundDecision = { ok: true; remainingMinor: string } | { ok: false; code: "NOT_APPROVED" | "CURRENCY_MISMATCH" | "INVALID_AMOUNT" | "EXCEEDS_AWARD_LIMIT" | "INSUFFICIENT_FUNDS" };

/** Deny by default: only an approved sponsor within its authority can commit funds. */
export function authorizeFunding(sponsor: SponsorProfile, currency: string, amountMinor: string): FundDecision {
  if (sponsor.status !== "approved") return { ok: false, code: "NOT_APPROVED" };
  if (currency !== sponsor.funding.currency) return { ok: false, code: "CURRENCY_MISMATCH" };
  if (!MINOR.test(amountMinor) || BigInt(amountMinor) === 0n) return { ok: false, code: "INVALID_AMOUNT" };
  const amount = BigInt(amountMinor);
  if (amount > BigInt(sponsor.funding.maxAwardMinor)) return { ok: false, code: "EXCEEDS_AWARD_LIMIT" };
  const remaining = BigInt(sponsor.funding.remainingMinor);
  if (amount > remaining) return { ok: false, code: "INSUFFICIENT_FUNDS" };
  return { ok: true, remainingMinor: (remaining - amount).toString() };
}

export interface PublicSponsorView {
  id: string;
  /** Null when the disclosure policy hides the name from the public. */
  name: string | null;
  themes: string[];
}

/** Public projection: no contacts or funding figures; the name follows the disclosure policy. */
export function toPublicSponsorView(sponsor: SponsorProfile): PublicSponsorView | null {
  if (sponsor.status !== "approved" || sponsor.visibility !== "public") return null;
  return { id: sponsor.id, name: sponsor.disclosure === "named" ? sponsor.name : null, themes: sponsor.themes };
}

export interface ParticipantSponsorView extends PublicSponsorView {
  contactRoles: SponsorContact["role"][];
}

/** Participants see contact roles (so they know whom to ask) but never names or emails. */
export function toParticipantSponsorView(sponsor: SponsorProfile): ParticipantSponsorView | null {
  if (sponsor.status !== "approved" || sponsor.visibility === "reviewers") return null;
  const base = { id: sponsor.id, name: sponsor.disclosure === "anonymous" ? null : sponsor.name, themes: sponsor.themes };
  return { ...base, contactRoles: [...new Set(sponsor.contacts.map((c) => c.role))].sort() };
}
