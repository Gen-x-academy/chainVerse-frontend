/**
 * Team rematching workflow (CAPSTONE-048).
 *
 * When a team has a skill gap or a member is leaving, the team asks for a
 * rematch. A coordinator reviews the request, successors are invited, a
 * continuity plan is written, and the team and the successor both consent
 * before the successor joins. Every step is a stable state, and invalid or
 * out-of-order steps are refused with a code.
 */

export type RematchStatus = "requested" | "in_review" | "approved" | "successor_invited" | "consented" | "completed" | "rejected" | "cancelled";

export type RematchReason = "skill_gap" | "member_departure" | "workload" | "conflict";

export interface ContinuityPlan {
  handoverNotes: string;
  /** Work items the departing member still owns and who covers them meanwhile. */
  coverage: Array<{ item: string; coveredBy: string }>;
  handoverBy: string;
}

export interface SuccessorInvite {
  userId: string;
  invitedAt: string;
  response?: "accepted" | "declined";
}

export interface RematchRequest {
  id: string;
  teamId: string;
  requestedBy: string;
  reason: RematchReason;
  /** Skills the team needs, for a skill gap. */
  neededSkills: string[];
  departingUserId?: string;
  status: RematchStatus;
  coordinatorId?: string;
  decisionNote?: string;
  plan?: ContinuityPlan;
  invites: SuccessorInvite[];
  teamConsented: boolean;
  completedWith?: string;
}

export type RematchError = "wrong_state" | "needs_reason_detail" | "needs_note" | "needs_plan" | "no_open_invite" | "already_invited" | "not_invited" | "needs_consent";

export type RematchResult = { ok: true; request: RematchRequest } | { ok: false; code: RematchError; message: string };

const MESSAGES: Record<RematchError, string> = {
  wrong_state: "This step is not available in the request's current state.",
  needs_reason_detail: "Say which skills are missing or who is leaving.",
  needs_note: "Add a short note explaining the decision.",
  needs_plan: "Write the continuity plan first.",
  no_open_invite: "Invite at least one successor first.",
  already_invited: "This person has already been invited.",
  not_invited: "This person was not invited.",
  needs_consent: "Both the team and the successor must consent.",
};

const fail = (code: RematchError): RematchResult => ({ ok: false, code, message: MESSAGES[code] });
const ok = (request: RematchRequest): RematchResult => ({ ok: true, request });

const TRANSITIONS: Record<RematchStatus, RematchStatus[]> = {
  requested: ["in_review", "cancelled"],
  in_review: ["approved", "rejected", "cancelled"],
  approved: ["successor_invited", "cancelled"],
  successor_invited: ["consented", "cancelled"],
  consented: ["completed", "cancelled"],
  completed: [],
  rejected: [],
  cancelled: [],
};

export function canMove(from: RematchStatus, to: RematchStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function openRequest(input: { id: string; teamId: string; requestedBy: string; reason: RematchReason; neededSkills?: string[]; departingUserId?: string }): RematchResult {
  const needsSkills = input.reason === "skill_gap" && (input.neededSkills ?? []).length === 0;
  const needsDeparting = input.reason === "member_departure" && !input.departingUserId;
  if (needsSkills || needsDeparting) return fail("needs_reason_detail");
  return ok({
    id: input.id,
    teamId: input.teamId,
    requestedBy: input.requestedBy,
    reason: input.reason,
    neededSkills: input.neededSkills ?? [],
    ...(input.departingUserId ? { departingUserId: input.departingUserId } : {}),
    status: "requested",
    invites: [],
    teamConsented: false,
  });
}

export function startReview(req: RematchRequest, coordinatorId: string): RematchResult {
  if (!canMove(req.status, "in_review")) return fail("wrong_state");
  return ok({ ...req, status: "in_review", coordinatorId });
}

export function decide(req: RematchRequest, approve: boolean, note: string): RematchResult {
  if (!canMove(req.status, approve ? "approved" : "rejected")) return fail("wrong_state");
  if (note.trim().length === 0) return fail("needs_note");
  return ok({ ...req, status: approve ? "approved" : "rejected", decisionNote: note.trim() });
}

export function writePlan(req: RematchRequest, plan: ContinuityPlan): RematchResult {
  if (req.status === "completed" || req.status === "rejected" || req.status === "cancelled") return fail("wrong_state");
  if (plan.handoverNotes.trim().length === 0 || plan.handoverBy.trim().length === 0) return fail("needs_plan");
  return ok({ ...req, plan });
}

export function inviteSuccessor(req: RematchRequest, userId: string, invitedAt: string): RematchResult {
  if (req.status !== "approved" && req.status !== "successor_invited") return fail("wrong_state");
  if (req.invites.some((i) => i.userId === userId)) return fail("already_invited");
  return ok({ ...req, status: "successor_invited", invites: [...req.invites, { userId, invitedAt }] });
}

export function respondToInvite(req: RematchRequest, userId: string, response: "accepted" | "declined"): RematchResult {
  if (req.status !== "successor_invited") return fail("wrong_state");
  const invite = req.invites.find((i) => i.userId === userId);
  if (!invite) return fail("not_invited");
  if (invite.response !== undefined) return ok(req);
  return ok({ ...req, invites: req.invites.map((i) => (i === invite ? { ...i, response } : i)) });
}

/** The team agrees to the successor. Idempotent. */
export function recordTeamConsent(req: RematchRequest): RematchResult {
  if (req.status !== "successor_invited") return fail("wrong_state");
  return ok({ ...req, teamConsented: true });
}

/** Move to `consented` once the team and one successor have both said yes. */
export function confirmConsent(req: RematchRequest): RematchResult {
  if (!canMove(req.status, "consented")) return fail("wrong_state");
  if (req.invites.length === 0) return fail("no_open_invite");
  if (!req.teamConsented || !req.invites.some((i) => i.response === "accepted")) return fail("needs_consent");
  return ok({ ...req, status: "consented" });
}

/** Finish: the first accepted successor joins. Needs the plan. */
export function complete(req: RematchRequest): RematchResult {
  if (!canMove(req.status, "completed")) return fail("wrong_state");
  if (!req.plan) return fail("needs_plan");
  const chosen = req.invites.find((i) => i.response === "accepted");
  if (!chosen) return fail("needs_consent");
  return ok({ ...req, status: "completed", completedWith: chosen.userId });
}

export function cancel(req: RematchRequest): RematchResult {
  if (!canMove(req.status, "cancelled")) return fail("wrong_state");
  return ok({ ...req, status: "cancelled" });
}
