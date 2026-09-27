/**
 * Public program page publication (issue #1138).
 *
 * The publication pipeline is intentionally boring: a program is turned into a
 * page by *copying* only whitelisted fields, the page is refused outright for
 * `invitation-only` and `unpublished` programs, every publication bumps a
 * revision and records a stable checksum, and the indexable metadata is derived
 * from the already-redacted page rather than from the program.
 */

import { apiClient } from '@/src/lib/api-client';
import type {
  ProgramVisibility,
  PublicPageRevision,
  PublicProgramField,
  PublicProgramPage,
  PublicProgramSummary,
  PublicationRefusalReason,
  PublicationResult,
  PublishableProgram,
  PublishOptions,
} from './types';

export const PUBLIC_PAGES_PATH = '/scholarships/public';

export const DEFAULT_PUBLIC_BASE_URL = 'https://chainverse.example';

/**
 * The only program fields that may ever appear on a public page. Anything not
 * listed here is stripped before the page object exists.
 */
export const PUBLISHABLE_FIELD_KEYS = [
  'title',
  'summary',
  'description',
  'sponsorName',
  'currency',
  'awardAmountCents',
  'applicationDeadline',
  'eligibilitySummary',
] as const;

export type PublishableFieldKey = (typeof PUBLISHABLE_FIELD_KEYS)[number];

/** Program fields that must never reach a public page, indexed by name. */
export const PRIVATE_PROGRAM_FIELDS = [
  'internalNotes',
  'selectionCriteria',
  'applicantPool',
  'reviewPanel',
  'applicantNames',
  'applicantEmails',
] as const;

const FIELD_LABELS: Record<PublishableFieldKey, string> = {
  title: 'Program title',
  summary: 'Summary',
  description: 'Description',
  sponsorName: 'Sponsor',
  currency: 'Currency',
  awardAmountCents: 'Award amount',
  applicationDeadline: 'Application deadline',
  eligibilitySummary: 'Eligibility',
};

function isBlank(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

/** Renders a whitelisted program value as the string carried on the page. */
function fieldValue(program: PublishableProgram, key: PublishableFieldKey): string {
  if (key === 'eligibilitySummary') return program.eligibilitySummary.join('; ');
  if (key === 'awardAmountCents') {
    return Number.isFinite(program.awardAmountCents) && program.awardAmountCents > 0
      ? String(program.awardAmountCents)
      : '';
  }
  const raw = program[key];
  if (raw === undefined || raw === null) return '';
  return String(raw);
}

/**
 * The publishable fields that actually carry a value. Fields are dropped rather
 * than emitted-then-hidden, so a blank `description` is absent from the page
 * entirely.
 */
export function publishableFieldsFor(program: PublishableProgram): PublicProgramField[] {
  const fields: PublicProgramField[] = [];
  for (const key of PUBLISHABLE_FIELD_KEYS) {
    const value = fieldValue(program, key);
    if (isBlank(value)) continue;
    fields.push({ key, label: FIELD_LABELS[key], publishable: true, value });
  }
  return fields;
}

export function canonicalUrlFor(slug: string, baseUrl: string = DEFAULT_PUBLIC_BASE_URL): string {
  const base = baseUrl.trim().replace(/\/+$/, '');
  return `${base}${PUBLIC_PAGES_PATH}/${encodeURIComponent(slug)}`;
}

export function canPublish(program: PublishableProgram): {
  allowed: boolean;
  reason?: PublicationRefusalReason;
} {
  if (program.visibility === 'invitation-only') {
    return { allowed: false, reason: 'INVITATION_ONLY' };
  }
  if (program.visibility === 'unpublished') {
    return { allowed: false, reason: 'UNPUBLISHED' };
  }
  if (program.visibility !== 'public') {
    return { allowed: false, reason: 'NOT_PUBLISHED' };
  }
  if (publishableFieldsFor(program).length === 0) {
    return { allowed: false, reason: 'NO_PUBLISHABLE_FIELDS' };
  }
  return { allowed: true };
}

export function toPublicPage(
  program: PublishableProgram,
  slug: string,
  baseUrl: string = DEFAULT_PUBLIC_BASE_URL
): PublicProgramPage {
  const publishedFields = publishableFieldsFor(program);
  const value = (key: PublishableFieldKey): string => {
    const match = publishedFields.find((field) => field.key === key);
    return match ? match.value : '';
  };

  const page: PublicProgramPage = {
    slug,
    programId: program.programId,
    canonicalUrl: canonicalUrlFor(slug, baseUrl),
    title: value('title'),
    summary: value('summary'),
    description: value('description'),
    sponsorName: value('sponsorName'),
    currency: value('currency'),
    awardAmountCents: program.awardAmountCents,
    applicationDeadline: value('applicationDeadline'),
    eligibilitySummary: [...program.eligibilitySummary],
    publishedFields,
    visibility: program.visibility,
    revision: 1,
    updatedAt: program.updatedAt,
    structuredData: {},
  };

  return { ...page, structuredData: structuredDataFor(page) };
}

/** Indexable metadata, derived from the redacted page only. */
export function structuredDataFor(
  page: PublicProgramPage
): Record<string, string | number | boolean> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Scholarship',
    name: page.title,
    description: page.summary || page.description,
    url: page.canonicalUrl,
    deadline: page.applicationDeadline,
  };
}

/** The next revision number for a set of already published pages. */
export function nextRevision(pages: ReadonlyArray<{ revision: number }>): number {
  return pages.reduce((highest, page) => Math.max(highest, page.revision), 0) + 1;
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => key !== 'structuredData')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`).join(',')}}`;
}

/** FNV-1a: a short, stable, dependency-free content fingerprint. */
export function pageChecksum(page: PublicProgramPage): string {
  const input = stableSerialize(page);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a-${hash.toString(16).padStart(8, '0')}`;
}

export type PublishOutcome = {
  result: PublicationResult;
  revision?: PublicPageRevision;
};

export function publish(
  program: PublishableProgram,
  slug: string,
  options: PublishOptions,
  previous?: PublicProgramPage | null
): PublishOutcome {
  const gate = canPublish(program);
  if (!gate.allowed) {
    return { result: { status: 'refused', reason: gate.reason } };
  }

  const base = toPublicPage(program, slug, options.baseUrl);
  const revision = previous ? previous.revision + 1 : 1;
  const page: PublicProgramPage = {
    ...base,
    revision,
    publishedAt: options.publishedAt,
    updatedAt: options.publishedAt,
  };

  return {
    result: { status: 'published', page },
    revision: {
      slug,
      revision,
      publishedAt: options.publishedAt,
      publishedBy: options.publishedBy,
      checksum: pageChecksum(page),
      note: options.note ?? `Published revision ${revision}.`,
    },
  };
}

/**
 * Test/adversarial guard: raises when any private program value appears
 * anywhere on the page, including inside the structured-data payload.
 */
export function assertNoPrivateLeak(page: PublicProgramPage, program: PublishableProgram): void {
  const serialized = stableSerialize(page);
  const secrets: string[] = [];

  for (const field of PRIVATE_PROGRAM_FIELDS) {
    const value = program[field];
    if (typeof value !== 'string' || isBlank(value)) continue;
    secrets.push(value);
    // Private lists (review panels, applicant pools) are compared entry by entry
    // so a partially copied list is still caught.
    for (const entry of value.split(',')) {
      if (!isBlank(entry)) secrets.push(entry.trim());
    }
  }

  const leaked = secrets.filter((secret) => serialized.includes(secret));
  if (leaked.length > 0) {
    throw new Error(
      `Public page ${page.slug} leaks private program data: ${leaked.length} value(s) matched.`
    );
  }

  for (const field of page.publishedFields) {
    if (!(PUBLISHABLE_FIELD_KEYS as readonly string[]).includes(field.key)) {
      throw new Error(`Public page ${page.slug} carries non-whitelisted field "${field.key}".`);
    }
  }
}

export function formatAwardAmount(page: {
  currency: string;
  awardAmountCents: number;
}): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: page.currency || 'USD',
  }).format(page.awardAmountCents / 100);
}

export const publicProgramService = {
  list: (): Promise<PublicProgramSummary[]> =>
    apiClient.get<PublicProgramSummary[]>(PUBLIC_PAGES_PATH),

  get: (slug: string): Promise<PublicProgramPage> =>
    apiClient.get<PublicProgramPage>(`${PUBLIC_PAGES_PATH}/${encodeURIComponent(slug)}`),

  revisions: (slug: string): Promise<PublicPageRevision[]> =>
    apiClient.get<PublicPageRevision[]>(`${PUBLIC_PAGES_PATH}/${encodeURIComponent(slug)}/revisions`),

  publish: (payload: {
    slug: string;
    program: PublishableProgram;
    publishedAt: string;
    publishedBy: string;
    idempotencyKey: string;
    note?: string;
  }): Promise<PublicProgramPage> =>
    apiClient.post<PublicProgramPage>(`${PUBLIC_PAGES_PATH}/publish`, payload),

  unpublish: (payload: {
    slug: string;
    reason: string;
    expectedRevision: number;
    idempotencyKey: string;
  }): Promise<{ slug: string; visibility: ProgramVisibility }> =>
    apiClient.post<{ slug: string; visibility: ProgramVisibility }>(
      `${PUBLIC_PAGES_PATH}/${encodeURIComponent(payload.slug)}/unpublish`,
      payload
    ),
};
