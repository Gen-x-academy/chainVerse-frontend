/**
 * Template domain logic (issue #1142).
 *
 * The functions below are pure so the validation, publication, rollback and
 * redaction rules can be unit tested without HTTP. `templateService` is the
 * thin transport layer on `/scholarships/templates`.
 */

import { apiClient } from '@/src/lib/api-client';
import type {
  ChannelLimit,
  DeliveryRecord,
  RenderedTemplate,
  TemplateChannel,
  TemplateValidationError,
  TemplateVariable,
  TemplateVersion,
  ValidationResult,
} from './types';

const TEMPLATES_PATH = '/scholarships/templates';

const TOKEN_PATTERN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;
const OPEN_TOKEN_PATTERN = /\{\{/;

export const CHANNEL_LIMITS: Record<TemplateChannel, ChannelLimit> = {
  'in-app': { channel: 'in-app', bodyMax: 4000, subjectMax: 120, requiresSubject: false },
  email: { channel: 'email', bodyMax: 20000, subjectMax: 120, requiresSubject: true },
  sms: { channel: 'sms', bodyMax: 480, subjectMax: 0, requiresSubject: false },
  push: { channel: 'push', bodyMax: 140, subjectMax: 90, requiresSubject: true },
};

export function channelLimitFor(channel: TemplateChannel): ChannelLimit {
  return CHANNEL_LIMITS[channel];
}

export type TemplateDraft = Pick<TemplateVersion, 'channel' | 'body'> & {
  subject?: string;
};

/** True when the copy exceeds the channel's hard limit. */
export function isChannelOverLimit(channel: TemplateChannel, draft: TemplateDraft): boolean {
  const limit = CHANNEL_LIMITS[channel];
  if (draft.body.length > limit.bodyMax) return true;
  if (limit.requiresSubject && !draft.subject?.trim()) return true;
  if (limit.subjectMax > 0 && (draft.subject?.length ?? 0) > limit.subjectMax) return true;
  return false;
}

/** Every distinct `{{name}}` token in the body, in first-appearance order. */
export function extractVariables(body: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const match of body.matchAll(TOKEN_PATTERN)) {
    const name = match[1];
    if (!name || seen.has(name)) continue;
    seen.add(name);
    found.push(name);
  }
  return found;
}

/** Tokens the body opens but never closes, e.g. `{{applicantName`. */
function unclosedTokens(body: string): string[] {
  const opens: number[] = [];
  for (let index = 0; index < body.length; index += 1) {
    if (body.startsWith('{{', index)) {
      opens.push(index);
      index += 1;
    } else if (body.startsWith('}}', index)) {
      opens.pop();
      index += 1;
    }
  }
  return opens
    .map((index) => body.slice(index).split(OPEN_TOKEN_PATTERN).join('').split(/[\n}]/)[0].trim())
    .filter((token) => token.length > 0);
}

export function validateTemplate(version: TemplateVersion): ValidationResult {
  const errors: TemplateValidationError[] = [];
  const declared = new Set(version.variables.map((variable) => variable.name));
  const used = extractVariables(version.body);
  const subjectUsed = version.subject ? extractVariables(version.subject) : [];
  const allUsed = [...used, ...subjectUsed.filter((name) => !used.includes(name))];

  const unknownVariables = allUsed.filter((name) => !declared.has(name));
  const missingVariables = version.variables
    .filter((variable) => variable.required)
    .filter((variable) => !allUsed.includes(variable.name))
    .map((variable) => variable.name);

  if (version.body.trim().length === 0) {
    errors.push({ code: 'EMPTY_BODY', message: 'Template body cannot be empty.' });
  }

  for (const token of unclosedTokens(version.body)) {
    errors.push({
      code: 'UNCLOSED_TOKEN',
      message: `Unclosed token "${token}" is missing a closing "}}" delimiter.`,
      token,
    });
  }

  for (const name of unknownVariables) {
    errors.push({
      code: 'UNKNOWN_VARIABLE',
      message: `"${name}" is used in the copy but is not declared as a template variable.`,
      token: name,
    });
  }

  for (const name of missingVariables) {
    errors.push({
      code: 'MISSING_VARIABLE',
      message: `"${name}" is declared as required but never appears in the copy.`,
      token: name,
    });
  }

  if (isChannelOverLimit(version.channel, { channel: version.channel, body: version.body, subject: version.subject })) {
    const limit = CHANNEL_LIMITS[version.channel];
    errors.push({
      code: 'CHANNEL_LIMIT',
      message:
        limit.requiresSubject && !version.subject?.trim()
          ? `The ${version.channel} channel requires a subject of at most ${limit.subjectMax} characters.`
          : `The ${version.channel} channel allows at most ${limit.bodyMax} characters of copy.`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    unknownVariables: [...new Set(unknownVariables)],
    missingVariables,
  };
}

/** Publication is only ever allowed from a clean validation. */
export function canPublish(validation: ValidationResult): boolean {
  return validation.valid && validation.errors.length === 0;
}

function substitute(text: string, version: TemplateVersion, values: Record<string, string>, maskPii: boolean): string {
  return text.replace(TOKEN_PATTERN, (_match, name: string) => {
    const variable = version.variables.find((candidate) => candidate.name === name);
    const value = values[name] ?? '';
    if (variable?.pii && maskPii) return '[redacted]';
    return value;
  });
}

/** Example values for a preview; PII variables are masked by default. */
export function sampleValuesFor(version: TemplateVersion): Record<string, string> {
  return Object.fromEntries(
    version.variables.map((variable) => [variable.name, variable.pii ? '[redacted]' : variable.example])
  );
}

export function sensitiveValues(version: TemplateVersion, values: Record<string, string>): string[] {
  return version.variables
    .filter((variable) => variable.pii)
    .map((variable) => values[variable.name] ?? '')
    .filter((value) => value.length > 0);
}

/**
 * Substitutes every declared token. Throws when the copy references a variable
 * that is not declared, or when a required variable has no value — a partially
 * rendered message must never be delivered.
 */
export function renderTemplate(
  version: TemplateVersion,
  values: Record<string, string>,
  options: { maskPii?: boolean } = {}
): RenderedTemplate {
  const validation = validateTemplate(version);
  const undeclared = new Set<string>();
  for (const name of [...extractVariables(version.body), ...(version.subject ? extractVariables(version.subject) : [])]) {
    if (!version.variables.some((variable) => variable.name === name)) undeclared.add(name);
  }

  if (undeclared.size > 0) {
    throw new Error(`Cannot render ${version.templateKey}: undeclared variable(s): ${[...undeclared].join(', ')}.`);
  }

  if (validation.errors.some((error) => error.code === 'UNCLOSED_TOKEN')) {
    throw new Error(`Cannot render ${version.templateKey}: the copy contains an unclosed token.`);
  }

  const missing = version.variables
    .filter((variable) => variable.required)
    .filter((variable) => {
      const used = extractVariables(`${version.body} ${version.subject ?? ''}`);
      return used.includes(variable.name) && (values[variable.name] == null || values[variable.name] === '');
    })
    .map((variable) => variable.name);

  if (missing.length > 0) {
    throw new Error(`Cannot render ${version.templateKey}: missing required value(s): ${missing.join(', ')}.`);
  }

  const maskPii = options.maskPii ?? false;
  return {
    templateKey: version.templateKey,
    version: version.version,
    channel: version.channel,
    locale: version.locale,
    subject: version.subject ? substitute(version.subject, version, values, maskPii) : undefined,
    renderedBody: substitute(version.body, version, values, maskPii),
  };
}

/** Replaces known sensitive values so the body is safe to log. */
export function redactForLog(rendered: RenderedTemplate, sensitive: string[] = []): string {
  let output = rendered.renderedBody;
  for (const value of sensitive) {
    if (!value) continue;
    output = output.split(value).join('[redacted]');
  }
  return output;
}

export type PublishResult = {
  published: TemplateVersion;
  versions: TemplateVersion[];
};

/**
 * Publishes a validated draft. The version number is never renumbered, the
 * previously published version of the same key moves to `rolled-back`, and a
 * named approver is mandatory.
 */
export function publishTemplate(
  draft: TemplateVersion,
  versions: TemplateVersion[],
  approver: string,
  at: string = new Date().toISOString()
): PublishResult {
  if (!approver.trim()) {
    throw new Error('Publication requires a named approver.');
  }

  const validation = validateTemplate(draft);
  if (!canPublish(validation)) {
    const summary = validation.errors.map((error) => error.message).join(' ');
    throw new Error(`Publication blocked: ${summary}`);
  }

  const published: TemplateVersion = {
    ...draft,
    status: 'published',
    approvedBy: approver.trim(),
    approvedAt: at,
    publishedAt: at,
  };

  const next = versions.map((version) =>
    version.id === published.id
      ? published
      : version.templateKey === published.templateKey && version.status === 'published'
        ? { ...version, status: 'rolled-back' as const }
        : version
  );

  if (!next.some((version) => version.id === published.id)) {
    next.push(published);
  }

  return { published, versions: next };
}

/** Re-points the live template at an earlier version of the same key. */
export function rollbackTemplate(
  templateKey: string,
  toVersion: number,
  versions: TemplateVersion[],
  at: string = new Date().toISOString()
): TemplateVersion[] {
  const target = versions.find(
    (version) => version.templateKey === templateKey && version.version === toVersion
  );
  if (!target) {
    throw new Error(`Rollback failed: ${templateKey} has no version ${toVersion}.`);
  }

  return versions.map((version) => {
    if (version.templateKey !== templateKey) return version;
    if (version.id === target.id) {
      return { ...version, status: 'published' as const, publishedAt: at };
    }
    if (version.status === 'published') {
      return { ...version, status: 'rolled-back' as const };
    }
    return version;
  });
}

/** Approval / publication history for a template key, newest first. */
export function approvalHistory(versions: TemplateVersion[], templateKey: string): TemplateVersion[] {
  return versions
    .filter((version) => version.templateKey === templateKey)
    .filter((version) => version.approvedBy || version.publishedAt)
    .sort((left, right) => right.version - left.version);
}

export function buildDeliveryRecord(input: {
  id: string;
  template: TemplateVersion;
  values: Record<string, string>;
  recipientRef: string;
  deliveredAt: string;
}): DeliveryRecord {
  const rendered = renderTemplate(input.template, input.values);
  return {
    id: input.id,
    templateKey: input.template.templateKey,
    templateVersion: input.template.version,
    channel: input.template.channel,
    recipientRef: input.recipientRef,
    deliveredAt: input.deliveredAt,
    redactedLog: redactForLog(rendered, sensitiveValues(input.template, input.values)),
  };
}

export type SaveTemplateInput = {
  template: TemplateVersion;
  /** Optimistic concurrency token: the version the editor loaded. */
  expectedVersion?: number;
  idempotencyKey: string;
};

export type RunAuditInput = {
  criteria: string[];
  idempotencyKey: string;
};

const TEMPLATE_SERVICES = {
  list: (): Promise<TemplateVersion[]> => apiClient.get<TemplateVersion[]>(TEMPLATES_PATH),
  history: (templateKey: string): Promise<TemplateVersion[]> =>
    apiClient.get<TemplateVersion[]>(`${TEMPLATES_PATH}/${encodeURIComponent(templateKey)}/versions`),
  save: (input: SaveTemplateInput): Promise<TemplateVersion> =>
    apiClient.post<TemplateVersion>(TEMPLATES_PATH, input),
  publish: (input: SaveTemplateInput & { approver: string }): Promise<TemplateVersion> =>
    apiClient.post<TemplateVersion>(`${TEMPLATES_PATH}/publish`, input),
  rollback: (input: { templateKey: string; toVersion: number; idempotencyKey: string }): Promise<TemplateVersion> =>
    apiClient.post<TemplateVersion>(`${TEMPLATES_PATH}/rollback`, input),
  deliveries: (templateKey: string): Promise<DeliveryRecord[]> =>
    apiClient.get<DeliveryRecord[]>(`${TEMPLATES_PATH}/${encodeURIComponent(templateKey)}/deliveries`),
};

export const templateService = {
  listTemplates: TEMPLATE_SERVICES.list,
  getTemplateHistory: TEMPLATE_SERVICES.history,
  saveTemplate: TEMPLATE_SERVICES.save,
  publishTemplate: TEMPLATE_SERVICES.publish,
  rollbackTemplate: TEMPLATE_SERVICES.rollback,
  listDeliveries: TEMPLATE_SERVICES.deliveries,
};
