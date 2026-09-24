import { apiClient } from '@/src/lib/api-client';
import type {
  EligibilityApplicant,
  EligibilityDecision,
  EligibilityRuleSet,
  EligibilityValidationResult,
} from './types';

export const scholarshipFallbackRules: EligibilityRuleSet[] = [
  {
    id: 'scholarship-standard',
    scholarshipId: 'scholarship-standard',
    name: 'Scholarship eligibility',
    description: 'Default rules for funded learning support.',
    operator: 'all',
    published: false,
    lastUpdated: new Date().toISOString(),
    rules: [
      {
        id: 'enrollment-status',
        type: 'enrollment',
        label: 'Enrollment status',
        description: 'Applicants must be actively enrolled.',
        required: true,
        expectedStatus: 'current',
      },
      {
        id: 'course-match',
        type: 'course',
        label: 'Course fit',
        description: 'Must select a funded course track.',
        required: true,
        courseIds: ['intro-to-blockchain', 'defi-101'],
      },
      {
        id: 'grade-floor',
        type: 'grade',
        label: 'Academic performance',
        description: 'Minimum grade threshold.',
        required: true,
        metric: 'percentage',
        minimum: 70,
      },
      {
        id: 'region-allowlist',
        type: 'geography',
        label: 'Country eligibility',
        description: 'Eligible regions are limited to the scholarship footprint.',
        required: true,
        sensitiveEvidence: false,
        allowedRegions: ['africa', 'asia'],
      },
      {
        id: 'income-band',
        type: 'incomeBand',
        label: 'Income band',
        description: 'Applicants should be in the lower income band.',
        required: true,
        sensitiveEvidence: true,
        maxBand: 'middle',
      },
      {
        id: 'custom-attestation',
        type: 'customAttestation',
        label: 'Eligibility attestation',
        description: 'Applicant must confirm their status.',
        required: true,
        sensitiveEvidence: true,
        prompt: 'I confirm that the details above are accurate and complete.',
        acceptedValues: ['yes', 'true', 'confirmed'],
      },
      {
        id: 'foundation-achievement',
        type: 'prerequisite',
        label: 'Foundation achievement',
        description: 'Applicants must complete the blockchain foundations achievement.',
        required: true,
        requiredAchievementIds: ['blockchain-foundations'],
      },
      {
        id: 'prior-award-exclusion',
        type: 'exclusion',
        label: 'Prior award restriction',
        description: 'Applicants who already received this award cannot apply again.',
        required: true,
        sensitiveEvidence: true,
        reasonCode: 'PRIOR_AWARD_RESTRICTION',
        priorAwardIds: ['scholarship-standard'],
      },
      {
        id: 'mutually-exclusive-scholarship',
        type: 'exclusion',
        label: 'Mutually exclusive scholarship',
        description: 'Applicants cannot hold the career switch scholarship at the same time.',
        required: true,
        reasonCode: 'MUTUALLY_EXCLUSIVE_SCHOLARSHIP',
        mutuallyExclusiveScholarshipIds: ['career-switch'],
      },
    ],
  },
];

export const scholarshipService = {
  listRules: async (): Promise<EligibilityRuleSet[]> =>
    apiClient.get<EligibilityRuleSet[]>('/scholarships/eligibility-rules'),

  validateRuleSet: async (ruleSet: EligibilityRuleSet): Promise<EligibilityValidationResult> =>
    apiClient.post<EligibilityValidationResult>('/scholarships/eligibility-rules/validate', ruleSet),

  evaluate: async (
    ruleSet: EligibilityRuleSet,
    applicant: EligibilityApplicant
  ): Promise<EligibilityDecision> =>
    apiClient.post<EligibilityDecision>('/scholarships/eligibility/evaluate', {
      ruleSet,
      applicant,
    }),
};
