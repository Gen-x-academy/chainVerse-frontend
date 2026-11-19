/**
 * Researcher and student project profiles (CAPSTONE-009).
 *
 * Validation and normalization for the profile a participant fills in. Accessibility
 * needs are always private: whatever visibility a caller sends, they are never
 * exposed to other audiences.
 */

export const PROFILE_ROLES = ["researcher", "analyst", "developer", "designer", "writer", "coordinator"] as const;
export type ProfileRole = (typeof PROFILE_ROLES)[number];

export type Audience = "private" | "supervisors" | "sponsors" | "public";
export const AUDIENCES: readonly Audience[] = ["private", "supervisors", "sponsors", "public"];

export interface PortfolioRef {
  title: string;
  url: string;
}

export interface ParticipantProfileInput {
  displayName: string;
  kind: "student" | "researcher";
  skills: string[];
  interests: string[];
  /** Hours per week, 0-60. */
  availabilityHours: number;
  portfolio: PortfolioRef[];
  preferredRoles: string[];
  accessibilityNeeds: string[];
  /** Who may see project preferences (roles, interests). Defaults to supervisors. */
  preferenceVisibility?: Audience;
}

export interface ParticipantProfile extends Omit<ParticipantProfileInput, "preferredRoles" | "preferenceVisibility"> {
  preferredRoles: ProfileRole[];
  preferenceVisibility: Audience;
}

export interface ProfileIssue {
  field: string;
  message: string;
}

export type ProfileValidation =
  | { ok: true; profile: ParticipantProfile }
  | { ok: false; issues: ProfileIssue[] };

const MAX_SKILLS = 30;
const MAX_INTERESTS = 20;
const MAX_PORTFOLIO = 10;

export function normalizeTag(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeList(values: unknown, max: number, field: string, issues: ProfileIssue[]): string[] {
  if (!Array.isArray(values)) {
    issues.push({ field, message: `${field} must be a list` });
    return [];
  }
  const out = [...new Set(values.filter((v): v is string => typeof v === "string").map(normalizeTag).filter((v) => v.length > 0 && v.length <= 60))];
  if (out.length > max) {
    issues.push({ field, message: `${field} can have at most ${max} entries` });
    return out.slice(0, max);
  }
  return out;
}

export function validateParticipantProfile(input: ParticipantProfileInput): ProfileValidation {
  const issues: ProfileIssue[] = [];

  const displayName = typeof input.displayName === "string" ? input.displayName.trim() : "";
  if (displayName.length < 2 || displayName.length > 80) issues.push({ field: "displayName", message: "displayName must be 2-80 characters" });
  if (input.kind !== "student" && input.kind !== "researcher") issues.push({ field: "kind", message: "kind must be student or researcher" });

  const skills = normalizeList(input.skills, MAX_SKILLS, "skills", issues);
  if (skills.length === 0) issues.push({ field: "skills", message: "add at least one skill" });
  const interests = normalizeList(input.interests, MAX_INTERESTS, "interests", issues);

  if (typeof input.availabilityHours !== "number" || !Number.isFinite(input.availabilityHours) || input.availabilityHours < 0 || input.availabilityHours > 60) {
    issues.push({ field: "availabilityHours", message: "availabilityHours must be between 0 and 60" });
  }

  const portfolio: PortfolioRef[] = [];
  if (!Array.isArray(input.portfolio)) issues.push({ field: "portfolio", message: "portfolio must be a list" });
  else {
    if (input.portfolio.length > MAX_PORTFOLIO) issues.push({ field: "portfolio", message: `portfolio can have at most ${MAX_PORTFOLIO} entries` });
    input.portfolio.slice(0, MAX_PORTFOLIO).forEach((ref, i) => {
      let url: URL | null = null;
      try {
        url = new URL(String(ref?.url));
      } catch {
        url = null;
      }
      if (!url || url.protocol !== "https:" || url.username || url.password) {
        issues.push({ field: `portfolio[${i}].url`, message: "must be an https URL without embedded credentials" });
      } else if (!ref.title || ref.title.trim().length === 0 || ref.title.length > 120) {
        issues.push({ field: `portfolio[${i}].title`, message: "title must be 1-120 characters" });
      } else {
        portfolio.push({ title: ref.title.trim(), url: url.toString() });
      }
    });
  }

  const roles = normalizeList(input.preferredRoles, PROFILE_ROLES.length, "preferredRoles", issues);
  const preferredRoles = roles.filter((r): r is ProfileRole => (PROFILE_ROLES as readonly string[]).includes(r));
  if (preferredRoles.length !== roles.length) issues.push({ field: "preferredRoles", message: `unknown role; choose from ${PROFILE_ROLES.join(", ")}` });

  const visibility = input.preferenceVisibility ?? "supervisors";
  if (!AUDIENCES.includes(visibility)) issues.push({ field: "preferenceVisibility", message: `must be one of ${AUDIENCES.join(", ")}` });

  const accessibilityNeeds = normalizeList(input.accessibilityNeeds ?? [], 20, "accessibilityNeeds", issues);

  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    profile: {
      displayName,
      kind: input.kind,
      skills,
      interests,
      availabilityHours: input.availabilityHours,
      portfolio,
      preferredRoles,
      accessibilityNeeds,
      preferenceVisibility: visibility,
    },
  };
}

/** What another audience may see. Accessibility needs are never included. */
export function viewProfileFor(profile: ParticipantProfile, audience: Audience): Partial<ParticipantProfile> {
  const rank = AUDIENCES.indexOf(audience);
  const prefRank = AUDIENCES.indexOf(profile.preferenceVisibility);
  const base: Partial<ParticipantProfile> = { displayName: profile.displayName, kind: profile.kind, skills: profile.skills, portfolio: profile.portfolio };
  // "private" is the owner's own view; an audience sees preferences only when the owner opened them to it.
  const owner = audience === "private";
  const canSeePrefs = owner || (audience !== "private" && rank >= prefRank && prefRank > 0);
  return {
    ...base,
    ...(canSeePrefs ? { interests: profile.interests, preferredRoles: profile.preferredRoles, availabilityHours: profile.availabilityHours } : {}),
    ...(owner ? { accessibilityNeeds: profile.accessibilityNeeds, preferenceVisibility: profile.preferenceVisibility } : {}),
  };
}
