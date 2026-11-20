/**
 * Pause and resume projects (CAPSTONE-053).
 *
 * A pause needs a reason, a start date and an end date within the policy
 * maximum. It shows its effect on the deadline and on funding, follows the
 * approval rule for its length, expires on its own, and can only be resumed
 * safely when nothing blocks the project from restarting.
 */

export type PauseReason = "illness" | "academic_conflict" | "sponsor_delay" | "resource_unavailable" | "other";

export interface PausePolicy {
  /** Pauses up to this many days need only the lead's approval. */
  shortPauseDays: number;
  /** The longest pause that can ever be approved. */
  maxPauseDays: number;
  /** The most total paused days across the project. */
  maxTotalPausedDays: number;
}

export const DEFAULT_PAUSE_POLICY: PausePolicy = { shortPauseDays: 14, maxPauseDays: 60, maxTotalPausedDays: 90 };

export interface PauseRequest {
  id: string;
  reason: PauseReason;
  note?: string;
  startsOn: string;
  endsOn: string;
  requestedBy: string;
  /** Who must approve, decided from the length when requested. */
  approversNeeded: Array<"lead" | "supervisor" | "coordinator">;
  approvals: string[];
  status: "requested" | "approved" | "active" | "resumed" | "expired" | "denied";
  resumedOn?: string;
}

export interface PauseImpact {
  days: number;
  newDeadline: string;
  fundingTranchesAffected: number;
}

export type PauseErrorCode = "bad_dates" | "too_long" | "total_exceeded" | "needs_note" | "overlaps" | "wrong_state" | "blocked";

export type PauseResult<T> = { ok: true; value: T } | { ok: false; code: PauseErrorCode; message: string };

const MESSAGES: Record<PauseErrorCode, string> = {
  bad_dates: "The pause must end after it starts.",
  too_long: "This pause is longer than the policy allows.",
  total_exceeded: "The project has used up its total pause time.",
  needs_note: "Add a short note when the reason is Other.",
  overlaps: "This pause overlaps another one.",
  wrong_state: "This step is not available in the pause's current state.",
  blocked: "The project cannot restart yet.",
};

const fail = <T>(code: PauseErrorCode): PauseResult<T> => ({ ok: false, code, message: MESSAGES[code] });
const DAY = 86_400_000;

export const daysBetween = (from: string, to: string): number => Math.round((Date.parse(to) - Date.parse(from)) / DAY);

function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * DAY).toISOString().slice(0, 10);
}

export function approversFor(days: number, policy: PausePolicy = DEFAULT_PAUSE_POLICY): PauseRequest["approversNeeded"] {
  if (days <= policy.shortPauseDays) return ["lead"];
  if (days <= policy.maxPauseDays / 2) return ["lead", "supervisor"];
  return ["lead", "supervisor", "coordinator"];
}

/** Effect of a pause on the deadline and on funding tranches that fall inside it. */
export function pauseImpact(request: Pick<PauseRequest, "startsOn" | "endsOn">, deadline: string, tranchesDue: readonly string[]): PauseImpact {
  const days = daysBetween(request.startsOn, request.endsOn);
  const inside = tranchesDue.filter((d) => Date.parse(d) >= Date.parse(request.startsOn) && Date.parse(d) < Date.parse(request.endsOn));
  return { days, newDeadline: addDays(deadline, days), fundingTranchesAffected: inside.length };
}

export function requestPause(
  input: { id: string; reason: PauseReason; note?: string; startsOn: string; endsOn: string; requestedBy: string },
  existing: readonly PauseRequest[],
  policy: PausePolicy = DEFAULT_PAUSE_POLICY,
): PauseResult<PauseRequest> {
  const days = daysBetween(input.startsOn, input.endsOn);
  if (Number.isNaN(days) || days <= 0) return fail("bad_dates");
  if (input.reason === "other" && (input.note ?? "").trim().length === 0) return fail("needs_note");
  if (days > policy.maxPauseDays) return fail("too_long");
  const live = existing.filter((p) => p.status !== "denied" && p.status !== "expired");
  const used = live.reduce((sum, p) => sum + daysBetween(p.startsOn, p.resumedOn ?? p.endsOn), 0);
  if (used + days > policy.maxTotalPausedDays) return fail("total_exceeded");
  if (live.some((p) => Date.parse(input.startsOn) < Date.parse(p.resumedOn ?? p.endsOn) && Date.parse(p.startsOn) < Date.parse(input.endsOn))) return fail("overlaps");
  const request: PauseRequest = {
    id: input.id,
    reason: input.reason,
    ...(input.note ? { note: input.note } : {}),
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    requestedBy: input.requestedBy,
    approversNeeded: approversFor(days, policy),
    approvals: [],
    status: "requested",
  };
  return { ok: true, value: request };
}

/** Record an approval from one required role. Repeats change nothing. */
export function approvePause(request: PauseRequest, role: "lead" | "supervisor" | "coordinator"): PauseResult<PauseRequest> {
  if (request.status !== "requested") return fail("wrong_state");
  if (!request.approversNeeded.includes(role)) return fail("wrong_state");
  if (request.approvals.includes(role)) return { ok: true, value: request };
  const approvals = [...request.approvals, role];
  const all = request.approversNeeded.every((r) => approvals.includes(r));
  return { ok: true, value: { ...request, approvals, status: all ? "approved" : "requested" } };
}

/** What the project's pause state is on a given day. */
export function pauseStateOn(request: PauseRequest, day: string): PauseRequest["status"] {
  if (request.status === "approved" || request.status === "active") {
    if (Date.parse(day) >= Date.parse(request.endsOn)) return "expired";
    if (Date.parse(day) >= Date.parse(request.startsOn)) return "active";
  }
  return request.status;
}

/** Resume early or on the end date. Fails when something still blocks a restart. */
export function resumeProject(request: PauseRequest, day: string, blockers: readonly string[]): PauseResult<PauseRequest> {
  if (pauseStateOn(request, day) !== "active" && pauseStateOn(request, day) !== "expired") return fail("wrong_state");
  if (blockers.length > 0) return fail("blocked");
  return { ok: true, value: { ...request, status: "resumed", resumedOn: day } };
}

/** Reasons a project cannot restart, for the resume screen. */
export function resumeBlockers(input: { teamActiveMembers: number; minTeamSize: number; charterAccepted: boolean; guardianConsentsValid: boolean }): string[] {
  const blockers: string[] = [];
  if (input.teamActiveMembers < input.minTeamSize) blockers.push("the team is below its minimum size");
  if (!input.charterAccepted) blockers.push("the charter needs approval again");
  if (!input.guardianConsentsValid) blockers.push("a guardian consent has expired");
  return blockers;
}
