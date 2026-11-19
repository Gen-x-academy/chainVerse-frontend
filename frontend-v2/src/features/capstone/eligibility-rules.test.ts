import { describe, expect, it } from "vitest";
import { evaluateEligibility, validateRule, type ApplicantFacts, type Rule } from "./eligibility-rules";

const ok: ApplicantFacts = {
  enrolled: true,
  courseProgress: 0.8,
  completedCourses: ["CS101", "MATH200"],
  skills: ["Python", "Statistics"],
  organizationId: "org1",
  country: "ng",
  age: 21,
};
const codes = (rule: Rule, facts: ApplicantFacts) => evaluateEligibility(rule, facts).failures.map((f) => f.code);

describe("eligibility rules", () => {
  it("evaluates each rule type", () => {
    expect(evaluateEligibility({ type: "enrollment", required: true }, ok).eligible).toBe(true);
    expect(codes({ type: "enrollment", required: true }, { ...ok, enrolled: false })).toEqual(["NOT_ENROLLED"]);
    expect(codes({ type: "courseProgress", minFraction: 0.75 }, ok)).toEqual([]);
    expect(codes({ type: "courseProgress", minFraction: 0.9 }, ok)).toEqual(["PROGRESS_TOO_LOW"]);
    expect(codes({ type: "skills", allOf: ["python", "SQL"] }, ok)).toEqual(["MISSING_SKILL"]);
    expect(codes({ type: "skills", anyOf: ["SQL", "statistics"] }, ok)).toEqual([]);
    expect(codes({ type: "organization", allowed: ["org2"] }, ok)).toEqual(["ORGANIZATION_NOT_ALLOWED"]);
    expect(codes({ type: "geography", allow: ["NG", "GH"] }, ok)).toEqual([]);
    expect(codes({ type: "geography", deny: ["NG"] }, ok)).toEqual(["REGION_NOT_ALLOWED"]);
    expect(codes({ type: "geography", allow: ["KE"] }, ok)).toEqual(["REGION_NOT_ALLOWED"]);
    expect(codes({ type: "prerequisites", courses: ["cs101", "CS201"] }, ok)).toEqual(["PREREQUISITE_MISSING"]);
  });

  it("applies the guardian policy only below the age threshold", () => {
    const rule: Rule = { type: "guardian", belowAge: 18 };
    expect(codes(rule, { ...ok, age: 17 })).toEqual(["GUARDIAN_CONSENT_REQUIRED"]);
    expect(codes(rule, { ...ok, age: 17, guardianConsent: true })).toEqual([]);
    expect(codes(rule, { ...ok, age: 18 })).toEqual([]);
  });

  it("composes with all, any and not, returning every unmet requirement", () => {
    const rule: Rule = {
      type: "all",
      rules: [
        { type: "enrollment", required: true },
        { type: "courseProgress", minFraction: 0.9 },
        { type: "prerequisites", courses: ["CS999"] },
      ],
    };
    expect(codes(rule, ok)).toEqual(["PROGRESS_TOO_LOW", "PREREQUISITE_MISSING"]);

    const any: Rule = { type: "any", rules: [{ type: "organization", allowed: ["x"] }, { type: "skills", allOf: ["python"] }] };
    expect(evaluateEligibility(any, ok).eligible).toBe(true);
    const none = evaluateEligibility({ type: "any", rules: [{ type: "organization", allowed: ["x"] }, { type: "geography", deny: ["NG"] }] }, ok);
    expect(none.eligible).toBe(false);
    expect(none.failures[0].code).toBe("NO_ALTERNATIVE_MET");

    expect(codes({ type: "not", rule: { type: "organization", allowed: ["org1"] } }, ok)).toEqual(["EXCLUDED"]);
    expect(codes({ type: "not", rule: { type: "organization", allowed: ["org9"] } }, ok)).toEqual([]);
  });

  it("denies by default when a needed fact is unknown", () => {
    const r = evaluateEligibility({ type: "all", rules: [{ type: "enrollment", required: true }, { type: "geography", allow: ["NG"] }] }, {});
    expect(r.eligible).toBe(false);
    expect(r.failures.map((f) => f.code)).toEqual(["UNKNOWN_FACT", "UNKNOWN_FACT"]);
    expect(codes({ type: "any", rules: [] }, ok)).toEqual(["NO_ALTERNATIVE_MET"]);
  });

  it("validates stored rules structurally", () => {
    const good: Rule = { type: "all", rules: [{ type: "enrollment", required: true }, { type: "not", rule: { type: "geography", deny: ["XX"] } }] };
    expect(validateRule(good)).toEqual([]);
    expect(validateRule({ type: "mystery" })[0].message).toMatch(/unknown rule type/);
    expect(validateRule({ type: "all", rules: [] })).toHaveLength(1);
    expect(validateRule({ type: "all", rules: [{ type: "courseProgress", minFraction: 2 }] })[0].path).toBe("rule.rules[0]");
    expect(validateRule(null)).toHaveLength(1);
    let deep: unknown = { type: "enrollment", required: true };
    for (let i = 0; i < 12; i += 1) deep = { type: "not", rule: deep };
    expect(validateRule(deep).some((i) => /too deeply/.test(i.message))).toBe(true);
  });
});
