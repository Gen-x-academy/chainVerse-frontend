/**
 * Types and interfaces for Configurable Application Forms.
 *
 * Supports composing versioned sections and fields for:
 * - statements: essay prompts, study plans, and technical vision with word limits
 * - questions: customized fields with typed validations and options
 * - consents: mandatory and optional legal disclosures, FERPA/GDPR data sharing
 * - references: academic or professional referee contact and recommendation letters
 * - evidence: verified documents (transcripts, tax records, portfolios, identity)
 *
 * Implements acceptance criteria:
 * 1. Published schemas are immutable (cannot be mutated; updates require a new version).
 * 2. Conditional logic is validated (no cycles, no forward references, valid targets).
 * 3. Answers remain tied to the accepted form version and schema hash.
 */

export type FormFieldKind = 'statement' | 'question' | 'consent' | 'reference' | 'evidence';

export type FieldPrimitiveType =
  | 'text'
  | 'rich_text'
  | 'number'
  | 'currency'
  | 'date'
  | 'boolean'
  | 'single_select'
  | 'multi_select';

export type ConditionalOperator =
  | 'equals'
  | 'not_equals'
  | 'in'
  | 'not_in'
  | 'greater_than'
  | 'less_than'
  | 'is_checked';

export interface FieldCondition {
  targetFieldId: string;
  operator: ConditionalOperator;
  value: unknown;
}

export interface StatementConfig {
  prompt: string;
  minWords?: number;
  maxWords?: number;
  guidelines?: string;
  richTextEnabled?: boolean;
}

export interface QuestionConfig {
  helpText?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string; description?: string }>;
  min?: number;
  max?: number;
  minDate?: string;
  maxDate?: string;
}

export interface ConsentConfig {
  consentKind: string; // e.g. "sponsorDisclosure", "terms", "dataSharing"
  legalNoticeText: string;
  requiredAffirmative: boolean;
  policyUrl?: string;
  version: string;
}

export interface ReferenceConfig {
  minReferees: number;
  maxReferees: number;
  requireInstitutionalEmail: boolean;
  allowRecommendationUpload: boolean;
  relationshipTypes: string[];
}

export interface EvidenceConfig {
  documentCategory: string; // e.g. "transcript", "enrollmentVerification", "taxReturn"
  allowedExtensions: string[];
  maxSizeBytes: number;
  requiredOriginalScan: boolean;
  guidanceText?: string;
}

export interface ConfigurableFormField {
  id: string; // Unique alphanumeric + underscore
  sectionId: string;
  kind: FormFieldKind;
  type: FieldPrimitiveType;
  label: string;
  description?: string;
  required: boolean;
  order: number;
  conditional?: FieldCondition;
  statementConfig?: StatementConfig;
  questionConfig?: QuestionConfig;
  consentConfig?: ConsentConfig;
  referenceConfig?: ReferenceConfig;
  evidenceConfig?: EvidenceConfig;
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  order: number;
  conditional?: FieldCondition;
  fields: ConfigurableFormField[];
}

export type FormSchemaStatus = 'draft' | 'published' | 'archived';

export interface ConfigurableFormSchema {
  id: string;
  programId: string;
  roundId: string;
  version: string; // Semver format: "1.0.0"
  status: FormSchemaStatus;
  title: string;
  description?: string;
  sections: FormSection[];
  schemaHash: string; // Cryptographic SHA/content digest
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
  publishedAt?: string; // ISO-8601 when status becomes 'published'
  publishedBy?: string;
}

export interface FormVersionBinding {
  schemaId: string;
  version: string;
  schemaHash: string;
  answers: Record<string, unknown>;
  submittedAt?: string;
  verified: boolean;
}

export interface ConditionalValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  dependencyMap: Record<string, string[]>; // fieldId -> targetFieldIds
}

export interface CreateDraftSchemaPayload {
  programId: string;
  roundId: string;
  title: string;
  description?: string;
  sections?: FormSection[];
}

export interface UpdateDraftSchemaPayload {
  title?: string;
  description?: string;
  sections?: FormSection[];
}

export interface ForkSchemaPayload {
  incrementType: 'patch' | 'minor' | 'major';
  title?: string;
  actor: string;
}
