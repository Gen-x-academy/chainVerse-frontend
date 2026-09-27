/**
 * Types and interfaces for Application Answers Validation and Word Limits.
 *
 * Enforces required fields, types, option sets, lengths, dates,
 * normalized rich text, and canonical safe field paths.
 */

export type FieldType =
  | 'text'
  | 'rich_text'
  | 'number'
  | 'currency'
  | 'date'
  | 'boolean'
  | 'single_select'
  | 'multi_select';

export interface FieldOption {
  value: string;
  label: string;
  description?: string;
}

export interface ApplicationFieldSchema {
  id: string; // Unique field key, alphanumeric + underscores only
  label: string;
  description?: string;
  helpText?: string;
  placeholder?: string;
  type: FieldType;
  required: boolean;
  minLength?: number;
  maxLength?: number;
  minWords?: number;
  maxWords?: number;
  min?: number;
  max?: number;
  minDate?: string; // ISO date 'YYYY-MM-DD'
  maxDate?: string; // ISO date 'YYYY-MM-DD'
  options?: FieldOption[]; // Required for single_select and multi_select
  defaultValue?: ApplicationAnswerValue;
}

export interface ApplicationFormSchema {
  id: string;
  roundId: string;
  programId: string;
  title: string;
  description: string;
  fields: ApplicationFieldSchema[];
  version: string;
}

export type ApplicationAnswerValue =
  | string
  | number
  | boolean
  | string[]
  | null
  | undefined;

export type ApplicationAnswersMap = Record<string, ApplicationAnswerValue>;

export type ValidationErrorCode =
  | 'REQUIRED_FIELD_MISSING'
  | 'INVALID_TYPE'
  | 'MIN_LENGTH_NOT_MET'
  | 'MAX_LENGTH_EXCEEDED'
  | 'MIN_WORDS_NOT_MET'
  | 'WORD_LIMIT_EXCEEDED'
  | 'MIN_VALUE_NOT_MET'
  | 'MAX_VALUE_EXCEEDED'
  | 'INVALID_DATE_FORMAT'
  | 'DATE_OUT_OF_RANGE'
  | 'INVALID_OPTION'
  | 'MALFORMED_CONTENT';

export interface FieldValidationError {
  fieldId: string;
  fieldPath: string; // Canonical safe path, e.g. "answers.personalStatement"
  code: ValidationErrorCode;
  message: string;
  safeValue?: unknown;
}

export interface FormValidationResult {
  valid: boolean;
  errors: FieldValidationError[];
  errorMap: Record<string, FieldValidationError>;
  normalizedAnswers: ApplicationAnswersMap;
  wordCounts: Record<string, number>;
}

export interface SubmitAnswersPayload {
  roundId: string;
  studentId: string;
  answers: ApplicationAnswersMap;
  clientValidated: boolean;
}

export interface SubmitAnswersResponse {
  ok: boolean;
  applicationId: string;
  submissionId: string;
  submittedAt: string;
  validationResult: FormValidationResult;
}
