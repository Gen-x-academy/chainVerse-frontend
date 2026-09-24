export type GeographicRegion = 'africa' | 'asia' | 'europe' | 'north-america' | 'south-america' | 'oceania';
export type EnrollmentStatus = 'prospective' | 'current' | 'alumni';
export type IncomeBand = 'low' | 'middle' | 'upper';
export type RoleType = 'student' | 'mentor' | 'staff' | 'alumni';

export type ExclusionReasonCode =
  | 'MUTUALLY_EXCLUSIVE_SCHOLARSHIP'
  | 'PRIOR_AWARD_RESTRICTION'
  | 'PREREQUISITE_NOT_MET'
  | 'CONTRADICTORY_RULES';

export type EligibilityRuleType =
  | 'enrollment'
  | 'course'
  | 'grade'
  | 'geography'
  | 'incomeBand'
  | 'role'
  | 'age'
  | 'customAttestation'
  | 'prerequisite'
  | 'exclusion';

export type EligibilityRuleBase = {
  id: string;
  type: EligibilityRuleType;
  label: string;
  description: string;
  required: boolean;
  sensitiveEvidence?: boolean;
};

export type EnrollmentRule = EligibilityRuleBase & {
  type: 'enrollment';
  expectedStatus: EnrollmentStatus;
};

export type CourseRule = EligibilityRuleBase & {
  type: 'course';
  courseIds: string[];
  requiresActiveEnrollment?: boolean;
};

export type GradeRule = EligibilityRuleBase & {
  type: 'grade';
  metric: 'gpa' | 'percentage';
  minimum: number;
};

export type GeographyRule = EligibilityRuleBase & {
  type: 'geography';
  allowedRegions: GeographicRegion[];
};

export type IncomeBandRule = EligibilityRuleBase & {
  type: 'incomeBand';
  maxBand: IncomeBand;
};

export type RoleRule = EligibilityRuleBase & {
  type: 'role';
  allowedRoles: RoleType[];
};

export type AgeRule = EligibilityRuleBase & {
  type: 'age';
  minAge: number;
  maxAge?: number;
};

export type CustomAttestationRule = EligibilityRuleBase & {
  type: 'customAttestation';
  prompt: string;
  acceptedValues?: string[];
};

export type PrerequisiteRule = EligibilityRuleBase & {
  type: 'prerequisite';
  requiredAchievementIds: string[];
  prerequisiteRuleIds?: string[];
};

export type ExclusionRule = EligibilityRuleBase & {
  type: 'exclusion';
  reasonCode: ExclusionReasonCode;
  mutuallyExclusiveScholarshipIds?: string[];
  priorAwardIds?: string[];
};

export type EligibilityRule =
  | EnrollmentRule
  | CourseRule
  | GradeRule
  | GeographyRule
  | IncomeBandRule
  | RoleRule
  | AgeRule
  | CustomAttestationRule
  | PrerequisiteRule
  | ExclusionRule;

export type EligibilityRuleSet = {
  id: string;
  scholarshipId?: string;
  name: string;
  description: string;
  operator: 'all' | 'any';
  rules: EligibilityRule[];
  published: boolean;
  lastUpdated: string;
};

export type EligibilityApplicant = {
  enrollmentStatus?: EnrollmentStatus;
  courseIds?: string[];
  gradeValue?: number;
  gradeMetric?: 'gpa' | 'percentage';
  region?: GeographicRegion;
  incomeBand?: IncomeBand;
  role?: RoleType;
  age?: number;
  customAttestation?: string;
  completedAchievementIds?: string[];
  selectedScholarshipIds?: string[];
  priorAwardIds?: string[];
  evidencePermissionGranted?: boolean;
};

export type EligibilityDecision = {
  passed: boolean;
  evaluatedAt: string;
  matchedRules: string[];
  missingEvidence: string[];
  permissionRequired: string[];
  blockedBy: string[];
  exclusionReasons: ExclusionReasonCode[];
  decisionKey: string;
};

export type EligibilityValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};
