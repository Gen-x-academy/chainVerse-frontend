/**
 * Project risks and mitigations (CAPSTONE-062).
 *
 * A risk register tracks categorised risks with likelihood, impact, owner,
 * mitigation, contingency, review dates and status. Visibility is scoped so a
 * risk about people or funding is not shown to everyone. Every change is
 * appended to a history so earlier scores can be seen.
 */

export type RiskCategory = "schedule" | "technical" | "people" | "funding" | "ethics" | "external";
export type Level = 1 | 2 | 3 | 4 | 5;
export type RiskStatus = "open" | "mitigating" | "accepted" | "closed" | "occurred";
export type RiskVisibility = "team" | "leads_and_supervisors" | "coordinators";

export interface RiskChange {
  at: string;
  by: string;
  likelihood: Level;
  impact: Level;
  status: RiskStatus;
}

export interface ProjectRisk {
  id: string;
  title: string;
  category: RiskCategory;
  likelihood: Level;
  impact: Level;
  ownerId: string;
  mitigation: string;
  contingency: string;
  nextReviewOn: string;
  status: RiskStatus;
  visibility: RiskVisibility;
  history: RiskChange[];
}

export interface RiskIssue {
  path: string;
  message: string;
}

export type ViewerRole = "team_member" | "lead" | "supervisor" | "coordinator" | "outsider";

const LEVELS = [1, 2, 3, 4, 5];

/** Likelihood times impact, 1 to 25. */
export function riskScore(r: Pick<ProjectRisk, "likelihood" | "impact">): number {
  return r.likelihood * r.impact;
}

export type RiskRating = "low" | "medium" | "high" | "critical";

export function riskRating(score: number): RiskRating {
  if (score >= 20) return "critical";
  if (score >= 12) return "high";
  if (score >= 6) return "medium";
  return "low";
}

/** Problems with a risk entry, or an empty list when valid. */
export function validateRisk(r: ProjectRisk, memberIds: readonly string[]): RiskIssue[] {
  const issues: RiskIssue[] = [];
  const bad = (path: string, message: string) => issues.push({ path, message });
  if (r.title.trim().length === 0) bad("title", "give the risk a title");
  if (!LEVELS.includes(r.likelihood)) bad("likelihood", "likelihood must be from 1 to 5");
  if (!LEVELS.includes(r.impact)) bad("impact", "impact must be from 1 to 5");
  if (!memberIds.includes(r.ownerId)) bad("ownerId", "the owner must be a team member");
  if (Number.isNaN(Date.parse(r.nextReviewOn))) bad("nextReviewOn", "choose a review date");
  const active = r.status === "open" || r.status === "mitigating";
  if (active && r.mitigation.trim().length === 0) bad("mitigation", "describe how you will reduce this risk");
  if (active && riskRating(riskScore(r)) !== "low" && r.contingency.trim().length === 0) bad("contingency", "describe what you will do if this happens");
  // People, funding and ethics risks are sensitive, so they cannot be visible to the whole team by default.
  if (["people", "funding", "ethics"].includes(r.category) && r.visibility === "team") bad("visibility", "this kind of risk must be limited to leads, supervisors or coordinators");
  return issues;
}

/** Update a risk. The new score and status are added to its history. */
export function updateRisk(r: ProjectRisk, change: { likelihood?: Level; impact?: Level; status?: RiskStatus; mitigation?: string; contingency?: string; nextReviewOn?: string }, by: string, at: string): ProjectRisk {
  const next: ProjectRisk = {
    ...r,
    likelihood: change.likelihood ?? r.likelihood,
    impact: change.impact ?? r.impact,
    status: change.status ?? r.status,
    mitigation: change.mitigation ?? r.mitigation,
    contingency: change.contingency ?? r.contingency,
    nextReviewOn: change.nextReviewOn ?? r.nextReviewOn,
  };
  if (next.likelihood === r.likelihood && next.impact === r.impact && next.status === r.status) return { ...next, history: r.history };
  return { ...next, history: [...r.history, { at, by, likelihood: next.likelihood, impact: next.impact, status: next.status }] };
}

const VISIBLE_TO: Record<RiskVisibility, ViewerRole[]> = {
  team: ["team_member", "lead", "supervisor", "coordinator"],
  leads_and_supervisors: ["lead", "supervisor", "coordinator"],
  coordinators: ["coordinator"],
};

/** Deny by default: only listed roles see a risk. The owner always sees their own. */
export function canView(r: ProjectRisk, role: ViewerRole, userId?: string): boolean {
  if (userId !== undefined && userId === r.ownerId) return true;
  return VISIBLE_TO[r.visibility].includes(role);
}

export function visibleRisks(risks: readonly ProjectRisk[], role: ViewerRole, userId?: string): ProjectRisk[] {
  return risks.filter((r) => canView(r, role, userId));
}

/** Risks whose review date has come and that are still being tracked. */
export function dueForReview(risks: readonly ProjectRisk[], today: string): ProjectRisk[] {
  return risks.filter((r) => (r.status === "open" || r.status === "mitigating") && Date.parse(r.nextReviewOn) <= Date.parse(today));
}

/** The register sorted for display: highest score first, ties by review date. */
export function rankRisks(risks: readonly ProjectRisk[]): ProjectRisk[] {
  return [...risks].sort((a, b) => riskScore(b) - riskScore(a) || Date.parse(a.nextReviewOn) - Date.parse(b.nextReviewOn));
}

/** Counts by rating among tracked risks, for a summary tile. */
export function summary(risks: readonly ProjectRisk[]): Record<RiskRating, number> {
  const counts: Record<RiskRating, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const r of risks) if (r.status === "open" || r.status === "mitigating") counts[riskRating(riskScore(r))] += 1;
  return counts;
}
