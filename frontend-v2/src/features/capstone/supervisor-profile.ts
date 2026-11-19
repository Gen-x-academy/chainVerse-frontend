/**
 * Supervisor research profiles (CAPSTONE-010).
 *
 * Capture expertise, approach, capacity, languages, availability, affiliations
 * and credentials. Only credentials marked verified are ever shown publicly,
 * and the public view reports availability as a simple yes/no rather than raw
 * capacity numbers.
 */

export interface SupervisorCredential {
  title: string;
  issuer: string;
  /** Set only by the verification process (see supervisor eligibility), never by the supervisor. */
  verified: boolean;
  expiresOn?: string;
}

export interface SupervisorProfileInput {
  displayName: string;
  expertise: string[];
  approach: string;
  /** Most projects supervised at once. */
  maxActiveProjects: number;
  activeProjects: number;
  /** BCP 47 language tags, e.g. "en", "fr-CA". */
  languages: string[];
  availableFrom?: string;
  affiliations: string[];
  credentials: SupervisorCredential[];
}

export interface SupervisorProfile extends SupervisorProfileInput {
  languages: string[];
}

export interface SupervisorIssue {
  field: string;
  message: string;
}

export type SupervisorValidation = { ok: true; profile: SupervisorProfile } | { ok: false; issues: SupervisorIssue[] };

const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const clean = (items: unknown, max: number): string[] =>
  Array.isArray(items) ? [...new Set(items.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter((v) => v.length > 0 && v.length <= 80))].slice(0, max) : [];

export function validateSupervisorProfile(input: SupervisorProfileInput): SupervisorValidation {
  const issues: SupervisorIssue[] = [];
  const displayName = (input.displayName ?? "").trim();
  if (displayName.length < 2 || displayName.length > 80) issues.push({ field: "displayName", message: "displayName must be 2-80 characters" });

  const expertise = clean(input.expertise, 20).map((e) => e.toLowerCase());
  if (expertise.length === 0) issues.push({ field: "expertise", message: "add at least one area of expertise" });

  const approach = (input.approach ?? "").trim();
  if (approach.length > 1000) issues.push({ field: "approach", message: "approach can be at most 1000 characters" });

  if (!Number.isInteger(input.maxActiveProjects) || input.maxActiveProjects < 0 || input.maxActiveProjects > 20) {
    issues.push({ field: "maxActiveProjects", message: "maxActiveProjects must be a whole number from 0 to 20" });
  }
  if (!Number.isInteger(input.activeProjects) || input.activeProjects < 0) {
    issues.push({ field: "activeProjects", message: "activeProjects must be a non-negative whole number" });
  } else if (input.activeProjects > input.maxActiveProjects) {
    issues.push({ field: "activeProjects", message: "activeProjects cannot exceed maxActiveProjects" });
  }

  const languages = clean(input.languages, 10);
  if (languages.length === 0) issues.push({ field: "languages", message: "add at least one language" });
  for (const tag of languages) if (!LANGUAGE.test(tag)) issues.push({ field: "languages", message: `"${tag}" is not a valid language tag` });

  if (input.availableFrom !== undefined && !DATE.test(input.availableFrom)) issues.push({ field: "availableFrom", message: "availableFrom must be YYYY-MM-DD" });

  const credentials = (Array.isArray(input.credentials) ? input.credentials : []).slice(0, 20).map((c) => ({ ...c, title: c.title?.trim(), issuer: c.issuer?.trim() }));
  credentials.forEach((c, i) => {
    if (!c.title || !c.issuer) issues.push({ field: `credentials[${i}]`, message: "title and issuer are required" });
    if (c.expiresOn !== undefined && !DATE.test(c.expiresOn)) issues.push({ field: `credentials[${i}].expiresOn`, message: "expiresOn must be YYYY-MM-DD" });
  });

  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    profile: {
      displayName,
      expertise,
      approach,
      maxActiveProjects: input.maxActiveProjects,
      activeProjects: input.activeProjects,
      languages,
      availableFrom: input.availableFrom,
      affiliations: clean(input.affiliations, 10),
      credentials,
    },
  };
}

export function hasCapacity(profile: Pick<SupervisorProfile, "maxActiveProjects" | "activeProjects">): boolean {
  return profile.activeProjects < profile.maxActiveProjects;
}

/** A credential counts as current when verified and not past its expiry date. */
export function isCredentialCurrent(c: SupervisorCredential, today: string): boolean {
  return c.verified && (c.expiresOn === undefined || c.expiresOn >= today);
}

export interface PublicSupervisorView {
  displayName: string;
  expertise: string[];
  approach: string;
  languages: string[];
  affiliations: string[];
  acceptingProjects: boolean;
  verifiedCredentials: Array<{ title: string; issuer: string }>;
}

export function toPublicSupervisorView(profile: SupervisorProfile, today: string): PublicSupervisorView {
  return {
    displayName: profile.displayName,
    expertise: profile.expertise,
    approach: profile.approach,
    languages: profile.languages,
    affiliations: profile.affiliations,
    acceptingProjects: hasCapacity(profile) && (profile.availableFrom === undefined || profile.availableFrom <= today),
    verifiedCredentials: profile.credentials.filter((c) => isCredentialCurrent(c, today)).map(({ title, issuer }) => ({ title, issuer })),
  };
}
