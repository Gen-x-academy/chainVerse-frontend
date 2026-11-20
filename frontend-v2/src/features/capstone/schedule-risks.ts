/**
 * Dependency cycles and schedule risks (CAPSTONE-059).
 *
 * Works on any set of scheduled items (tasks or milestones) that have dates,
 * dependencies and an optional owner. Cyclic dependencies are rejected.
 * Beyond that it reports blocked critical paths, impossible dates, owners
 * booked on overlapping items, and deadline risk. It does not change the
 * input.
 */

export interface ScheduledItem {
  id: string;
  title: string;
  /** ISO dates, inclusive. */
  startsOn: string;
  endsOn: string;
  dependsOn: string[];
  ownerId?: string;
  done: boolean;
}

export type RiskKind = "cycle" | "missing_dependency" | "impossible_dates" | "starts_before_dependency" | "blocked_critical_path" | "resource_conflict" | "deadline_risk";

export interface ScheduleRisk {
  kind: RiskKind;
  /** The items involved, in a readable order. */
  itemIds: string[];
  severity: "error" | "warning";
  message: string;
}

const DAY = 86_400_000;
const day = (date: string): number => Math.floor(Date.parse(date) / DAY);

/**
 * Find one dependency cycle if there is any, as the ids in order with the
 * first id repeated at the end. Returns `undefined` for an acyclic graph.
 */
export function findCycle(items: readonly ScheduledItem[]): string[] | undefined {
  const byId = new Map(items.map((i) => [i.id, i]));
  const state = new Map<string, 0 | 1 | 2>(); // 1 visiting, 2 done
  const stack: string[] = [];

  const visit = (id: string): string[] | undefined => {
    state.set(id, 1);
    stack.push(id);
    for (const dep of byId.get(id)?.dependsOn ?? []) {
      if (!byId.has(dep)) continue;
      if (state.get(dep) === 1) return [...stack.slice(stack.indexOf(dep)), dep];
      if (!state.get(dep)) {
        const found = visit(dep);
        if (found) return found;
      }
    }
    stack.pop();
    state.set(id, 2);
    return undefined;
  };

  for (const item of items) {
    if (!state.get(item.id)) {
      const found = visit(item.id);
      if (found) return found;
    }
  }
  return undefined;
}

/** Would adding `from depends on to` create a cycle? Use before saving an edit. */
export function wouldCreateCycle(items: readonly ScheduledItem[], from: string, to: string): boolean {
  if (from === to) return true;
  const next = items.map((i) => (i.id === from ? { ...i, dependsOn: [...i.dependsOn, to] } : i));
  return findCycle(next) !== undefined;
}

/** Longest chain of unfinished items by calendar days, following dependencies. Empty when there is a cycle. */
export function criticalPath(items: readonly ScheduledItem[]): string[] {
  if (findCycle(items)) return [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const best = new Map<string, { length: number; path: string[] }>();
  const solve = (id: string): { length: number; path: string[] } => {
    const known = best.get(id);
    if (known) return known;
    const item = byId.get(id) as ScheduledItem;
    const own = Math.max(1, day(item.endsOn) - day(item.startsOn) + 1);
    let top = { length: 0, path: [] as string[] };
    for (const dep of item.dependsOn) {
      if (!byId.has(dep)) continue;
      const d = solve(dep);
      if (d.length > top.length) top = d;
    }
    const result = { length: top.length + own, path: [...top.path, id] };
    best.set(id, result);
    return result;
  };
  let longest = { length: 0, path: [] as string[] };
  for (const item of items) {
    if (item.done) continue;
    const r = solve(item.id);
    if (r.length > longest.length) longest = r;
  }
  return longest.path.filter((id) => !(byId.get(id) as ScheduledItem).done);
}

/** Every schedule problem found, errors before warnings. */
export function analyseSchedule(items: readonly ScheduledItem[], deadline: string, today: string): ScheduleRisk[] {
  const risks: ScheduleRisk[] = [];
  const byId = new Map(items.map((i) => [i.id, i]));

  const cycle = findCycle(items);
  if (cycle) risks.push({ kind: "cycle", itemIds: cycle, severity: "error", message: `These items depend on each other in a loop: ${cycle.join(" → ")}.` });

  for (const item of items) {
    if (day(item.endsOn) < day(item.startsOn) || Number.isNaN(day(item.startsOn)) || Number.isNaN(day(item.endsOn))) {
      risks.push({ kind: "impossible_dates", itemIds: [item.id], severity: "error", message: `"${item.title}" ends before it starts.` });
    }
    for (const dep of item.dependsOn) {
      const d = byId.get(dep);
      if (!d) risks.push({ kind: "missing_dependency", itemIds: [item.id, dep], severity: "error", message: `"${item.title}" depends on an item that does not exist.` });
      else if (day(item.startsOn) <= day(d.endsOn)) {
        risks.push({ kind: "starts_before_dependency", itemIds: [dep, item.id], severity: "error", message: `"${item.title}" starts before "${d.title}" has finished.` });
      }
    }
  }

  // An item that should have started but waits on something late or unfinished is blocked.
  for (const item of items) {
    if (item.done) continue;
    const blockers = item.dependsOn.map((id) => byId.get(id)).filter((d): d is ScheduledItem => d !== undefined && !d.done && day(d.endsOn) < day(today));
    if (blockers.length > 0) {
      risks.push({ kind: "blocked_critical_path", itemIds: [...blockers.map((b) => b.id), item.id], severity: "warning", message: `"${item.title}" is waiting on late work: ${blockers.map((b) => `"${b.title}"`).join(", ")}.` });
    }
  }

  // The same owner on items whose dates overlap.
  const owned = items.filter((i) => i.ownerId !== undefined && !i.done);
  for (let a = 0; a < owned.length; a++) {
    for (let b = a + 1; b < owned.length; b++) {
      const x = owned[a] as ScheduledItem;
      const y = owned[b] as ScheduledItem;
      if (x.ownerId === y.ownerId && day(x.startsOn) <= day(y.endsOn) && day(y.startsOn) <= day(x.endsOn)) {
        risks.push({ kind: "resource_conflict", itemIds: [x.id, y.id], severity: "warning", message: `The same person is booked on "${x.title}" and "${y.title}" at the same time.` });
      }
    }
  }

  // Deadline risk: unfinished work that ends after the deadline, or has too little room left.
  for (const item of items) {
    if (item.done) continue;
    if (day(item.endsOn) > day(deadline)) {
      risks.push({ kind: "deadline_risk", itemIds: [item.id], severity: "warning", message: `"${item.title}" is planned to finish after the project deadline.` });
    }
  }
  const path = criticalPath(items);
  if (path.length > 0) {
    const needed = path.reduce((sum, id) => {
      const i = byId.get(id) as ScheduledItem;
      return sum + Math.max(1, day(i.endsOn) - day(i.startsOn) + 1);
    }, 0);
    if (day(today) + needed > day(deadline)) {
      risks.push({ kind: "deadline_risk", itemIds: path, severity: "warning", message: `The longest chain of remaining work needs ${needed} days but only ${Math.max(0, day(deadline) - day(today))} remain.` });
    }
  }

  return risks.sort((a, b) => Number(b.severity === "error") - Number(a.severity === "error"));
}

/** Items can be saved only when there are no errors. Warnings are shown but do not block. */
export function canSaveSchedule(risks: readonly ScheduleRisk[]): boolean {
  return risks.every((r) => r.severity !== "error");
}
