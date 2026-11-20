import { describe, expect, it } from "vitest";
import { STANDARD_ROLES, STANDARD_ROLE_KEYS, can, isStandardRole, responsibilitiesFor, scopesFor, validateAssignments, validateCustomRole, type ProjectRole } from "./project-roles";

const standard = Object.values(STANDARD_ROLES);
const custom = (over: Partial<ProjectRole> = {}): ProjectRole => ({ key: "mentor", name: "Mentor", standard: false, responsibilities: ["Advise the team"], scopes: ["project.read"], ...over });
const paths = (issues: { path: string }[]) => issues.map((i) => i.path);

describe("standard roles", () => {
  it("defines the seven standard roles", () => {
    expect(STANDARD_ROLE_KEYS).toHaveLength(7);
    expect(standard.every((r) => r.standard && r.responsibilities.length > 0 && r.scopes.length > 0)).toBe(true);
    expect(isStandardRole("lead")).toBe(true);
    expect(isStandardRole("mentor")).toBe(false);
  });

  it("only the lead manages the team", () => {
    expect(standard.filter((r) => r.scopes.includes("team.manage")).map((r) => r.key)).toEqual(["lead"]);
  });
});

describe("custom roles", () => {
  it("accepts a well formed custom role", () => {
    expect(validateCustomRole(custom())).toEqual([]);
  });

  it("rejects clashing keys, empty lists and repeated scopes", () => {
    expect(paths(validateCustomRole(custom({ key: "lead" })))).toEqual(["key"]);
    expect(paths(validateCustomRole(custom(), ["mentor"]))).toEqual(["key"]);
    expect(paths(validateCustomRole(custom({ name: " ", responsibilities: [], scopes: [] })))).toEqual(["name", "responsibilities", "scopes"]);
    expect(paths(validateCustomRole(custom({ scopes: ["project.read", "project.read"] })))).toEqual(["scopes"]);
  });

  it("will not grant team management", () => {
    expect(paths(validateCustomRole(custom({ scopes: ["team.manage"] })))).toEqual(["scopes"]);
  });
});

describe("assignments and permissions", () => {
  const roles = [...standard, custom()];

  it("needs exactly one lead and known roles", () => {
    expect(validateAssignments([{ userId: "u1", roleKeys: ["lead"] }, { userId: "u2", roleKeys: ["developer", "mentor"] }], roles)).toEqual([]);
    expect(paths(validateAssignments([{ userId: "u1", roleKeys: ["developer"] }], roles))).toEqual(["assignments"]);
    expect(paths(validateAssignments([{ userId: "u1", roleKeys: ["lead"] }, { userId: "u2", roleKeys: ["lead"] }], roles))).toEqual(["assignments"]);
    expect(paths(validateAssignments([{ userId: "u1", roleKeys: ["lead", "ghost"] }, { userId: "u2", roleKeys: [] }], roles))).toEqual(["assignments[0]", "assignments[1]"]);
  });

  it("denies by default and unions scopes across roles", () => {
    expect(can(undefined, "project.read", roles)).toBe(false);
    const dev = { userId: "u2", roleKeys: ["developer"] };
    expect(can(dev, "team.manage", roles)).toBe(false);
    const both = { userId: "u3", roleKeys: ["developer", "reviewer"] };
    expect(scopesFor(both, roles).has("deliverable.review")).toBe(true);
    expect(can(both, "deliverable.submit", roles)).toBe(true);
  });

  it("lists responsibilities once", () => {
    const list = responsibilitiesFor({ userId: "u1", roleKeys: ["writer", "writer", "analyst"] }, roles);
    expect(list).toEqual(["Draft reports and papers", "Check citations", "Analyse data", "Explain the results"]);
  });
});
