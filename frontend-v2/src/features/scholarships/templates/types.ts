/**
 * Versioned communication templates (issue #1142).
 *
 * Every outbound scholarship communication (award confirmation, disbursement
 * notice, review outcome, deadline reminder) is authored once, versioned, and
 * rendered from an explicit variable contract. Publication is blocked until
 * validation passes and an approver is recorded, and any variable flagged
 * `pii: true` is redacted from logs and previews.
 */

export type TemplateChannel = 'in-app' | 'email' | 'sms' | 'push';

export type TemplateVariable = {
  /** Token name as it appears inside `{{ }}`. */
  name: string;
  required: boolean;
  example: string;
  /** When true the value must never appear in a log line or a preview. */
  pii: boolean;
};

export type TemplateStatus =
  | 'draft'
  | 'in-review'
  | 'approved'
  | 'published'
  | 'rolled-back';

export type TemplateVersion = {
  id: string;
  templateKey: string;
  /** Monotonic per templateKey. Publication never renumbers a version. */
  version: number;
  channel: TemplateChannel;
  locale: string;
  subject?: string;
  body: string;
  variables: TemplateVariable[];
  status: TemplateStatus;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  publishedAt?: string;
};

export type TemplateValidationErrorCode =
  | 'UNKNOWN_VARIABLE'
  | 'MISSING_VARIABLE'
  | 'UNCLOSED_TOKEN'
  | 'CHANNEL_LIMIT'
  | 'EMPTY_BODY';

export type TemplateValidationError = {
  code: TemplateValidationErrorCode;
  message: string;
  token?: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: TemplateValidationError[];
  unknownVariables: string[];
  missingVariables: string[];
};

export type RenderedTemplate = {
  templateKey: string;
  version: number;
  channel: TemplateChannel;
  locale: string;
  subject?: string;
  renderedBody: string;
  deliveredAt?: string;
};

export type DeliveryRecord = {
  id: string;
  templateKey: string;
  /** The exact version that produced the message, so audit is reproducible. */
  templateVersion: number;
  channel: TemplateChannel;
  /** Opaque recipient reference — never an email address or a student name. */
  recipientRef: string;
  deliveredAt: string;
  /** Body with every PII variable substituted out. Safe to log. */
  redactedLog: string;
};

/** Hard channel limits enforced at publication time. */
export type ChannelLimit = {
  channel: TemplateChannel;
  bodyMax: number;
  subjectMax: number;
  requiresSubject: boolean;
};
