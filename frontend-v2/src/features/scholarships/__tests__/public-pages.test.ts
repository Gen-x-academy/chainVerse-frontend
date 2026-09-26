import { describe, expect, it, vi } from 'vitest';
import {
  assertNoPrivateLeak,
  canonicalUrlFor,
  canPublish,
  formatAwardAmount,
  nextRevision,
  pageChecksum,
  publish,
  publishableFieldsFor,
  PUBLISHABLE_FIELD_KEYS,
  structuredDataFor,
  toPublicPage,
  publicProgramService,
} from '@/src/features/scholarships/public-pages/service';
import type { PublishableProgram } from '@/src/features/scholarships/public-pages/types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const PUBLISHED_AT = '2026-05-04T10:00:00.000Z';

function program(overrides: Partial<PublishableProgram> = {}): PublishableProgram {
  return {
    programId: 'chainverse-scholarship',
    title: 'ChainVerse Scholarship',
    summary: 'Support for students building in public.',
    description: 'A full-year scholarship for open-source builders.',
    sponsorName: 'ChainVerse Foundation',
    currency: 'USD',
    awardAmountCents: 400000,
    applicationDeadline: '2026-06-30T23:59:00.000Z',
    eligibilitySummary: ['Enrolled at an accredited institution', 'At least 16 years old'],
    visibility: 'public',
    updatedAt: '2026-05-01T00:00:00.000Z',
    internalNotes: 'Board wants a quiet launch.',
    selectionCriteria: 'Weighted rubric with internal notes.',
    applicantPool: 'Ada Lovelace, Grace Hopper',
    reviewPanel: 'reviewer-42, reviewer-07',
    ...overrides,
  };
}

describe('publishable field whitelist', () => {
  it('emits only whitelisted keys', () => {
    const page = toPublicPage(program(), 'chainverse-scholarship');
    expect(page.publishedFields.map((field) => field.key)).toEqual([
      ...PUBLISHABLE_FIELD_KEYS,
    ]);
    for (const field of page.publishedFields) {
      expect(field.publishable).toBe(true);
    }
  });

  it('drops fields with no value instead of emitting them hidden', () => {
    const page = toPublicPage(program({ description: '   ' }), 'chainverse-scholarship');
    expect(page.description).toBe('');
    expect(page.publishedFields.some((field) => field.key === 'description')).toBe(false);
    expect(publishableFieldsFor(program({ summary: '' })).some((f) => f.key === 'summary')).toBe(false);
  });

  it('never carries private program fields', () => {
    const page = toPublicPage(program(), 'chainverse-scholarship');
    const serialized = JSON.stringify(page);
    expect(serialized).not.toContain('Board wants a quiet launch.');
    expect(serialized).not.toContain('Weighted rubric');
    expect(serialized).not.toContain('Ada Lovelace');
    expect(serialized).not.toContain('reviewer-42');
    expect(() => assertNoPrivateLeak(page, program())).not.toThrow();
  });

  it('fails the leak guard when a private value is smuggled in', () => {
    const page = toPublicPage(program(), 'chainverse-scholarship');
    const leaky = { ...page, summary: `${page.summary} Ada Lovelace` };
    expect(() => assertNoPrivateLeak(leaky, program())).toThrow(/leaks private program data/);
  });
});

describe('publication gating', () => {
  it('refuses invitation-only programs', () => {
    const result = publish(
      program({ visibility: 'invitation-only' }),
      'invite-only',
      { publishedAt: PUBLISHED_AT, publishedBy: 'admin-1' }
    );
    expect(result.result.status).toBe('refused');
    expect(result.result.reason).toBe('INVITATION_ONLY');
    expect(result.result.page).toBeUndefined();
  });

  it('refuses unpublished and restricted programs', () => {
    expect(canPublish(program({ visibility: 'unpublished' }))).toEqual({
      allowed: false,
      reason: 'UNPUBLISHED',
    });
    expect(canPublish(program({ visibility: 'restricted' }))).toEqual({
      allowed: false,
      reason: 'NOT_PUBLISHED',
    });
  });

  it('refuses when no publishable field survives', () => {
    const empty = program({
      title: '',
      summary: '',
      description: '',
      sponsorName: '',
      currency: '',
      applicationDeadline: '',
      eligibilitySummary: [],
      awardAmountCents: 0,
    });
    expect(canPublish(empty)).toEqual({ allowed: false, reason: 'NO_PUBLISHABLE_FIELDS' });
  });
});

describe('revisions and checksums', () => {
  it('bumps the revision and records a stable checksum', () => {
    const first = publish(program(), 'chainverse-scholarship', {
      publishedAt: PUBLISHED_AT,
      publishedBy: 'admin-1',
    });
    expect(first.result.page?.revision).toBe(1);

    const second = publish(
      program({ updatedAt: '2026-05-04T09:00:00.000Z' }),
      'chainverse-scholarship',
      { publishedAt: '2026-05-04T10:00:00.000Z', publishedBy: 'admin-2' },
      first.result.page
    );
    expect(second.result.page?.revision).toBe(2);
    expect(second.revision?.revision).toBe(2);
    expect(second.revision?.publishedBy).toBe('admin-2');
    expect(second.revision?.checksum).toMatch(/^fnv1a-[0-9a-f]{8}$/);
    expect(pageChecksum(second.result.page!)).toBe(second.revision?.checksum);

    const repeat = publish(
      program({ updatedAt: '2026-05-04T09:00:00.000Z' }),
      'chainverse-scholarship',
      { publishedAt: '2026-05-04T10:00:00.000Z', publishedBy: 'admin-3' },
      first.result.page
    );
    expect(repeat.revision?.checksum).toBe(second.revision?.checksum);
  });

  it('computes the next revision across pages', () => {
    expect(nextRevision([])).toBe(1);
    expect(nextRevision([{ revision: 1 }, { revision: 4 }])).toBe(5);
  });
});

describe('canonical url and structured data', () => {
  it('builds a canonical url', () => {
    expect(canonicalUrlFor('chainverse-scholarship', 'https://chainverse.example/')).toBe(
      'https://chainverse.example/scholarships/public/chainverse-scholarship'
    );
  });

  it('emits a stable JSON-LD shape from the redacted page', () => {
    const page = toPublicPage(program(), 'chainverse-scholarship', 'https://chainverse.example');
    expect(page.structuredData).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Scholarship',
      name: 'ChainVerse Scholarship',
      description: 'Support for students building in public.',
      url: 'https://chainverse.example/scholarships/public/chainverse-scholarship',
      deadline: '2026-06-30T23:59:00.000Z',
    });
    expect(structuredDataFor(page)).toEqual(page.structuredData);
    expect(JSON.stringify(page.structuredData)).not.toContain('Ada Lovelace');
  });

  it('formats the award amount in the page currency', () => {
    expect(
      formatAwardAmount({ currency: 'USD', awardAmountCents: 400000 })
    ).toBe('$4,000.00');
  });
});

describe('publicProgramService', () => {
  it('reads and publishes through the api client', async () => {
    const { apiClient } = await import('@/src/lib/api-client');
    const mocked = apiClient as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };
    mocked.get.mockResolvedValue([]);
    mocked.post.mockResolvedValue({});

    await publicProgramService.list();
    expect(mocked.get).toHaveBeenCalledWith('/scholarships/public');

    await publicProgramService.get('chainverse-scholarship');
    expect(mocked.get).toHaveBeenCalledWith('/scholarships/public/chainverse-scholarship');

    await publicProgramService.publish({
      slug: 'chainverse-scholarship',
      program: program(),
      publishedAt: PUBLISHED_AT,
      publishedBy: 'admin-1',
      idempotencyKey: 'pub-1',
    });
    expect(mocked.post).toHaveBeenCalledWith(
      '/scholarships/public/publish',
      expect.objectContaining({ idempotencyKey: 'pub-1' })
    );
  });
});
