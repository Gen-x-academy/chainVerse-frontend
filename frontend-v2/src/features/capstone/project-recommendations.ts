/**
 * Explainable project recommendations (CAPSTONE-029).
 *
 * Ranks only eligible opportunities using the profile fields the participant
 * declared (interests, skills, goals, schedule, mode, program constraints).
 * Each recommendation carries the human-readable reasons behind its score.
 * Nothing about protected traits is read, ties break deterministically, and a
 * sparse profile produces a note instead of confident-looking rankings.
 */

export interface RecommendationProfile {
  interests: string[];
  skills: string[];
  goals: string[];
  /** Hours per week the person can commit. */
  availabilityHours?: number;
  preferredModes: string[];
  /** Program constraints, e.g. a required term. */
  program?: { term?: string };
  [key: string]: unknown;
}

export interface RecommendableOpportunity {
  id: string;
  title: string;
  themes: string[];
  skills: string[];
  goalsServed: string[];
  weeklyHours: number;
  mode: string;
  term?: string;
  eligible: boolean;
}

export interface Reason {
  kind: "interest" | "skill" | "goal" | "schedule" | "mode" | "program";
  text: string;
  points: number;
}

export interface Recommendation {
  opportunityId: string;
  title: string;
  score: number;
  reasons: Reason[];
}

export interface RecommendationResult {
  recommendations: Recommendation[];
  /** Plain-language explanation when results are limited or empty. */
  note: string | null;
  excluded: { ineligible: number; blockedByProgram: number };
}

export const WEIGHTS = { interest: 30, skill: 30, goal: 20, schedule: 10, mode: 10 } as const;
export const MIN_SIGNALS = 2;
export const MAX_RECOMMENDATIONS = 10;
/** A recommendation needs at least this score to be shown. */
export const MIN_SCORE = 20;

const norm = (s: string) => s.normalize("NFKC").trim().toLowerCase();
const overlap = (a: readonly string[], b: readonly string[]) => {
  const set = new Set(b.map(norm));
  return [...new Set(a.map(norm))].filter((x) => set.has(x)).sort();
};

/** How many of the declared signal groups the profile actually has. */
export function profileSignals(p: RecommendationProfile): number {
  return [p.interests?.length > 0, p.skills?.length > 0, p.goals?.length > 0, p.availabilityHours !== undefined, p.preferredModes?.length > 0].filter(Boolean).length;
}

export function recommendProjects(profile: RecommendationProfile, opportunities: readonly RecommendableOpportunity[], limit = MAX_RECOMMENDATIONS): RecommendationResult {
  const excluded = { ineligible: 0, blockedByProgram: 0 };
  if (profileSignals(profile) < MIN_SIGNALS) {
    return { recommendations: [], note: "Add a few interests, skills or goals to get recommendations.", excluded };
  }

  const scored: Recommendation[] = [];
  for (const o of opportunities) {
    if (!o.eligible) {
      excluded.ineligible += 1;
      continue;
    }
    if (profile.program?.term && o.term && norm(profile.program.term) !== norm(o.term)) {
      excluded.blockedByProgram += 1;
      continue;
    }
    const reasons: Reason[] = [];
    const interests = overlap(profile.interests ?? [], o.themes);
    if (interests.length) reasons.push({ kind: "interest", text: `Matches your interest in ${interests.join(", ")}`, points: Math.round(WEIGHTS.interest * Math.min(1, interests.length / Math.max(1, Math.min(3, (profile.interests ?? []).length)))) });
    const skills = overlap(profile.skills ?? [], o.skills);
    if (skills.length) reasons.push({ kind: "skill", text: `Uses your skills: ${skills.join(", ")}`, points: Math.round(WEIGHTS.skill * (skills.length / Math.max(1, o.skills.length))) });
    const goals = overlap(profile.goals ?? [], o.goalsServed);
    if (goals.length) reasons.push({ kind: "goal", text: `Supports your goal: ${goals.join(", ")}`, points: Math.round(WEIGHTS.goal * Math.min(1, goals.length / Math.max(1, (profile.goals ?? []).length))) });
    if (profile.availabilityHours !== undefined && o.weeklyHours <= profile.availabilityHours) reasons.push({ kind: "schedule", text: `Fits your ${profile.availabilityHours} hours a week (needs ${o.weeklyHours})`, points: WEIGHTS.schedule });
    if (profile.preferredModes?.map(norm).includes(norm(o.mode))) reasons.push({ kind: "mode", text: `Offered ${o.mode.replace("_", "-")}, which you prefer`, points: WEIGHTS.mode });

    const score = reasons.reduce((n, r) => n + r.points, 0);
    if (score >= MIN_SCORE) scored.push({ opportunityId: o.id, title: o.title, score, reasons: reasons.sort((a, b) => b.points - a.points || a.kind.localeCompare(b.kind)) });
  }

  scored.sort((a, b) => b.score - a.score || a.opportunityId.localeCompare(b.opportunityId));
  const recommendations = scored.slice(0, limit);
  return {
    recommendations,
    note: recommendations.length === 0 ? "No eligible opportunities match your profile closely yet." : null,
    excluded,
  };
}
