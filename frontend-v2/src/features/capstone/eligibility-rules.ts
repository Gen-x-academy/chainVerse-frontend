/**
 * Configurable, composable eligibility rules (CAPSTONE-020).
 *
 * Rules are plain data so they can be stored, versioned and shown to the
 * applicant. Evaluation is pure and returns every unmet requirement with a
 * stable reason code, not just a yes/no. Missing facts about the applicant
 * make a rule fail (deny by default) with a distinct "unknown" reason.
 */

export interface ApplicantFacts {
  enrolled?: boolean;
  /** Completed credit fraction 0-1. */
  courseProgress?: number;
  completedCourses?: readonly string[];
  skills?: readonly string[];
  organizationId?: string;
  /** ISO 3166-1 alpha-2 country code. */
  country?: string;
  /** Age in whole years, only used for the guardian-policy rule. */
  age?: number;
  guardianConsent?: boolean;
}

export type Rule =
  | { type: "enrollment"; required: true }
  | { type: "courseProgress"; minFraction: number }
  | { type: "skills"; anyOf?: readonly string[]; allOf?: readonly string[] }
  | { type: "organization"; allowed: readonly string[] }
  | { type: "geography"; allow?: readonly string[]; deny?: readonly string[] }
  | { type: "prerequisites"; courses: readonly string[] }
  | { type: "guardian"; belowAge: number }
  | { type: "all"; rules: readonly Rule[] }
  | { type: "any"; rules: readonly Rule[] }
  | { type: "not"; rule: Rule };

export interface RuleFailure {
  rule: Rule["type"];
  code:
    | "NOT_ENROLLED"
    | "PROGRESS_TOO_LOW"
    | "MISSING_SKILL"
    | "ORGANIZATION_NOT_ALLOWED"
    | "REGION_NOT_ALLOWED"
    | "PREREQUISITE_MISSING"
    | "GUARDIAN_CONSENT_REQUIRED"
    | "NO_ALTERNATIVE_MET"
    | "EXCLUDED"
    | "UNKNOWN_FACT";
  message: string;
}

export interface EligibilityOutcome {
  eligible: boolean;
  failures: RuleFailure[];
}

const norm = (s: string) => s.trim().toLowerCase();
const has = (list: readonly string[] | undefined, value: string) => (list ?? []).some((v) => norm(v) === norm(value));

function check(rule: Rule, f: ApplicantFacts): RuleFailure[] {
  const fail = (code: RuleFailure["code"], message: string): RuleFailure[] => [{ rule: rule.type, code, message }];
  switch (rule.type) {
    case "enrollment":
      if (f.enrolled === undefined) return fail("UNKNOWN_FACT", "Enrollment status is not known.");
      return f.enrolled ? [] : fail("NOT_ENROLLED", "You must be enrolled.");
    case "courseProgress":
      if (f.courseProgress === undefined) return fail("UNKNOWN_FACT", "Course progress is not known.");
      return f.courseProgress >= rule.minFraction ? [] : fail("PROGRESS_TOO_LOW", `Complete at least ${Math.round(rule.minFraction * 100)}% of your courses.`);
    case "skills": {
      if (f.skills === undefined) return fail("UNKNOWN_FACT", "Skills are not listed.");
      const missingAll = (rule.allOf ?? []).filter((s) => !has(f.skills, s));
      if (missingAll.length > 0) return fail("MISSING_SKILL", `Missing required skills: ${missingAll.join(", ")}.`);
      if (rule.anyOf && rule.anyOf.length > 0 && !rule.anyOf.some((s) => has(f.skills, s))) return fail("MISSING_SKILL", `Needs at least one of: ${rule.anyOf.join(", ")}.`);
      return [];
    }
    case "organization":
      if (f.organizationId === undefined) return fail("UNKNOWN_FACT", "Organization is not known.");
      return rule.allowed.includes(f.organizationId) ? [] : fail("ORGANIZATION_NOT_ALLOWED", "Your organization is not part of this call.");
    case "geography": {
      if (f.country === undefined) return fail("UNKNOWN_FACT", "Country is not known.");
      const c = f.country.toUpperCase();
      if (rule.deny?.map((x) => x.toUpperCase()).includes(c)) return fail("REGION_NOT_ALLOWED", "Applicants from your region are not eligible.");
      if (rule.allow && rule.allow.length > 0 && !rule.allow.map((x) => x.toUpperCase()).includes(c)) return fail("REGION_NOT_ALLOWED", "This call is limited to specific regions.");
      return [];
    }
    case "prerequisites": {
      if (f.completedCourses === undefined) return fail("UNKNOWN_FACT", "Completed courses are not known.");
      const missing = rule.courses.filter((c) => !has(f.completedCourses, c));
      return missing.length === 0 ? [] : fail("PREREQUISITE_MISSING", `Complete first: ${missing.join(", ")}.`);
    }
    case "guardian":
      if (f.age === undefined) return fail("UNKNOWN_FACT", "Age is not known.");
      return f.age >= rule.belowAge || f.guardianConsent === true ? [] : fail("GUARDIAN_CONSENT_REQUIRED", "A guardian's consent is required.");
    case "all":
      return rule.rules.flatMap((r) => check(r, f));
    case "any": {
      if (rule.rules.length === 0) return fail("NO_ALTERNATIVE_MET", "No alternatives are configured.");
      const results = rule.rules.map((r) => check(r, f));
      return results.some((r) => r.length === 0) ? [] : [{ rule: "any", code: "NO_ALTERNATIVE_MET", message: "None of the alternative requirements is met." }, ...results.flat()];
    }
    case "not":
      return check(rule.rule, f).length === 0 ? fail("EXCLUDED", "This applicant is excluded by the call's rules.") : [];
  }
}

export function evaluateEligibility(rule: Rule, facts: ApplicantFacts): EligibilityOutcome {
  const failures = check(rule, facts);
  return { eligible: failures.length === 0, failures };
}

export interface RuleIssue {
  path: string;
  message: string;
}

/** Structural validation so a malformed stored rule cannot silently pass everyone. */
export function validateRule(rule: unknown, path = "rule", depth = 0): RuleIssue[] {
  if (depth > 8) return [{ path, message: "rules are nested too deeply" }];
  if (!rule || typeof rule !== "object") return [{ path, message: "rule must be an object" }];
  const r = rule as Record<string, unknown>;
  switch (r.type) {
    case "enrollment":
      return r.required === true ? [] : [{ path, message: "enrollment rules need required: true" }];
    case "courseProgress":
      return typeof r.minFraction === "number" && r.minFraction >= 0 && r.minFraction <= 1 ? [] : [{ path, message: "minFraction must be between 0 and 1" }];
    case "skills":
      return Array.isArray(r.anyOf) || Array.isArray(r.allOf) ? [] : [{ path, message: "provide anyOf or allOf" }];
    case "organization":
      return Array.isArray(r.allowed) && r.allowed.length > 0 ? [] : [{ path, message: "allowed must be a non-empty list" }];
    case "geography":
      return Array.isArray(r.allow) || Array.isArray(r.deny) ? [] : [{ path, message: "provide allow or deny" }];
    case "prerequisites":
      return Array.isArray(r.courses) && r.courses.length > 0 ? [] : [{ path, message: "courses must be a non-empty list" }];
    case "guardian":
      return Number.isInteger(r.belowAge) && (r.belowAge as number) > 0 ? [] : [{ path, message: "belowAge must be a positive integer" }];
    case "all":
    case "any":
      return Array.isArray(r.rules) && r.rules.length > 0 ? r.rules.flatMap((child, i) => validateRule(child, `${path}.rules[${i}]`, depth + 1)) : [{ path, message: "rules must be a non-empty list" }];
    case "not":
      return validateRule(r.rule, `${path}.rule`, depth + 1);
    default:
      return [{ path, message: `unknown rule type ${String(r.type)}` }];
  }
}
