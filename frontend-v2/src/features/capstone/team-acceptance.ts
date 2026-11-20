/**
 * Mutual team acceptance (CAPSTONE-043).
 *
 * A team becomes active only when every required member and the configured
 * number of supervisors have accepted the current terms, and supervision
 * capacity was reserved. Approvals against an older terms version do not
 * count. Recording the same approval twice changes nothing.
 */

export type ApproverRole = "member" | "supervisor";

export interface Approval {
  userId: string;
  role: ApproverRole;
  termsVersion: number;
  approvedAt: string;
}

export interface TeamAcceptance {
  teamId: string;
  requiredMemberIds: string[];
  requiredSupervisors: number;
  currentTermsVersion: number;
  approvals: Approval[];
  /** Supervisor slots held while acceptance is pending. */
  reservedSupervisorSlots: number;
  status: "pending" | "active" | "cancelled";
}

export type AcceptanceError = "not_required" | "stale_terms" | "not_pending";

export interface AcceptanceProgress {
  missingMembers: string[];
  supervisorsApproved: number;
  supervisorsMissing: number;
  staleApprovers: string[];
  ready: boolean;
}

/** Approvals that count: current terms only, one per person and role. */
export function currentApprovals(team: TeamAcceptance): Approval[] {
  const seen = new Set<string>();
  const result: Approval[] = [];
  for (const a of team.approvals) {
    const key = `${a.role}:${a.userId}`;
    if (a.termsVersion !== team.currentTermsVersion || seen.has(key)) continue;
    seen.add(key);
    result.push(a);
  }
  return result;
}

export function acceptanceProgress(team: TeamAcceptance): AcceptanceProgress {
  const current = currentApprovals(team);
  const memberIds = new Set(current.filter((a) => a.role === "member").map((a) => a.userId));
  const supervisorsApproved = current.filter((a) => a.role === "supervisor").length;
  const staleApprovers = [...new Set(team.approvals.filter((a) => a.termsVersion !== team.currentTermsVersion).map((a) => a.userId))].filter(
    (id) => !current.some((a) => a.userId === id),
  );
  const missingMembers = team.requiredMemberIds.filter((id) => !memberIds.has(id));
  const supervisorsMissing = Math.max(0, team.requiredSupervisors - supervisorsApproved);
  return { missingMembers, supervisorsApproved, supervisorsMissing, staleApprovers, ready: missingMembers.length === 0 && supervisorsMissing === 0 };
}

/** Add one approval. Replays are ignored; wrong people or old terms are refused. */
export function recordApproval(team: TeamAcceptance, approval: Approval): { team: TeamAcceptance; error?: AcceptanceError } {
  if (team.status !== "pending") return { team, error: "not_pending" };
  if (approval.termsVersion !== team.currentTermsVersion) return { team, error: "stale_terms" };
  if (approval.role === "member" && !team.requiredMemberIds.includes(approval.userId)) return { team, error: "not_required" };
  const duplicate = team.approvals.some((a) => a.userId === approval.userId && a.role === approval.role && a.termsVersion === approval.termsVersion);
  if (duplicate) return { team };
  return { team: { ...team, approvals: [...team.approvals, approval] } };
}

/** Activate once every approval is in and the supervisor slots are held. */
export function activateTeam(team: TeamAcceptance): { team: TeamAcceptance; blockers: string[] } {
  const blockers: string[] = [];
  if (team.status !== "pending") blockers.push(`the team is ${team.status}`);
  const progress = acceptanceProgress(team);
  if (progress.missingMembers.length > 0) blockers.push(`waiting for ${progress.missingMembers.length} member approval(s)`);
  if (progress.supervisorsMissing > 0) blockers.push(`waiting for ${progress.supervisorsMissing} supervisor approval(s)`);
  if (team.reservedSupervisorSlots < team.requiredSupervisors) blockers.push("supervisor capacity is not reserved");
  if (blockers.length > 0) return { team, blockers };
  return { team: { ...team, status: "active" }, blockers };
}

/** New terms invalidate earlier approvals; the version only moves forward. */
export function updateTerms(team: TeamAcceptance, version: number): TeamAcceptance {
  if (version <= team.currentTermsVersion) return team;
  return { ...team, currentTermsVersion: version };
}

/** Cancel a pending acceptance and release held capacity. */
export function cancelAcceptance(team: TeamAcceptance): TeamAcceptance {
  if (team.status !== "pending") return team;
  return { ...team, status: "cancelled", reservedSupervisorSlots: 0 };
}
