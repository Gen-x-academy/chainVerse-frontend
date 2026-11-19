/**
 * Capstone and research bounded contexts (CAPSTONE-001).
 *
 * The canonical entities, identifier kinds, ownership boundaries, lifecycle
 * states and invariants for calls, projects, teams, milestones, reviews,
 * funding, outputs and publications. The catalog is data; `checkInvariants`
 * verifies a snapshot of related records against the rules, returning every
 * violation with a stable code so services and tests share one definition.
 */

export type ContextName = "calls" | "projects" | "teams" | "milestones" | "reviews" | "funding" | "outputs" | "publications";

export interface ContextDefinition {
  name: ContextName;
  entity: string;
  /** Prefix of the public identifier, e.g. `cal`. */
  idPrefix: string;
  /** Who owns (may change) records in this context. */
  owner: string;
  /** Contexts this one references by id only, never by embedding their data. */
  references: ContextName[];
  states: readonly string[];
  /** Fields that must never leave the owning context in events or public views. */
  private: readonly string[];
}

export const CONTEXTS: Readonly<Record<ContextName, ContextDefinition>> = {
  calls: { name: "calls", entity: "Call", idPrefix: "cal", owner: "organization staff", references: [], states: ["draft", "published", "sunset", "archived"], private: ["internalNotes", "reviewerIds"] },
  projects: { name: "projects", entity: "Project", idPrefix: "prj", owner: "supervisor and team", references: ["calls", "teams"], states: ["draft", "proposed", "screening", "approved", "recruiting", "active", "paused", "under-review", "completed", "published", "cancelled", "disputed", "archived"], private: ["proposalText", "risks"] },
  teams: { name: "teams", entity: "Team", idPrefix: "tem", owner: "team lead", references: ["projects"], states: ["forming", "active", "disbanded"], private: ["memberContacts"] },
  milestones: { name: "milestones", entity: "Milestone", idPrefix: "mil", owner: "supervisor", references: ["projects"], states: ["planned", "in_progress", "submitted", "accepted", "rejected"], private: ["submissionContent"] },
  reviews: { name: "reviews", entity: "Review", idPrefix: "rev", owner: "reviewer", references: ["projects", "milestones"], states: ["assigned", "in_progress", "submitted", "withdrawn"], private: ["reviewerIdentity", "comments"] },
  funding: { name: "funding", entity: "FundingAward", idPrefix: "fnd", owner: "finance staff", references: ["calls", "projects"], states: ["pledged", "awarded", "disbursing", "closed", "revoked"], private: ["bankDetails", "amountBreakdown"] },
  outputs: { name: "outputs", entity: "Output", idPrefix: "out", owner: "team", references: ["projects", "milestones"], states: ["draft", "submitted", "accepted"], private: ["files"] },
  publications: { name: "publications", entity: "Publication", idPrefix: "pub", owner: "supervisor and team", references: ["projects", "outputs"], states: ["draft", "under_review", "published", "retracted"], private: ["embargoedContent"] },
};

export const CONTEXT_NAMES = Object.keys(CONTEXTS) as ContextName[];

/** Records are linked by public id only; an id's prefix tells which context it belongs to. */
export function contextOfId(id: string): ContextName | null {
  const prefix = /^([a-z]{3})_[0-9A-HJKMNP-TV-Z]{16}$/.exec(id)?.[1];
  return CONTEXT_NAMES.find((n) => CONTEXTS[n].idPrefix === prefix) ?? null;
}

export function isReferenceAllowed(from: ContextName, to: ContextName): boolean {
  return CONTEXTS[from].references.includes(to);
}

export interface Snapshot {
  call: { id: string; state: string; fundingTotalMinor: string; teamSizeMin: number; teamSizeMax: number };
  project: { id: string; callId: string; state: string; startsOn: string; endsOn: string; supervisorId: string };
  team: { id: string; projectId: string; memberIds: string[]; leadId: string };
  milestones: Array<{ id: string; projectId: string; dueOn: string; state: string }>;
  reviews: Array<{ id: string; projectId: string; reviewerId: string; state: string }>;
  funding: Array<{ id: string; projectId: string; amountMinor: string; state: string }>;
  outputs: Array<{ id: string; projectId: string; state: string }>;
  publications: Array<{ id: string; projectId: string; outputIds: string[]; state: string }>;
}

export interface Violation {
  invariant: string;
  message: string;
}

/** Verify the cross-context invariants for one project and its related records. */
export function checkInvariants(s: Snapshot): Violation[] {
  const v: Violation[] = [];
  const bad = (invariant: string, message: string) => v.push({ invariant, message });

  if (s.project.callId !== s.call.id) bad("PROJECT_BELONGS_TO_CALL", "a project belongs to exactly one call");
  if (s.team.projectId !== s.project.id) bad("TEAM_BELONGS_TO_PROJECT", "a team belongs to exactly one project");

  const members = new Set(s.team.memberIds);
  if (members.size !== s.team.memberIds.length) bad("TEAM_MEMBERS_UNIQUE", "a person can be on a team only once");
  if (!members.has(s.team.leadId)) bad("TEAM_LEAD_IS_MEMBER", "the team lead must be a team member");
  if (members.size < s.call.teamSizeMin || members.size > s.call.teamSizeMax) bad("TEAM_SIZE_WITHIN_CALL_LIMITS", "team size must be within the call's limits");
  if (members.has(s.project.supervisorId)) bad("SUPERVISOR_NOT_ON_TEAM", "the supervisor cannot also be a team member");

  if (!(s.project.startsOn < s.project.endsOn)) bad("PROJECT_WINDOW_ORDERED", "a project must end after it starts");
  for (const m of s.milestones) {
    if (m.projectId !== s.project.id) bad("MILESTONE_BELONGS_TO_PROJECT", `milestone ${m.id} belongs to another project`);
    if (m.dueOn < s.project.startsOn || m.dueOn > s.project.endsOn) bad("MILESTONE_INSIDE_PROJECT_WINDOW", `milestone ${m.id} falls outside the project window`);
  }

  for (const r of s.reviews) {
    if (r.projectId !== s.project.id) bad("REVIEW_BELONGS_TO_PROJECT", `review ${r.id} belongs to another project`);
    if (members.has(r.reviewerId) || r.reviewerId === s.project.supervisorId) bad("REVIEWER_INDEPENDENT", `review ${r.id} is by someone involved in the project`);
  }

  let awarded = 0n;
  for (const f of s.funding) {
    if (f.projectId !== s.project.id) bad("FUNDING_BELONGS_TO_PROJECT", `funding ${f.id} belongs to another project`);
    if (!/^(0|[1-9][0-9]*)$/.test(f.amountMinor)) bad("FUNDING_AMOUNT_VALID", `funding ${f.id} has an invalid amount`);
    else if (f.state !== "revoked") awarded += BigInt(f.amountMinor);
  }
  if (/^(0|[1-9][0-9]*)$/.test(s.call.fundingTotalMinor) && awarded > BigInt(s.call.fundingTotalMinor)) bad("FUNDING_WITHIN_CALL_TOTAL", "awards exceed the call's funding total");

  const outputIds = new Set(s.outputs.map((o) => o.id));
  for (const p of s.publications) {
    if (p.projectId !== s.project.id) bad("PUBLICATION_BELONGS_TO_PROJECT", `publication ${p.id} belongs to another project`);
    if (p.outputIds.some((id) => !outputIds.has(id))) bad("PUBLICATION_USES_PROJECT_OUTPUTS", `publication ${p.id} cites an output from another project`);
    if (p.state === "published" && !["completed", "published", "archived"].includes(s.project.state)) bad("PUBLISH_AFTER_COMPLETION", `publication ${p.id} cannot be published before the project is completed`);
  }
  if (["active", "completed", "published"].includes(s.project.state) && s.call.state === "draft") bad("ACTIVE_PROJECT_HAS_PUBLISHED_CALL", "a running project needs a call that was published");
  return v;
}
