import { describe, expect, it } from 'vitest';
import { evaluateEligibility, validateRuleSet } from '@/src/features/scholarships/rules';
import type { EligibilityApplicant, EligibilityRuleSet } from '@/src/features/scholarships/types';

const prerequisiteRuleSet: EligibilityRuleSet = {
  id: 'prerequisite-example',
  name: 'Prerequisite example',
  description: 'Rules used to verify required achievements.',
  operator: 'all',
  published: false,
  lastUpdated: '2026-09-24T00:00:00.000Z',
  rules: [
    {
      id: 'advanced-track',
      type: 'prerequisite',
      label: 'Advanced track prerequisite',
      description: 'Requires the foundation achievement.',
      required: true,
      requiredAchievementIds: ['foundation'],
      prerequisiteRuleIds: ['foundation-track'],
    },
    {
      id: 'foundation-track',
      type: 'prerequisite',
      label: 'Foundation track prerequisite',
      description: 'Requires the introduction achievement.',
      required: true,
      requiredAchievementIds: ['introduction'],
    },
  ],
};

const applicant: EligibilityApplicant = {
  completedAchievementIds: ['foundation', 'introduction'],
  selectedScholarshipIds: [],
  priorAwardIds: [],
};

describe('scholarship eligibility rules', () => {
  it('rejects prerequisite cycles before publication', () => {
    const cyclicRuleSet: EligibilityRuleSet = {
      ...prerequisiteRuleSet,
      rules: prerequisiteRuleSet.rules.map((rule) =>
        rule.id === 'foundation-track'
          ? { ...rule, prerequisiteRuleIds: ['advanced-track'] }
          : rule
      ),
    };

    const result = validateRuleSet(cyclicRuleSet);

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('Prerequisite cycle detected'))).toBe(true);
  });

  it('returns stable reason codes for prior awards', () => {
    const ruleSet: EligibilityRuleSet = {
      ...prerequisiteRuleSet,
      rules: [
        {
          id: 'prior-award',
          type: 'exclusion',
          label: 'Prior award restriction',
          description: 'Blocks applicants with the same prior award.',
          required: true,
          reasonCode: 'PRIOR_AWARD_RESTRICTION',
          priorAwardIds: ['award-1'],
        },
      ],
    };

    const result = evaluateEligibility(ruleSet, { ...applicant, priorAwardIds: ['award-1'] });

    expect(result.passed).toBe(false);
    expect(result.exclusionReasons).toEqual(['PRIOR_AWARD_RESTRICTION']);
  });

  it('produces the same decision key for the same normalized evidence', () => {
    const first = evaluateEligibility(prerequisiteRuleSet, applicant);
    const second = evaluateEligibility(prerequisiteRuleSet, {
      ...applicant,
      completedAchievementIds: ['introduction', 'foundation'],
    });

    expect(first.passed).toBe(true);
    expect(first.decisionKey).toBe(second.decisionKey);
  });
});
