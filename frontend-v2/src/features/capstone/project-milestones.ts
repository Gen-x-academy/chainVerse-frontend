/**
 * Project milestones (CAPSTONE-060).
 *
 * A project defines ordered milestones, each with a due date, dependencies, a
 * reviewer, deliverables, completion rules and an optional link to a funding
 * tranche. Milestones inside the project window stay in date order, depend only
 * on earlier milestones, and are reviewed by someone who is not on the team's
 * doing side of that milestone.
 */

export interface Deliverable {
  id: string;
  title: string;
  required: boolean;
}

export type CompletionRule = "all_required_deliverables" | "reviewer_sign_off" | "both";

export interface Milestone {
  id: string;
  title: string;
  /** 1-based position in the project. */
  order: number;
  dueOn: string;
  dependsOn: string[];
  reviewerId: string;
  deliverables: Deliverable[];
  completionRule: CompletionRule;
  /** Funding tranche released when this milestone completes, if any. */
  fundingTrancheId?: string;
  status: "planned" | "in_progress" | "in_review" | "completed";
}

export interface ProjectWindow {
  startsOn: string;
  endsOn: string;
  memberIds: string[];
  /** Ids of tranches that exist for the project. */
  trancheIds: string[];
}

export interface MilestoneIssue {
  path: string;
  message: string;
}

export const MAX_MILESTONES = 30;

/** Problems with the milestone list, or an empty list when valid. */
export function validateMilestones(milestones: readonly Milestone[], window: ProjectWindow): MilestoneIssue[] {
  const issues: MilestoneIssue[] = [];
  const bad = (path: string, message: string) => issues.push({ path, message });
  if (milestones.length === 0) bad("milestones", "add at least one milestone");
  if (milestones.length > MAX_MILESTONES) bad("milestones", `a project can have at most ${MAX_MILESTONES} milestones`);

  const ids = new Set<string>();
  const position = new Map(milestones.map((m, i) => [m.id, i]));
  const usedTranches = new Set<string>();

  milestones.forEach((m, i) => {
    const at = `milestones[${i}]`;
    if (m.title.trim().length === 0) bad(`${at}.title`, "give the milestone a title");
    if (ids.has(m.id)) bad(`${at}.id`, "milestone ids must be unique");
    ids.add(m.id);
    if (m.order !== i + 1) bad(`${at}.order`, "order must run 1, 2, 3, ... without gaps");

    const due = Date.parse(m.dueOn);
    if (Number.isNaN(due)) bad(`${at}.dueOn`, "the due date is not a valid date");
    else {
      if (due < Date.parse(window.startsOn) || due > Date.parse(window.endsOn)) bad(`${at}.dueOn`, "the due date must fall inside the project dates");
      const previous = milestones[i - 1];
      if (previous && due < Date.parse(previous.dueOn)) bad(`${at}.dueOn`, "milestones must be in date order");
    }

    for (const dep of m.dependsOn) {
      const at2 = position.get(dep);
      if (dep === m.id) bad(`${at}.dependsOn`, "a milestone cannot depend on itself");
      else if (at2 === undefined) bad(`${at}.dependsOn`, `dependency "${dep}" was not found`);
      else if (at2 > i) bad(`${at}.dependsOn`, "a milestone can only depend on an earlier one");
    }

    if (m.reviewerId.trim().length === 0) bad(`${at}.reviewerId`, "choose a reviewer");

    if (m.deliverables.length === 0) bad(`${at}.deliverables`, "list at least one deliverable");
    if (new Set(m.deliverables.map((d) => d.id)).size !== m.deliverables.length) bad(`${at}.deliverables`, "deliverable ids must be unique");
    if (m.deliverables.some((d) => d.title.trim().length === 0)) bad(`${at}.deliverables`, "give every deliverable a title");
    const needsDeliverables = m.completionRule !== "reviewer_sign_off";
    if (needsDeliverables && !m.deliverables.some((d) => d.required)) bad(`${at}.completionRule`, "this rule needs at least one required deliverable");

    if (m.fundingTrancheId !== undefined) {
      if (!window.trancheIds.includes(m.fundingTrancheId)) bad(`${at}.fundingTrancheId`, "this funding tranche does not exist");
      else if (usedTranches.has(m.fundingTrancheId)) bad(`${at}.fundingTrancheId`, "a funding tranche can be linked to one milestone only");
      usedTranches.add(m.fundingTrancheId);
    }
  });
  return issues;
}

/** The reviewer must be independent of the work: not a team member. */
export function reviewerIssues(milestones: readonly Milestone[], memberIds: readonly string[]): MilestoneIssue[] {
  return milestones.flatMap((m, i) => (memberIds.includes(m.reviewerId) ? [{ path: `milestones[${i}].reviewerId`, message: "the reviewer cannot be a member of the team" }] : []));
}

/** Whether a milestone may start: everything it depends on is completed. */
export function canStart(milestone: Milestone, all: readonly Milestone[]): boolean {
  return milestone.status === "planned" && milestone.dependsOn.every((id) => all.find((m) => m.id === id)?.status === "completed");
}

/** Whether the completion rule is satisfied. */
export function isComplete(milestone: Milestone, handedOver: readonly string[], signedOff: boolean): boolean {
  const required = milestone.deliverables.filter((d) => d.required).map((d) => d.id);
  const deliverablesOk = required.every((id) => handedOver.includes(id));
  switch (milestone.completionRule) {
    case "all_required_deliverables":
      return deliverablesOk;
    case "reviewer_sign_off":
      return signedOff;
    case "both":
      return deliverablesOk && signedOff;
  }
}

/** The next milestone that is not completed, by order. */
export function nextMilestone(milestones: readonly Milestone[]): Milestone | undefined {
  return [...milestones].sort((a, b) => a.order - b.order).find((m) => m.status !== "completed");
}

/** Milestones that are past due and not completed. */
export function overdue(milestones: readonly Milestone[], today: string): Milestone[] {
  return milestones.filter((m) => m.status !== "completed" && Date.parse(m.dueOn) < Date.parse(today));
}

/** Move a milestone to a new 1-based position and renumber, without changing the input. */
export function moveMilestone(milestones: readonly Milestone[], id: string, toOrder: number): Milestone[] {
  const index = milestones.findIndex((m) => m.id === id);
  if (index < 0) return milestones.map((m) => ({ ...m }));
  const list = milestones.map((m) => ({ ...m }));
  const [moved] = list.splice(index, 1);
  const target = Math.min(Math.max(1, Math.trunc(toOrder) || 1), milestones.length) - 1;
  list.splice(target, 0, moved as Milestone);
  return list.map((m, i) => ({ ...m, order: i + 1 }));
}
