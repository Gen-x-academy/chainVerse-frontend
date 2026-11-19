/**
 * Capstone project objectives and success criteria (CAPSTONE-057).
 *
 * An objective is measurable: it has an owner, a baseline, a target, a unit
 * and dates, and the target must differ from the baseline in the stated
 * direction. Objectives are prioritized (must, should, could), carry a
 * visibility level, and can point at the charter clause they come from.
 * Everything here is pure; callers supply the project context.
 */

export const OBJECTIVE_PRIORITIES = ["must", "should", "could"] as const;
export type ObjectivePriority = (typeof OBJECTIVE_PRIORITIES)[number];

/** Who can see an objective: `team` is the narrowest, `public` the widest. */
export const OBJECTIVE_VISIBILITIES = ["team", "supervisors", "public"] as const;
export type ObjectiveVisibility = (typeof OBJECTIVE_VISIBILITIES)[number];

export type ObjectiveDirection = "increase" | "decrease";

export interface Objective {
  id: string;
  title: string;
  description?: string;
  priority: ObjectivePriority;
  ownerId: string;
  baseline: number;
  target: number;
  unit: string;
  direction: ObjectiveDirection;
  /** ISO dates (YYYY-MM-DD). */
  startsOn: string;
  dueOn: string;
  visibility: ObjectiveVisibility;
  /** Charter clause this objective traces back to. */
  charterClauseId?: string;
}

export interface ObjectiveContext {
  memberIds: readonly string[];
  /** The project window every objective must fit inside. */
  window: { startsOn: string; endsOn: string };
  /** When given, `charterClauseId` must be one of these. */
  charterClauseIds?: readonly string[];
}

export interface ObjectiveIssue {
  objectiveId: string;
  field: keyof Objective | "set";
  message: string;
}

export const MAX_OBJECTIVES = 12;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (value: string) => DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** Problems with one objective, or an empty list when it is valid. */
export function validateObjective(o: Objective, ctx: ObjectiveContext): ObjectiveIssue[] {
  const issues: ObjectiveIssue[] = [];
  const bad = (field: keyof Objective, message: string) => issues.push({ objectiveId: o.id, field, message });

  const title = o.title.trim();
  if (title.length < 5 || title.length > 120) bad("title", "the title needs 5 to 120 characters");
  if (o.description !== undefined && o.description.length > 2000) bad("description", "the description can be at most 2000 characters");
  if (!(OBJECTIVE_PRIORITIES as readonly string[]).includes(o.priority)) bad("priority", "choose must, should or could");
  if (!(OBJECTIVE_VISIBILITIES as readonly string[]).includes(o.visibility)) bad("visibility", "choose team, supervisors or public");
  if (!ctx.memberIds.includes(o.ownerId)) bad("ownerId", "the owner must be a member of the team");

  const unit = o.unit.trim();
  if (unit.length === 0 || unit.length > 20) bad("unit", "give a unit of up to 20 characters");

  if (!Number.isFinite(o.baseline)) bad("baseline", "the baseline must be a number");
  if (!Number.isFinite(o.target)) bad("target", "the target must be a number");
  if (Number.isFinite(o.baseline) && Number.isFinite(o.target)) {
    if (o.direction === "increase" && !(o.target > o.baseline)) bad("target", "the target must be above the baseline to increase");
    else if (o.direction === "decrease" && !(o.target < o.baseline)) bad("target", "the target must be below the baseline to decrease");
    else if (o.direction !== "increase" && o.direction !== "decrease") bad("direction", "choose increase or decrease");
  }

  if (!isDate(o.startsOn) || !isDate(o.dueOn)) bad("dueOn", "use dates in YYYY-MM-DD form");
  else if (!(o.startsOn < o.dueOn)) bad("dueOn", "the due date must be after the start date");
  else if (o.startsOn < ctx.window.startsOn || o.dueOn > ctx.window.endsOn) bad("dueOn", `dates must fall between ${ctx.window.startsOn} and ${ctx.window.endsOn}`);

  if (o.charterClauseId !== undefined && ctx.charterClauseIds && !ctx.charterClauseIds.includes(o.charterClauseId)) {
    bad("charterClauseId", "the charter clause was not found");
  }
  return issues;
}

/** Problems with the whole set: size, a required objective, unique ids and titles. */
export function validateObjectiveSet(objectives: readonly Objective[], ctx: ObjectiveContext): ObjectiveIssue[] {
  const issues = objectives.flatMap((o) => validateObjective(o, ctx));
  const set = (message: string) => issues.push({ objectiveId: "", field: "set", message });

  if (objectives.length === 0) set("add at least one objective");
  if (objectives.length > MAX_OBJECTIVES) set(`a project can have at most ${MAX_OBJECTIVES} objectives`);
  if (objectives.length > 0 && !objectives.some((o) => o.priority === "must")) set("at least one objective must have priority must");

  const ids = new Set<string>();
  const titles = new Set<string>();
  for (const o of objectives) {
    if (ids.has(o.id)) issues.push({ objectiveId: o.id, field: "id", message: "objective ids must be unique" });
    ids.add(o.id);
    const key = o.title.trim().toLowerCase();
    if (titles.has(key)) issues.push({ objectiveId: o.id, field: "title", message: "objective titles must be unique" });
    titles.add(key);
  }
  return issues;
}

/** Must before should before could, then earliest due date, then id. */
export function prioritize(objectives: readonly Objective[]): Objective[] {
  const rank = (p: ObjectivePriority) => OBJECTIVE_PRIORITIES.indexOf(p);
  return [...objectives].sort((a, b) => rank(a.priority) - rank(b.priority) || a.dueOn.localeCompare(b.dueOn) || a.id.localeCompare(b.id));
}

/** Progress from baseline to target as a fraction from 0 to 1, or `null` when it cannot be computed. */
export function objectiveProgress(o: Pick<Objective, "baseline" | "target">, current: number): number | null {
  if (![o.baseline, o.target, current].every(Number.isFinite) || o.baseline === o.target) return null;
  const fraction = (current - o.baseline) / (o.target - o.baseline);
  return Math.min(1, Math.max(0, fraction));
}

export type Audience = "team" | "supervisor" | "public";

const REACH: Record<Audience, ObjectiveVisibility[]> = {
  team: ["team", "supervisors", "public"],
  supervisor: ["supervisors", "public"],
  public: ["public"],
};

/** Objectives the audience may see. Unknown audiences see nothing. */
export function visibleObjectives(objectives: readonly Objective[], audience: Audience): Objective[] {
  const allowed = REACH[audience] ?? [];
  return objectives.filter((o) => allowed.includes(o.visibility));
}
