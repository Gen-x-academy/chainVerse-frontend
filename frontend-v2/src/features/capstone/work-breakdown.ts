/**
 * Capstone work breakdown structure (CAPSTONE-058).
 *
 * A project is split into ordered work packages, each with ordered tasks.
 * Tasks carry an estimate, an optional assignee, the tasks they depend on, an
 * acceptance condition and contribute to progress by estimate; packages
 * contribute to project progress by their weight. Dependency cycles and
 * schedule risks are checked separately (CAPSTONE-059); this module only
 * checks that dependencies point at tasks that exist.
 */

export interface WbsTask {
  id: string;
  title: string;
  /** 1-based position inside the package. */
  order: number;
  estimateHours: number;
  assigneeId?: string;
  dependsOn: string[];
  /** What must be true for the task to count as done. */
  acceptance: string;
}

export interface WorkPackage {
  id: string;
  title: string;
  /** 1-based position inside the project. */
  order: number;
  /** Share of project progress, in percent; all packages together must add to 100. */
  weight: number;
  tasks: WbsTask[];
}

export interface WbsIssue {
  path: string;
  message: string;
}

export const MAX_TASK_HOURS = 400;
const WEIGHT_TOLERANCE = 0.001;

/** Problems with the structure, or an empty list when it is valid. */
export function validateWbs(packages: readonly WorkPackage[], memberIds: readonly string[]): WbsIssue[] {
  const issues: WbsIssue[] = [];
  const bad = (path: string, message: string) => issues.push({ path, message });

  if (packages.length === 0) bad("packages", "add at least one work package");

  const taskIds = new Set<string>();
  const packageIds = new Set<string>();
  for (const pkg of packages) for (const t of pkg.tasks) taskIds.add(t.id);

  packages.forEach((pkg, i) => {
    const at = `packages[${i}]`;
    if (pkg.title.trim().length === 0) bad(`${at}.title`, "give the package a title");
    if (packageIds.has(pkg.id)) bad(`${at}.id`, "package ids must be unique");
    packageIds.add(pkg.id);
    if (pkg.order !== i + 1) bad(`${at}.order`, "package order must run 1, 2, 3, ... without gaps");
    if (!Number.isFinite(pkg.weight) || pkg.weight <= 0) bad(`${at}.weight`, "the weight must be above zero");
    if (pkg.tasks.length === 0) bad(`${at}.tasks`, "a package needs at least one task");

    const seen = new Set<string>();
    pkg.tasks.forEach((t, j) => {
      const tp = `${at}.tasks[${j}]`;
      if (t.title.trim().length === 0) bad(`${tp}.title`, "give the task a title");
      if (seen.has(t.id)) bad(`${tp}.id`, "task ids must be unique");
      seen.add(t.id);
      if (t.order !== j + 1) bad(`${tp}.order`, "task order must run 1, 2, 3, ... without gaps");
      if (!Number.isFinite(t.estimateHours) || t.estimateHours <= 0 || t.estimateHours > MAX_TASK_HOURS) {
        bad(`${tp}.estimateHours`, `the estimate must be above 0 and at most ${MAX_TASK_HOURS} hours`);
      }
      if (t.assigneeId !== undefined && !memberIds.includes(t.assigneeId)) bad(`${tp}.assigneeId`, "the assignee must be a member of the team");
      if (t.acceptance.trim().length === 0) bad(`${tp}.acceptance`, "state when the task counts as done");
      for (const dep of t.dependsOn) {
        if (dep === t.id) bad(`${tp}.dependsOn`, "a task cannot depend on itself");
        else if (!taskIds.has(dep)) bad(`${tp}.dependsOn`, `dependency "${dep}" was not found`);
      }
    });
  });

  // Task ids must also be unique across packages.
  const all = packages.flatMap((p) => p.tasks.map((t) => t.id));
  if (new Set(all).size !== all.length) bad("packages", "task ids must be unique across the project");

  const totalWeight = packages.reduce((sum, p) => sum + (Number.isFinite(p.weight) ? p.weight : 0), 0);
  if (packages.length > 0 && Math.abs(totalWeight - 100) > WEIGHT_TOLERANCE) bad("packages", `package weights must add up to 100 (they add up to ${round(totalWeight)})`);
  return issues;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function packageEstimate(pkg: WorkPackage): number {
  return pkg.tasks.reduce((sum, t) => sum + (Number.isFinite(t.estimateHours) ? t.estimateHours : 0), 0);
}

export function totalEstimate(packages: readonly WorkPackage[]): number {
  return packages.reduce((sum, p) => sum + packageEstimate(p), 0);
}

/** Hours of work assigned to each member, and the hours nobody owns yet. */
export function estimateByAssignee(packages: readonly WorkPackage[]): { byAssignee: Record<string, number>; unassigned: number } {
  const byAssignee: Record<string, number> = {};
  let unassigned = 0;
  for (const t of packages.flatMap((p) => p.tasks)) {
    if (t.assigneeId === undefined) unassigned += t.estimateHours;
    else byAssignee[t.assigneeId] = (byAssignee[t.assigneeId] ?? 0) + t.estimateHours;
  }
  return { byAssignee, unassigned };
}

/**
 * Weighted progress in percent (0 to 100). `taskProgress` maps a task id to a
 * fraction from 0 to 1; missing tasks count as 0 and values are clamped.
 */
export function projectProgress(packages: readonly WorkPackage[], taskProgress: Readonly<Record<string, number>>): number {
  const totalWeight = packages.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight <= 0) return 0;
  let weighted = 0;
  for (const pkg of packages) {
    const hours = packageEstimate(pkg);
    if (hours <= 0) continue;
    const done = pkg.tasks.reduce((sum, t) => {
      const raw = taskProgress[t.id];
      const fraction = typeof raw === "number" && Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;
      return sum + t.estimateHours * fraction;
    }, 0);
    weighted += pkg.weight * (done / hours);
  }
  return round(weighted / totalWeight * 100);
}

/** Move a package to a new 1-based position and renumber, without changing the input. */
export function movePackage(packages: readonly WorkPackage[], id: string, toOrder: number): WorkPackage[] {
  const index = packages.findIndex((p) => p.id === id);
  if (index < 0) return packages.map((p) => ({ ...p }));
  const list = packages.map((p) => ({ ...p }));
  const [moved] = list.splice(index, 1);
  const target = Math.min(Math.max(1, Math.trunc(toOrder) || 1), packages.length) - 1;
  list.splice(target, 0, moved as WorkPackage);
  return list.map((p, i) => ({ ...p, order: i + 1 }));
}
