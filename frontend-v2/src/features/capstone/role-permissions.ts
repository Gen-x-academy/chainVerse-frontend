/**
 * Capstone role and permission matrix (CAPSTONE-002).
 *
 * Least-privilege actions for students, tutors, supervisors, reviewers,
 * sponsors, organization staff, ethics officers, finance staff and
 * administrators. Authorization is deny-by-default: an action is allowed only
 * when the role's grant names it, the tenant boundary holds, and any scope
 * condition (own record, assigned record) is satisfied.
 */

export const ROLES = ["student", "tutor", "supervisor", "reviewer", "sponsor", "organization_staff", "ethics_officer", "finance_staff", "administrator"] as const;
export type Role = (typeof ROLES)[number];

export const ACTIONS = [
  "call.view_public",
  "call.create",
  "call.publish",
  "proposal.create",
  "proposal.view",
  "proposal.review",
  "proposal.decide",
  "project.view",
  "project.update",
  "milestone.submit",
  "milestone.accept",
  "funding.view",
  "funding.approve",
  "funding.disburse",
  "ethics.review",
  "publication.publish",
  "audit.view",
  "user.manage_roles",
] as const;
export type Action = (typeof ACTIONS)[number];

/** Which records a grant covers. */
export type Scope = "any" | "own" | "assigned" | "organization";

export const PERMISSIONS: Readonly<Record<Role, Partial<Record<Action, Scope>>>> = {
  student: { "call.view_public": "any", "proposal.create": "own", "proposal.view": "own", "project.view": "own", "milestone.submit": "own" },
  tutor: { "call.view_public": "any", "proposal.view": "assigned", "project.view": "assigned" },
  supervisor: { "call.view_public": "any", "proposal.view": "assigned", "proposal.decide": "assigned", "project.view": "assigned", "project.update": "assigned", "milestone.accept": "assigned", "publication.publish": "assigned" },
  reviewer: { "call.view_public": "any", "proposal.view": "assigned", "proposal.review": "assigned", "project.view": "assigned" },
  sponsor: { "call.view_public": "any", "project.view": "own", "funding.view": "own" },
  organization_staff: { "call.view_public": "any", "call.create": "organization", "call.publish": "organization", "proposal.view": "organization", "project.view": "organization", "audit.view": "organization" },
  ethics_officer: { "call.view_public": "any", "proposal.view": "assigned", "ethics.review": "assigned", "project.view": "assigned" },
  finance_staff: { "call.view_public": "any", "funding.view": "organization", "funding.approve": "organization", "funding.disburse": "organization", "project.view": "assigned" },
  administrator: { "call.view_public": "any", "call.create": "any", "call.publish": "any", "project.view": "any", "audit.view": "any", "user.manage_roles": "any" },
};

/** Actions a role may never perform, even if a future grant lists them (separation of duties). */
export const FORBIDDEN: Readonly<Partial<Record<Role, readonly Action[]>>> = {
  student: ["proposal.decide", "funding.approve", "funding.disburse", "user.manage_roles"],
  reviewer: ["funding.approve", "funding.disburse", "proposal.decide"],
  finance_staff: ["proposal.decide", "proposal.review", "ethics.review"],
  administrator: ["proposal.decide", "proposal.review", "funding.approve", "funding.disburse"],
  sponsor: ["proposal.view", "proposal.review", "proposal.decide"],
};

export interface Actor {
  id: string;
  role: Role;
  organizationId: string;
}

export interface Resource {
  organizationId: string;
  ownerId?: string;
  /** Ids of users assigned to this record (supervisor, reviewers, ...). */
  assignedIds?: readonly string[];
}

export type Decision = { allowed: true } | { allowed: false; reason: "UNKNOWN_ROLE" | "UNKNOWN_ACTION" | "NOT_GRANTED" | "FORBIDDEN_FOR_ROLE" | "TENANT_MISMATCH" | "NOT_OWNER" | "NOT_ASSIGNED" };

export function authorize(actor: Actor, action: Action, resource?: Resource): Decision {
  if (!(ROLES as readonly string[]).includes(actor.role)) return { allowed: false, reason: "UNKNOWN_ROLE" };
  if (!(ACTIONS as readonly string[]).includes(action)) return { allowed: false, reason: "UNKNOWN_ACTION" };
  if (FORBIDDEN[actor.role]?.includes(action)) return { allowed: false, reason: "FORBIDDEN_FOR_ROLE" };

  const scope = PERMISSIONS[actor.role][action];
  if (scope === undefined) return { allowed: false, reason: "NOT_GRANTED" };

  // Public content has no resource; everything else is checked against one.
  if (action === "call.view_public") return { allowed: true };
  if (!resource) return { allowed: false, reason: "NOT_GRANTED" };

  // Tenant boundary: everything but a platform administrator stays inside its own organization.
  if (actor.role !== "administrator" && actor.organizationId !== resource.organizationId) return { allowed: false, reason: "TENANT_MISMATCH" };

  switch (scope) {
    case "any":
    case "organization":
      return { allowed: true };
    case "own":
      return resource.ownerId === actor.id ? { allowed: true } : { allowed: false, reason: "NOT_OWNER" };
    case "assigned":
      return resource.assignedIds?.includes(actor.id) ? { allowed: true } : { allowed: false, reason: "NOT_ASSIGNED" };
  }
}

/** Actions a role could perform in principle (ignoring record scope), minus forbidden ones. */
export function actionsFor(role: Role): Action[] {
  return (Object.keys(PERMISSIONS[role]) as Action[]).filter((a) => !FORBIDDEN[role]?.includes(a)).sort();
}

/** Whether navigation entries for an action should be shown at all. */
export function showsNavigation(role: Role, action: Action): boolean {
  return actionsFor(role).includes(action);
}
