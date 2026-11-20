/**
 * Objective progress check-ins (CAPSTONE-061).
 *
 * Participants record periodic updates against an objective: status,
 * confidence, blockers, evidence references and next actions. A check-in is
 * authored by one participant and is never edited afterwards. A correction is
 * a new check-in that points at the one it replaces, so history stays intact.
 */

export type CheckInStatus = "on_track" | "at_risk" | "blocked" | "done";
export type Confidence = 1 | 2 | 3 | 4 | 5;

export interface CheckIn {
  id: string;
  objectiveId: string;
  authorId: string;
  createdAt: string;
  status: CheckInStatus;
  /** 1 (low) to 5 (high). */
  confidence: Confidence;
  summary: string;
  blockers: string[];
  /** References to evidence, not file contents. */
  evidenceRefs: string[];
  nextActions: string[];
  /** Set when this check-in corrects an earlier one. */
  supersedes?: string;
}

export interface CheckInIssue {
  path: string;
  message: string;
}

export const MAX_SUMMARY = 1000;
export const MAX_LIST_ITEMS = 10;

/** Problems with a new check-in, or an empty list when valid. */
export function validateCheckIn(c: CheckIn, memberIds: readonly string[]): CheckInIssue[] {
  const issues: CheckInIssue[] = [];
  const bad = (path: string, message: string) => issues.push({ path, message });
  if (!memberIds.includes(c.authorId)) bad("authorId", "only team members can post a check-in");
  if (c.summary.trim().length === 0) bad("summary", "write a short summary");
  if (c.summary.length > MAX_SUMMARY) bad("summary", `keep the summary under ${MAX_SUMMARY} characters`);
  if (![1, 2, 3, 4, 5].includes(c.confidence)) bad("confidence", "confidence must be from 1 to 5");
  if (c.status === "blocked" && c.blockers.length === 0) bad("blockers", "say what is blocking you");
  if (c.status !== "done" && c.nextActions.length === 0) bad("nextActions", "list at least one next action");
  if (c.status === "done" && c.evidenceRefs.length === 0) bad("evidenceRefs", "add evidence that the objective is done");
  for (const [name, list] of [["blockers", c.blockers], ["evidenceRefs", c.evidenceRefs], ["nextActions", c.nextActions]] as const) {
    if (list.length > MAX_LIST_ITEMS) bad(name, `list at most ${MAX_LIST_ITEMS} items`);
    if (list.some((x) => x.trim().length === 0)) bad(name, "remove blank items");
  }
  return issues;
}

export interface CheckInHistory {
  checkIns: CheckIn[];
}

/** Add a check-in. Same id twice is ignored, so a retry cannot duplicate it. */
export function addCheckIn(history: CheckInHistory, checkIn: CheckIn): { history: CheckInHistory; error?: "unknown_replacement" | "wrong_objective" } {
  if (history.checkIns.some((c) => c.id === checkIn.id)) return { history };
  if (checkIn.supersedes) {
    const target = history.checkIns.find((c) => c.id === checkIn.supersedes);
    if (!target) return { history, error: "unknown_replacement" };
    if (target.objectiveId !== checkIn.objectiveId) return { history, error: "wrong_objective" };
  }
  return { history: { checkIns: [...history.checkIns, checkIn] } };
}

/** The check-ins that still stand: those no later check-in has replaced. */
export function currentCheckIns(history: CheckInHistory, objectiveId?: string): CheckIn[] {
  const replaced = new Set(history.checkIns.flatMap((c) => (c.supersedes ? [c.supersedes] : [])));
  return history.checkIns
    .filter((c) => !replaced.has(c.id) && (objectiveId === undefined || c.objectiveId === objectiveId))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

/** The most recent standing check-in for an objective. */
export function latestFor(history: CheckInHistory, objectiveId: string): CheckIn | undefined {
  const list = currentCheckIns(history, objectiveId);
  return list[list.length - 1];
}

/** Full history for an objective, including replaced entries, oldest first. */
export function fullHistory(history: CheckInHistory, objectiveId: string): Array<CheckIn & { replaced: boolean }> {
  const replaced = new Set(history.checkIns.flatMap((c) => (c.supersedes ? [c.supersedes] : [])));
  return history.checkIns
    .filter((c) => c.objectiveId === objectiveId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map((c) => ({ ...c, replaced: replaced.has(c.id) }));
}

/** Objectives with no standing check-in for longer than `days`, so a reminder can be sent. */
export function overdueObjectives(history: CheckInHistory, objectiveIds: readonly string[], now: string, days = 14): string[] {
  const limit = Date.parse(now) - days * 86_400_000;
  return objectiveIds.filter((id) => {
    const last = latestFor(history, id);
    if (last?.status === "done") return false;
    return !last || Date.parse(last.createdAt) < limit;
  });
}

/** Confidence trend over standing check-ins: later minus earlier, or 0 with fewer than two. */
export function confidenceTrend(history: CheckInHistory, objectiveId: string): number {
  const list = currentCheckIns(history, objectiveId);
  if (list.length < 2) return 0;
  return (list[list.length - 1] as CheckIn).confidence - (list[0] as CheckIn).confidence;
}

/** Open blockers across the objectives' latest check-ins. */
export function openBlockers(history: CheckInHistory, objectiveIds: readonly string[]): Array<{ objectiveId: string; blockers: string[] }> {
  return objectiveIds.flatMap((id) => {
    const last = latestFor(history, id);
    return last && last.status === "blocked" ? [{ objectiveId: id, blockers: last.blockers }] : [];
  });
}
