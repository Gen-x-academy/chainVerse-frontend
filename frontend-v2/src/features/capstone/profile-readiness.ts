/**
 * Profile readiness indicators (CAPSTONE-015).
 *
 * Explainable completeness: a fixed checklist of profile steps, each with a
 * stated reason. There is no hidden ranking and no protected trait is read:
 * the function picks specific fields by name and ignores everything else, so
 * adding an unrelated property to a profile cannot change the result. When too
 * little is filled in, it says "not enough information" instead of showing a
 * misleading low (or high) percentage.
 */

export interface ReadinessInput {
  displayName?: string;
  skills?: readonly string[];
  interests?: readonly string[];
  availabilityHours?: number;
  portfolioCount?: number;
  preferredRoles?: readonly string[];
  identityVerified?: boolean;
  /** Unknown extra fields (including any sensitive ones) are never read. */
  [key: string]: unknown;
}

export interface ReadinessItem {
  id: string;
  label: string;
  /** Why this step matters, shown to the user. */
  reason: string;
  weight: number;
  met: boolean;
}

export type ReadinessStatus = "insufficient_data" | "incomplete" | "ready";

export interface ReadinessResult {
  status: ReadinessStatus;
  /** 0-100, or null when the data is too sparse to say. */
  percent: number | null;
  items: ReadinessItem[];
  /** Plain-language next steps, most valuable first. */
  nextSteps: string[];
  /** Eligibility indicators are separate from completeness. */
  eligibility: { canApply: boolean; blockers: string[] };
}

/** Fewer completed checks than this and no score is shown. */
export const MIN_SIGNAL_ITEMS = 2;
export const READY_THRESHOLD = 80;

const nonEmpty = (v: readonly string[] | undefined, min = 1) => Array.isArray(v) && v.filter((s) => typeof s === "string" && s.trim()).length >= min;

export function calculateReadiness(input: ReadinessInput): ReadinessResult {
  const items: ReadinessItem[] = [
    { id: "name", label: "Display name", reason: "Lets teammates and supervisors recognise you.", weight: 10, met: typeof input.displayName === "string" && input.displayName.trim().length >= 2 },
    { id: "skills", label: "At least 3 skills", reason: "Skills are used to suggest matching projects.", weight: 25, met: nonEmpty(input.skills, 3) },
    { id: "interests", label: "At least 1 interest", reason: "Interests help find relevant research themes.", weight: 15, met: nonEmpty(input.interests, 1) },
    { id: "availability", label: "Weekly availability", reason: "Projects need to know how much time you can commit.", weight: 15, met: typeof input.availabilityHours === "number" && input.availabilityHours > 0 },
    { id: "portfolio", label: "A portfolio item", reason: "Shows evidence of past work.", weight: 20, met: typeof input.portfolioCount === "number" && input.portfolioCount >= 1 },
    { id: "roles", label: "A preferred role", reason: "Teams use roles to balance their members.", weight: 15, met: nonEmpty(input.preferredRoles, 1) },
  ];

  const met = items.filter((i) => i.met);
  const signal = met.length;
  const total = items.reduce((n, i) => n + i.weight, 0);
  const earned = met.reduce((n, i) => n + i.weight, 0);

  const blockers: string[] = [];
  if (input.identityVerified !== true) blockers.push("Identity is not verified yet.");
  if (!items.find((i) => i.id === "skills")?.met) blockers.push("Add at least 3 skills to apply.");
  if (!items.find((i) => i.id === "availability")?.met) blockers.push("State your weekly availability to apply.");

  if (signal < MIN_SIGNAL_ITEMS) {
    return {
      status: "insufficient_data",
      percent: null,
      items,
      nextSteps: items.filter((i) => !i.met).sort((a, b) => b.weight - a.weight).map((i) => i.label),
      eligibility: { canApply: false, blockers },
    };
  }

  const percent = Math.round((earned / total) * 100);
  return {
    status: percent >= READY_THRESHOLD ? "ready" : "incomplete",
    percent,
    items,
    nextSteps: items.filter((i) => !i.met).sort((a, b) => b.weight - a.weight).map((i) => i.label),
    eligibility: { canApply: blockers.length === 0, blockers },
  };
}
