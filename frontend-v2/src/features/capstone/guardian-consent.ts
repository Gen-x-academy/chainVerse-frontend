/**
 * Guardian consent (CAPSTONE-051).
 *
 * Participants under the age of majority need a guardian's consent before they
 * take part. The guardian is held as a verified relationship reference, never
 * as personal details. Consent is scoped to named activities, expires, can be
 * revoked, and must be given again after a material change to the project.
 */

export type ConsentScope = "participation" | "data_sharing" | "publication" | "external_contact";

export interface GuardianLink {
  /** Opaque id of a verified guardian relationship. No names, emails or documents. */
  relationshipRef: string;
  participantId: string;
  verifiedAt: string;
}

export interface GuardianConsent {
  id: string;
  participantId: string;
  relationshipRef: string;
  scopes: ConsentScope[];
  /** Version of the project terms the guardian agreed to. */
  projectVersion: number;
  grantedAt: string;
  expiresAt: string;
  revokedAt?: string;
}

export type ConsentErrorCode = "not_required" | "unverified_guardian" | "no_scopes" | "bad_expiry" | "stale_project_version" | "not_found" | "already_revoked";

export type ConsentResult<T> = { ok: true; value: T } | { ok: false; code: ConsentErrorCode; message: string };

const MESSAGES: Record<ConsentErrorCode, string> = {
  not_required: "This participant does not need guardian consent.",
  unverified_guardian: "The guardian relationship has not been verified.",
  no_scopes: "Choose what the guardian is consenting to.",
  bad_expiry: "The consent must end after it starts, and within one year.",
  stale_project_version: "The project changed. The guardian must review the new version.",
  not_found: "No such consent was found.",
  already_revoked: "This consent was already revoked.",
};

const fail = <T>(code: ConsentErrorCode): ConsentResult<T> => ({ ok: false, code, message: MESSAGES[code] });

export const MAX_CONSENT_DAYS = 366;
export const AGE_OF_MAJORITY = 18;

/** Whole years between a birth date and a day, using UTC dates. */
export function ageOn(birthDate: string, day: string): number {
  const b = new Date(birthDate);
  const d = new Date(day);
  let age = d.getUTCFullYear() - b.getUTCFullYear();
  const beforeBirthday = d.getUTCMonth() < b.getUTCMonth() || (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function requiresGuardianConsent(birthDate: string, day: string, majority = AGE_OF_MAJORITY): boolean {
  return ageOn(birthDate, day) < majority;
}

/** Grant consent. Needs a verified link for the same participant and at least one scope. */
export function grantConsent(
  input: { id: string; participantId: string; scopes: ConsentScope[]; projectVersion: number; grantedAt: string; expiresAt: string },
  link: GuardianLink | undefined,
  currentProjectVersion: number,
  participantNeedsConsent: boolean,
): ConsentResult<GuardianConsent> {
  if (!participantNeedsConsent) return fail("not_required");
  if (!link || link.participantId !== input.participantId || Number.isNaN(Date.parse(link.verifiedAt))) return fail("unverified_guardian");
  if (input.scopes.length === 0) return fail("no_scopes");
  const start = Date.parse(input.grantedAt);
  const end = Date.parse(input.expiresAt);
  if (!(end > start) || end - start > MAX_CONSENT_DAYS * 86_400_000) return fail("bad_expiry");
  if (input.projectVersion !== currentProjectVersion) return fail("stale_project_version");
  return {
    ok: true,
    value: {
      id: input.id,
      participantId: input.participantId,
      relationshipRef: link.relationshipRef,
      scopes: [...new Set(input.scopes)],
      projectVersion: input.projectVersion,
      grantedAt: input.grantedAt,
      expiresAt: input.expiresAt,
    },
  };
}

export function revokeConsent(consents: readonly GuardianConsent[], id: string, at: string): ConsentResult<GuardianConsent[]> {
  const target = consents.find((c) => c.id === id);
  if (!target) return fail("not_found");
  if (target.revokedAt) return fail("already_revoked");
  return { ok: true, value: consents.map((c) => (c === target ? { ...c, revokedAt: at } : c)) };
}

export type ConsentState = "valid" | "expired" | "revoked" | "needs_reconsent";

export function consentState(consent: GuardianConsent, now: string, currentProjectVersion: number): ConsentState {
  if (consent.revokedAt && Date.parse(consent.revokedAt) <= Date.parse(now)) return "revoked";
  if (Date.parse(now) >= Date.parse(consent.expiresAt)) return "expired";
  if (consent.projectVersion !== currentProjectVersion) return "needs_reconsent";
  return "valid";
}

/** Whether a participant may take part in an activity, deny by default. */
export function mayParticipate(consents: readonly GuardianConsent[], participantId: string, scope: ConsentScope, now: string, currentProjectVersion: number): boolean {
  return consents.some((c) => c.participantId === participantId && c.scopes.includes(scope) && consentState(c, now, currentProjectVersion) === "valid");
}

/** Consents that need action soon: expiring within `days`, or out of date after a project change. */
export function consentsNeedingAttention(consents: readonly GuardianConsent[], now: string, currentProjectVersion: number, days = 30): Array<{ id: string; reason: "expiring" | "needs_reconsent" }> {
  const soon = Date.parse(now) + days * 86_400_000;
  const result: Array<{ id: string; reason: "expiring" | "needs_reconsent" }> = [];
  for (const c of consents) {
    const state = consentState(c, now, currentProjectVersion);
    if (state === "needs_reconsent") result.push({ id: c.id, reason: "needs_reconsent" });
    else if (state === "valid" && Date.parse(c.expiresAt) <= soon) result.push({ id: c.id, reason: "expiring" });
  }
  return result;
}
