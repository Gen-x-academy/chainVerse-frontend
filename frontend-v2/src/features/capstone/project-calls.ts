/**
 * Capstone project calls (CAPSTONE-017).
 *
 * Authorized organization staff draft calls with theme, problem statement,
 * outcomes, eligibility, timeline, capacity, funding, owner and visibility.
 * Drafts can be saved incomplete; publishing requires a complete, consistent
 * call. Authorization is deny-by-default.
 */

export type CallVisibility = "private" | "organization" | "public";
export type CallActorRole = "student" | "tutor" | "supervisor" | "reviewer" | "sponsor" | "organization_staff" | "administrator";

/** Only these roles may create or edit calls. */
export const CALL_AUTHORS: readonly CallActorRole[] = ["organization_staff", "administrator"];

export interface CallTimeline {
  opensOn: string;
  closesOn: string;
  projectsStartOn: string;
  projectsEndOn: string;
}

export interface CallFunding {
  currency: string;
  /** Total pool in minor units (integer string). */
  totalMinor: string;
}

export interface CallDraft {
  id: string;
  organizationId: string;
  ownerId: string;
  theme: string;
  problemStatement: string;
  outcomes: string[];
  eligibility: string;
  timeline: Partial<CallTimeline>;
  capacity: number;
  funding?: CallFunding;
  visibility: CallVisibility;
  revision: number;
  status: "draft";
}

export type CreateCallResult =
  | { ok: true; call: CallDraft }
  | { ok: false; code: "FORBIDDEN" | "TENANT_MISMATCH" | "INVALID"; issues: CallIssue[] };

export interface CallIssue {
  field: string;
  message: string;
}

export interface CallActor {
  id: string;
  role: CallActorRole;
  organizationId: string;
}

export type CallInput = Partial<Omit<CallDraft, "id" | "revision" | "status" | "organizationId" | "ownerId">> & { organizationId: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Field-level checks that apply to a draft even when it is incomplete. */
export function validateDraftFields(input: CallInput): CallIssue[] {
  const issues: CallIssue[] = [];
  if (input.theme !== undefined && (input.theme.trim().length < 3 || input.theme.length > 120)) issues.push({ field: "theme", message: "theme must be 3-120 characters" });
  if (input.problemStatement !== undefined && input.problemStatement.length > 4000) issues.push({ field: "problemStatement", message: "problemStatement is too long (4000 characters max)" });
  if (input.outcomes !== undefined && (input.outcomes.length > 12 || input.outcomes.some((o) => !o.trim()))) issues.push({ field: "outcomes", message: "provide up to 12 non-empty outcomes" });
  if (input.capacity !== undefined && (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 500)) issues.push({ field: "capacity", message: "capacity must be a whole number from 1 to 500" });
  if (input.visibility !== undefined && !["private", "organization", "public"].includes(input.visibility)) issues.push({ field: "visibility", message: "unknown visibility" });
  for (const [key, value] of Object.entries(input.timeline ?? {})) {
    if (typeof value !== "string" || !DATE.test(value)) issues.push({ field: `timeline.${key}`, message: "must be YYYY-MM-DD" });
  }
  if (input.funding) {
    if (!/^[A-Z]{3,5}$/.test(input.funding.currency)) issues.push({ field: "funding.currency", message: "currency must be an uppercase code" });
    if (!/^(0|[1-9][0-9]*)$/.test(input.funding.totalMinor)) issues.push({ field: "funding.totalMinor", message: "totalMinor must be an integer string" });
  }
  return issues;
}

/** Creates a draft. The actor must be an authorized role in the same organization. */
export function createCallDraft(actor: CallActor, input: CallInput, newId: () => string): CreateCallResult {
  if (!CALL_AUTHORS.includes(actor.role)) return { ok: false, code: "FORBIDDEN", issues: [] };
  if (actor.role !== "administrator" && actor.organizationId !== input.organizationId) return { ok: false, code: "TENANT_MISMATCH", issues: [] };

  const issues = validateDraftFields(input);
  if (issues.length > 0) return { ok: false, code: "INVALID", issues };

  return {
    ok: true,
    call: {
      id: newId(),
      organizationId: input.organizationId,
      ownerId: actor.id,
      theme: input.theme?.trim() ?? "",
      problemStatement: input.problemStatement?.trim() ?? "",
      outcomes: (input.outcomes ?? []).map((o) => o.trim()),
      eligibility: input.eligibility?.trim() ?? "",
      timeline: input.timeline ?? {},
      capacity: input.capacity ?? 0,
      ...(input.funding ? { funding: input.funding } : {}),
      visibility: input.visibility ?? "private",
      revision: 1,
      status: "draft",
    },
  };
}

/** Everything that must be true before a call can be published. */
export function validateForPublish(call: CallDraft): CallIssue[] {
  const issues = validateDraftFields(call);
  const need = (cond: boolean, field: string, message: string) => cond || issues.push({ field, message });
  need(call.theme.length >= 3, "theme", "theme is required");
  need(call.problemStatement.trim().length >= 20, "problemStatement", "describe the problem (at least 20 characters)");
  need(call.outcomes.length >= 1, "outcomes", "add at least one expected outcome");
  need(call.eligibility.trim().length > 0, "eligibility", "state who is eligible");
  need(call.capacity >= 1, "capacity", "set a capacity of at least 1");
  need(call.funding !== undefined, "funding", "funding is required");

  const t = call.timeline;
  for (const key of ["opensOn", "closesOn", "projectsStartOn", "projectsEndOn"] as const) need(t[key] !== undefined, `timeline.${key}`, "required");
  if (t.opensOn && t.closesOn && t.projectsStartOn && t.projectsEndOn) {
    need(t.opensOn < t.closesOn, "timeline.closesOn", "the call must close after it opens");
    need(t.closesOn <= t.projectsStartOn, "timeline.projectsStartOn", "projects cannot start before the call closes");
    need(t.projectsStartOn < t.projectsEndOn, "timeline.projectsEndOn", "projects must end after they start");
  }
  return issues;
}
