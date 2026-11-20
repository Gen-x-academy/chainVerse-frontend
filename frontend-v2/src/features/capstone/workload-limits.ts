/**
 * Participant workload limits (CAPSTONE-046).
 *
 * Applies the concurrent-project, weekly-hours, team-size and supervision
 * capacity limits for an academic period. Pending reservations count as if
 * they were already active, so two teams cannot both reserve the last slot.
 */

export interface WorkloadLimits {
  maxConcurrentProjects: number;
  maxWeeklyHours: number;
  maxTeamSize: number;
  /** Supervisors only: how many teams one supervisor may oversee. */
  maxSupervisedTeams: number;
}

export interface WorkloadEntry {
  projectId: string;
  /** Hours per week committed to this project. */
  weeklyHours: number;
  state: "active" | "pending";
  periodId: string;
}

export type WorkloadViolationCode = "too_many_projects" | "too_many_hours" | "team_too_large" | "supervision_full";

export interface WorkloadViolation {
  code: WorkloadViolationCode;
  message: string;
  limit: number;
  /** What the total would be if the new request were accepted. */
  wouldBe: number;
}

export const DEFAULT_LIMITS: WorkloadLimits = { maxConcurrentProjects: 2, maxWeeklyHours: 20, maxTeamSize: 6, maxSupervisedTeams: 8 };

export interface ParticipantRequest {
  periodId: string;
  /** The project being joined. Its own entry is not counted twice. */
  projectId: string;
  weeklyHours: number;
  /** Team size after joining. */
  teamSizeAfter: number;
}

export function entriesInPeriod(entries: readonly WorkloadEntry[], periodId: string, exceptProjectId?: string): WorkloadEntry[] {
  return entries.filter((e) => e.periodId === periodId && e.projectId !== exceptProjectId);
}

/** Check a participant joining one more project. */
export function checkParticipant(entries: readonly WorkloadEntry[], request: ParticipantRequest, limits: WorkloadLimits = DEFAULT_LIMITS): WorkloadViolation[] {
  const others = entriesInPeriod(entries, request.periodId, request.projectId);
  const violations: WorkloadViolation[] = [];
  const projects = others.length + 1;
  if (projects > limits.maxConcurrentProjects) {
    violations.push({ code: "too_many_projects", message: `You can take part in at most ${limits.maxConcurrentProjects} projects at a time.`, limit: limits.maxConcurrentProjects, wouldBe: projects });
  }
  const hours = others.reduce((sum, e) => sum + e.weeklyHours, 0) + request.weeklyHours;
  if (hours > limits.maxWeeklyHours) {
    violations.push({ code: "too_many_hours", message: `Your weekly commitment cannot go above ${limits.maxWeeklyHours} hours.`, limit: limits.maxWeeklyHours, wouldBe: hours });
  }
  if (request.teamSizeAfter > limits.maxTeamSize) {
    violations.push({ code: "team_too_large", message: `A team can have at most ${limits.maxTeamSize} people.`, limit: limits.maxTeamSize, wouldBe: request.teamSizeAfter });
  }
  return violations;
}

/** Check a supervisor taking on one more team. */
export function checkSupervisor(supervised: readonly WorkloadEntry[], periodId: string, projectId: string, limits: WorkloadLimits = DEFAULT_LIMITS): WorkloadViolation[] {
  const count = entriesInPeriod(supervised, periodId, projectId).length + 1;
  if (count > limits.maxSupervisedTeams) {
    return [{ code: "supervision_full", message: `A supervisor can oversee at most ${limits.maxSupervisedTeams} teams.`, limit: limits.maxSupervisedTeams, wouldBe: count }];
  }
  return [];
}

export interface Remaining {
  projects: number;
  weeklyHours: number;
}

/** What a participant still has room for in a period. */
export function remainingCapacity(entries: readonly WorkloadEntry[], periodId: string, limits: WorkloadLimits = DEFAULT_LIMITS): Remaining {
  const inPeriod = entriesInPeriod(entries, periodId);
  return {
    projects: Math.max(0, limits.maxConcurrentProjects - inPeriod.length),
    weeklyHours: Math.max(0, limits.maxWeeklyHours - inPeriod.reduce((sum, e) => sum + e.weeklyHours, 0)),
  };
}

/** Pending reservations that have waited longer than `maxAgeHours` and should be released. */
export function staleReservations(reservations: ReadonlyArray<{ projectId: string; reservedAt: string }>, now: Date, maxAgeHours = 72): string[] {
  const cutoff = now.getTime() - maxAgeHours * 3_600_000;
  return reservations.filter((r) => Date.parse(r.reservedAt) < cutoff).map((r) => r.projectId);
}
