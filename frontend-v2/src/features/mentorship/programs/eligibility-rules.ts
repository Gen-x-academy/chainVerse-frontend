/** MENTOR-018: define program eligibility rules as data, evaluated deterministically. */
export type RuleField = 'country' | 'age' | 'experienceYears' | 'roleTrack' | 'hasPortfolio';
export type RuleOperator = 'eq' | 'neq' | 'gte' | 'lte' | 'in';

export interface EligibilityRuleDef {
  id: string;
  field: RuleField;
  operator: RuleOperator;
  value: string | number | boolean | string[];
  /** Message shown to applicants who fail this rule. */
  message: string;
}

export type ApplicantFacts = Partial<Record<RuleField, string | number | boolean>>;

const NUMERIC: RuleField[] = ['age', 'experienceYears'];

export function validateRuleDef(r: EligibilityRuleDef): string[] {
  const errors: string[] = [];
  if (!r.message.trim()) errors.push(`${r.id}: message is required`);
  if ((r.operator === 'gte' || r.operator === 'lte') && !NUMERIC.includes(r.field)) errors.push(`${r.id}: ${r.operator} only applies to numeric fields`);
  if (r.operator === 'in' && !Array.isArray(r.value)) errors.push(`${r.id}: "in" needs a list`);
  if (r.operator !== 'in' && Array.isArray(r.value)) errors.push(`${r.id}: only "in" accepts a list`);
  return errors;
}

export function evaluateRule(r: EligibilityRuleDef, facts: ApplicantFacts): boolean {
  const v = facts[r.field];
  if (v === undefined) return false; // unknown facts never pass
  switch (r.operator) {
    case 'eq':
      return v === r.value;
    case 'neq':
      return v !== r.value;
    case 'gte':
      return typeof v === 'number' && typeof r.value === 'number' && v >= r.value;
    case 'lte':
      return typeof v === 'number' && typeof r.value === 'number' && v <= r.value;
    case 'in':
      return Array.isArray(r.value) && r.value.includes(String(v));
  }
}

/** All rules must pass. Returns the messages of failing rules, in rule order. */
export function checkEligibility(rules: EligibilityRuleDef[], facts: ApplicantFacts): { eligible: boolean; failures: string[] } {
  const failures = rules.filter((r) => !evaluateRule(r, facts)).map((r) => r.message);
  return { eligible: failures.length === 0, failures };
}
