import type {
  EligibilityApplicant,
  EligibilityDecision,
  EligibilityRule,
  EligibilityRuleSet,
  EligibilityValidationResult,
  IncomeBand,
} from './types';

const incomeOrder: Record<IncomeBand, number> = {
  low: 1,
  middle: 2,
  upper: 3,
};

function evaluateRule(rule: EligibilityRule, applicant: EligibilityApplicant): boolean {
  switch (rule.type) {
    case 'enrollment':
      return applicant.enrollmentStatus === rule.expectedStatus;
    case 'course': {
      const courseIds = applicant.courseIds ?? [];
      return rule.courseIds.some((courseId) => courseIds.includes(courseId));
    }
    case 'grade': {
      if (applicant.gradeValue == null) return false;
      if (rule.metric === 'gpa') return applicant.gradeValue >= rule.minimum;
      return applicant.gradeValue >= rule.minimum;
    }
    case 'geography':
      return !!applicant.region && rule.allowedRegions.includes(applicant.region);
    case 'incomeBand': {
      const currentBand = applicant.incomeBand ?? 'upper';
      return incomeOrder[currentBand] <= incomeOrder[rule.maxBand];
    }
    case 'role':
      return !!applicant.role && rule.allowedRoles.includes(applicant.role);
    case 'age':
      if (applicant.age == null) return false;
      if (applicant.age < rule.minAge) return false;
      if (rule.maxAge != null && applicant.age > rule.maxAge) return false;
      return true;
    case 'customAttestation': {
      if (!applicant.customAttestation) return false;
      const normalizedValue = applicant.customAttestation.trim().toLowerCase();
      if (!rule.acceptedValues || rule.acceptedValues.length === 0) {
        return normalizedValue.length > 0;
      }
      return rule.acceptedValues.some((value) => value.toLowerCase() === normalizedValue);
    }
    case 'prerequisite': {
      const completedAchievements = new Set(applicant.completedAchievementIds ?? []);
      return rule.requiredAchievementIds.every((achievementId) => completedAchievements.has(achievementId));
    }
    case 'exclusion': {
      const selectedScholarships = new Set(applicant.selectedScholarshipIds ?? []);
      const priorAwards = new Set(applicant.priorAwardIds ?? []);
      const hasScholarshipConflict = (rule.mutuallyExclusiveScholarshipIds ?? [])
        .some((scholarshipId) => selectedScholarships.has(scholarshipId));
      const hasPriorAwardConflict = (rule.priorAwardIds ?? [])
        .some((awardId) => priorAwards.has(awardId));
      return !hasScholarshipConflict && !hasPriorAwardConflict;
    }
    default:
      return false;
  }
}

function stableDecisionKey(ruleSet: EligibilityRuleSet, applicant: EligibilityApplicant): string {
  return JSON.stringify({
    ruleSetId: ruleSet.id,
    ruleIds: ruleSet.rules.map((rule) => rule.id),
    applicant: {
      age: applicant.age,
      completedAchievementIds: [...(applicant.completedAchievementIds ?? [])].sort(),
      courseIds: [...(applicant.courseIds ?? [])].sort(),
      customAttestation: applicant.customAttestation?.trim().toLowerCase(),
      enrollmentStatus: applicant.enrollmentStatus,
      gradeMetric: applicant.gradeMetric,
      gradeValue: applicant.gradeValue,
      incomeBand: applicant.incomeBand,
      priorAwardIds: [...(applicant.priorAwardIds ?? [])].sort(),
      region: applicant.region,
      role: applicant.role,
      selectedScholarshipIds: [...(applicant.selectedScholarshipIds ?? [])].sort(),
    },
  });
}

export function validateRuleSet(ruleSet: EligibilityRuleSet): EligibilityValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!ruleSet.name.trim()) {
    errors.push('Rule set name is required before publication.');
  }

  if (ruleSet.rules.length === 0) {
    errors.push('At least one eligibility rule is required.');
  }

  const seenIds = new Set<string>();
  const rulesById = new Map(ruleSet.rules.map((rule) => [rule.id, rule]));
  for (const rule of ruleSet.rules) {
    if (!rule.id.trim()) {
      errors.push('Every rule requires a stable identifier.');
      continue;
    }
    if (seenIds.has(rule.id)) {
      errors.push(`Duplicate rule id detected: ${rule.id}`);
    }
    seenIds.add(rule.id);

    if (rule.type === 'course' && rule.courseIds.length === 0) {
      errors.push(`Course rule "${rule.label}" requires at least one course reference.`);
    }

    if (rule.type === 'grade' && (rule.minimum < 0 || rule.minimum > 100)) {
      errors.push(`Grade rule "${rule.label}" minimum must be between 0 and 100.`);
    }

    if (rule.type === 'age' && rule.minAge < 0) {
      errors.push(`Age rule "${rule.label}" minimum age cannot be negative.`);
    }

    if (rule.type === 'customAttestation' && !rule.prompt.trim()) {
      errors.push(`Custom attestation rule "${rule.label}" is missing the prompt.`);
    }

    if (rule.type === 'prerequisite') {
      if (rule.requiredAchievementIds.length === 0) {
        errors.push(`Prerequisite rule "${rule.label}" requires at least one achievement.`);
      }
      if (rule.requiredAchievementIds.some((achievementId) => !achievementId.trim())) {
        errors.push(`Prerequisite rule "${rule.label}" contains an empty achievement id.`);
      }
      for (const prerequisiteRuleId of rule.prerequisiteRuleIds ?? []) {
        if (!rulesById.has(prerequisiteRuleId)) {
          errors.push(`Prerequisite rule "${rule.label}" references an unknown rule: ${prerequisiteRuleId}`);
        }
      }
    }

    if (rule.type === 'exclusion') {
      if (rule.reasonCode === 'MUTUALLY_EXCLUSIVE_SCHOLARSHIP' && (rule.mutuallyExclusiveScholarshipIds?.length ?? 0) === 0) {
        errors.push(`Exclusion rule "${rule.label}" requires a scholarship reference.`);
      }
      if (rule.reasonCode === 'PRIOR_AWARD_RESTRICTION' && (rule.priorAwardIds?.length ?? 0) === 0) {
        errors.push(`Exclusion rule "${rule.label}" requires a prior award reference.`);
      }
      if (ruleSet.scholarshipId && rule.mutuallyExclusiveScholarshipIds?.includes(ruleSet.scholarshipId)) {
        errors.push(`Exclusion rule "${rule.label}" contradicts the scholarship it belongs to.`);
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (ruleId: string): void => {
    if (visiting.has(ruleId)) {
      errors.push(`Prerequisite cycle detected at rule id: ${ruleId}`);
      return;
    }
    if (visited.has(ruleId)) return;
    visiting.add(ruleId);
    const rule = rulesById.get(ruleId);
    if (rule?.type === 'prerequisite') {
      for (const prerequisiteRuleId of rule.prerequisiteRuleIds ?? []) visit(prerequisiteRuleId);
    }
    visiting.delete(ruleId);
    visited.add(ruleId);
  };
  for (const rule of ruleSet.rules) visit(rule.id);

  if (ruleSet.published && errors.length > 0) {
    warnings.push('This rule set cannot be published while validation errors remain.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function evaluateEligibility(
  ruleSet: EligibilityRuleSet,
  applicant: EligibilityApplicant
): EligibilityDecision {
  const matchedRules: string[] = [];
  const missingEvidence: string[] = [];
  const permissionRequired: string[] = [];
  const blockedBy: string[] = [];
  const exclusionReasons: EligibilityDecision['exclusionReasons'] = [];
  const ruleMatches = new Map<string, boolean>();

  for (const rule of ruleSet.rules) {
    ruleMatches.set(rule.id, evaluateRule(rule, applicant));
  }

  const resolveMatch = (rule: EligibilityRule, resolving = new Set<string>()): boolean => {
    if (rule.type !== 'prerequisite') return ruleMatches.get(rule.id) ?? false;
    if (resolving.has(rule.id)) return false;
    resolving.add(rule.id);
    const dependenciesMet = (rule.prerequisiteRuleIds ?? []).every((ruleId) => {
      const dependency = ruleSet.rules.find((candidate) => candidate.id === ruleId);
      return dependency ? resolveMatch(dependency, resolving) : false;
    });
    resolving.delete(rule.id);
    return (ruleMatches.get(rule.id) ?? false) && dependenciesMet;
  };

  for (const rule of ruleSet.rules) {
    const hasValueForRule = (() => {
      switch (rule.type) {
        case 'enrollment':
          return applicant.enrollmentStatus != null;
        case 'course':
          return (applicant.courseIds?.length ?? 0) > 0;
        case 'grade':
          return applicant.gradeValue != null;
        case 'geography':
          return applicant.region != null;
        case 'incomeBand':
          return applicant.incomeBand != null;
        case 'role':
          return applicant.role != null;
        case 'age':
          return applicant.age != null;
        case 'customAttestation':
          return applicant.customAttestation != null;
        case 'prerequisite':
          return applicant.completedAchievementIds != null;
        case 'exclusion':
          return applicant.selectedScholarshipIds != null || applicant.priorAwardIds != null;
        default:
          return false;
      }
    })();

    if (!hasValueForRule) {
      missingEvidence.push(rule.label);
      if (rule.sensitiveEvidence) {
        permissionRequired.push(rule.label);
      }
      continue;
    }

    const isMatch = resolveMatch(rule);
    if (isMatch) {
      matchedRules.push(rule.label);
    } else {
      blockedBy.push(rule.label);
      if (rule.type === 'exclusion') exclusionReasons.push(rule.reasonCode);
      if (rule.type === 'prerequisite') exclusionReasons.push('PREREQUISITE_NOT_MET');
    }

    if (rule.sensitiveEvidence && !applicant.evidencePermissionGranted) {
      permissionRequired.push(rule.label);
    }
  }

  const result = exclusionReasons.length === 0 && (ruleSet.operator === 'all'
    ? ruleSet.rules.length > 0 && blockedBy.length === 0 && missingEvidence.length === 0
    : matchedRules.length > 0 && missingEvidence.length === 0);

  return {
    passed: result,
    evaluatedAt: new Date().toISOString(),
    matchedRules,
    missingEvidence,
    permissionRequired,
    blockedBy,
    exclusionReasons: [...new Set(exclusionReasons)],
    decisionKey: stableDecisionKey(ruleSet, applicant),
  };
}
