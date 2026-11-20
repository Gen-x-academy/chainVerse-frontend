/**
 * Project roles and responsibilities (CAPSTONE-044).
 *
 * Models the standard roles (lead, researcher, developer, designer, analyst,
 * writer, reviewer) and custom roles. Each role lists its responsibilities and
 * permission scopes. Permissions are deny by default: a member can only do
 * what one of their roles grants.
 */

export const PERMISSION_SCOPES = ["project.read", "project.edit", "team.manage", "milestone.edit", "deliverable.submit", "deliverable.review", "budget.view", "budget.manage", "charter.accept"] as const;
export type PermissionScope = (typeof PERMISSION_SCOPES)[number];

export const STANDARD_ROLE_KEYS = ["lead", "researcher", "developer", "designer", "analyst", "writer", "reviewer"] as const;
export type StandardRoleKey = (typeof STANDARD_ROLE_KEYS)[number];

export interface ProjectRole {
  key: string;
  name: string;
  standard: boolean;
  responsibilities: string[];
  scopes: PermissionScope[];
}

export interface RoleIssue {
  path: string;
  message: string;
}

const BASE: PermissionScope[] = ["project.read", "deliverable.submit", "charter.accept"];

export const STANDARD_ROLES: Readonly<Record<StandardRoleKey, ProjectRole>> = {
  lead: { key: "lead", name: "Lead", standard: true, responsibilities: ["Coordinate the team", "Own the plan and milestones", "Speak for the project"], scopes: [...BASE, "project.edit", "team.manage", "milestone.edit", "budget.view", "budget.manage"] },
  researcher: { key: "researcher", name: "Researcher", standard: true, responsibilities: ["Run the research", "Record methods and findings"], scopes: [...BASE, "milestone.edit"] },
  developer: { key: "developer", name: "Developer", standard: true, responsibilities: ["Build and test the software", "Document the build"], scopes: [...BASE] },
  designer: { key: "designer", name: "Designer", standard: true, responsibilities: ["Design the experience", "Keep it accessible"], scopes: [...BASE] },
  analyst: { key: "analyst", name: "Analyst", standard: true, responsibilities: ["Analyse data", "Explain the results"], scopes: [...BASE, "budget.view"] },
  writer: { key: "writer", name: "Writer", standard: true, responsibilities: ["Draft reports and papers", "Check citations"], scopes: [...BASE] },
  reviewer: { key: "reviewer", name: "Reviewer", standard: true, responsibilities: ["Review deliverables", "Give written feedback"], scopes: ["project.read", "deliverable.review"] },
};

export function isStandardRole(key: string): key is StandardRoleKey {
  return (STANDARD_ROLE_KEYS as readonly string[]).includes(key);
}

/** Problems with a custom role, or an empty list when valid. */
export function validateCustomRole(role: ProjectRole, existingKeys: readonly string[] = []): RoleIssue[] {
  const issues: RoleIssue[] = [];
  const bad = (path: string, message: string) => issues.push({ path, message });
  if (!/^[a-z][a-z0-9_-]{1,31}$/.test(role.key)) bad("key", "use 2 to 32 lowercase letters, digits, - or _, starting with a letter");
  if (isStandardRole(role.key) || existingKeys.includes(role.key)) bad("key", "this role key is already used");
  if (role.standard) bad("standard", "custom roles cannot be marked standard");
  if (role.name.trim().length === 0) bad("name", "give the role a name");
  if (role.responsibilities.length === 0 || role.responsibilities.some((r) => r.trim().length === 0)) bad("responsibilities", "list at least one responsibility");
  if (role.scopes.length === 0) bad("scopes", "choose at least one permission");
  if (new Set(role.scopes).size !== role.scopes.length) bad("scopes", "permissions must not repeat");
  for (const s of role.scopes) if (!(PERMISSION_SCOPES as readonly string[]).includes(s)) bad("scopes", `unknown permission "${s}"`);
  // A custom role may not quietly grant team control; that stays with the lead.
  if (role.scopes.includes("team.manage")) bad("scopes", "only the lead role can manage the team");
  return issues;
}

export interface RoleAssignment {
  userId: string;
  roleKeys: string[];
}

/** Problems with who holds which role: unknown roles and the one-lead rule. */
export function validateAssignments(assignments: readonly RoleAssignment[], roles: readonly ProjectRole[]): RoleIssue[] {
  const issues: RoleIssue[] = [];
  const known = new Set(roles.map((r) => r.key));
  assignments.forEach((a, i) => {
    if (a.roleKeys.length === 0) issues.push({ path: `assignments[${i}]`, message: "every member needs at least one role" });
    for (const k of a.roleKeys) if (!known.has(k)) issues.push({ path: `assignments[${i}]`, message: `role "${k}" was not found` });
  });
  const leads = assignments.filter((a) => a.roleKeys.includes("lead")).length;
  if (leads !== 1) issues.push({ path: "assignments", message: leads === 0 ? "the project needs a lead" : "the project can have only one lead" });
  return issues;
}

/** The scopes a member holds across all their roles. */
export function scopesFor(assignment: RoleAssignment | undefined, roles: readonly ProjectRole[]): Set<PermissionScope> {
  const result = new Set<PermissionScope>();
  if (!assignment) return result;
  for (const role of roles) if (assignment.roleKeys.includes(role.key)) for (const s of role.scopes) result.add(s);
  return result;
}

export function can(assignment: RoleAssignment | undefined, scope: PermissionScope, roles: readonly ProjectRole[]): boolean {
  return scopesFor(assignment, roles).has(scope);
}

/** The responsibilities a member carries, without duplicates. */
export function responsibilitiesFor(assignment: RoleAssignment, roles: readonly ProjectRole[]): string[] {
  return [...new Set(roles.filter((r) => assignment.roleKeys.includes(r.key)).flatMap((r) => r.responsibilities))];
}
