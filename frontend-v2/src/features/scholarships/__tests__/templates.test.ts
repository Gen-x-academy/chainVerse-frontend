import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  approvalHistory,
  buildDeliveryRecord,
  canPublish,
  extractVariables,
  isChannelOverLimit,
  redactForLog,
  renderTemplate,
  rollbackTemplate,
  publishTemplate,
  sampleValuesFor,
  templateService,
  validateTemplate,
} from '../templates/service';
import type { TemplateVersion } from '../templates/types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { apiClient } from '@/src/lib/api-client';

function version(overrides: Partial<TemplateVersion> = {}): TemplateVersion {
  return {
    id: 'tpl-1-v2',
    templateKey: 'award-confirmation',
    version: 2,
    channel: 'email',
    locale: 'en',
    subject: 'You received {{awardName}}',
    body: 'Hi {{applicantName}}, your award of {{awardName}} is confirmed for {{awardDate}}.',
    variables: [
      { name: 'applicantName', required: true, example: 'Ada Lovelace', pii: true },
      { name: 'awardName', required: true, example: 'ChainVerse Scholarship', pii: false },
      { name: 'awardDate', required: true, example: '1 Sep 2025', pii: false },
    ],
    status: 'approved',
    createdBy: 'author-1',
    createdAt: '2025-08-01T09:00:00.000Z',
    ...overrides,
  };
}

describe('extractVariables', () => {
  it('returns distinct tokens in first-appearance order', () => {
    expect(extractVariables('{{b}} then {{a}} then {{b}}')).toEqual(['b', 'a']);
  });

  it('ignores empty braces', () => {
    expect(extractVariables('no tokens {{}} here')).toEqual([]);
  });
});

describe('validateTemplate', () => {
  it('flags variables used but not declared', () => {
    const result = validateTemplate(version({ body: 'Hi {{applicantName}} about {{mystery}}.' }));
    expect(result.valid).toBe(false);
    expect(result.unknownVariables).toEqual(['mystery']);
    expect(result.errors.map((error) => error.code)).toContain('UNKNOWN_VARIABLE');
  });

  it('flags required variables that are never used', () => {
    const result = validateTemplate(version({ body: 'Hi {{applicantName}}.' }));
    expect(result.valid).toBe(false);
    expect(result.missingVariables).toEqual(['awardDate']);
    expect(result.errors.map((error) => error.code)).toContain('MISSING_VARIABLE');
  });

  it('flags an unclosed token', () => {
    const result = validateTemplate(version({ body: 'Hi {{applicantName' }));
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('UNCLOSED_TOKEN');
  });

  it('flags an empty body', () => {
    const result = validateTemplate(version({ body: '   ' }));
    expect(result.errors.map((error) => error.code)).toContain('EMPTY_BODY');
  });

  it('passes for a well-formed template', () => {
    expect(validateTemplate(version()).valid).toBe(true);
  });
});

describe('channel limits', () => {
  it('rejects SMS copy over 480 characters', () => {
    const result = validateTemplate(
      version({
        channel: 'sms',
        subject: undefined,
        body: `${'a'.repeat(500)} {{applicantName}}`,
      })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === 'CHANNEL_LIMIT')).toBe(true);
    expect(isChannelOverLimit('sms', { channel: 'sms', body: 'a'.repeat(481) })).toBe(true);
    expect(isChannelOverLimit('sms', { channel: 'sms', body: 'a'.repeat(479) })).toBe(false);
  });

  it('rejects an email with no subject', () => {
    const result = validateTemplate(version({ subject: '' }));
    expect(result.errors.some((error) => error.code === 'CHANNEL_LIMIT')).toBe(true);
  });

  it('rejects a push subject over 90 characters', () => {
    expect(
      isChannelOverLimit('push', { channel: 'push', body: 'short', subject: 's'.repeat(91) })
    ).toBe(true);
  });
});

describe('renderTemplate', () => {
  it('substitutes declared values', () => {
    const rendered = renderTemplate(version(), {
      applicantName: 'Ada Lovelace',
      awardName: 'ChainVerse Scholarship',
      awardDate: '1 Sep 2025',
    });
    expect(rendered.renderedBody).toContain('Hi Ada Lovelace');
    expect(rendered.version).toBe(2);
    expect(rendered.channel).toBe('email');
  });

  it('throws on an undeclared variable', () => {
    expect(() => renderTemplate(version({ body: 'Hi {{ghost}}' }), {})).toThrow(/undeclared/i);
  });

  it('throws when a required value is missing', () => {
    expect(() =>
      renderTemplate(version(), { applicantName: 'Ada', awardName: '', awardDate: '1 Sep 2025' })
    ).toThrow(/missing required/i);
  });

  it('masks PII tokens in the preview', () => {
    const rendered = renderTemplate(version(), sampleValuesFor(version()), { maskPii: true });
    expect(rendered.renderedBody).not.toContain('Ada Lovelace');
    expect(rendered.renderedBody).toContain('[redacted]');
  });
});

describe('canPublish and publishTemplate', () => {
  it('refuses to publish an invalid draft', () => {
    const result = validateTemplate(version({ body: 'Hi {{unknownToken}}' }));
    expect(canPublish(result)).toBe(false);
    expect(() => publishTemplate(version({ body: 'Hi {{unknownToken}}' }), [], 'a-1')).toThrow(
      /Publication blocked/
    );
  });

  it('requires a named approver', () => {
    expect(() => publishTemplate(version(), [], '  ')).toThrow(/approver/i);
  });

  it('publishes without renumbering the version and rolls back the prior one', () => {
    const prior = version({ id: 'tpl-1-v1', version: 1, status: 'published' });
    const result = publishTemplate(version({ status: 'approved' }), [prior], 'a-1', '2025-09-01T00:00:00.000Z');

    expect(result.published.version).toBe(2);
    expect(result.published.status).toBe('published');
    expect(result.published.approvedBy).toBe('a-1');
    expect(result.versions.find((entry) => entry.version === 1)?.status).toBe('rolled-back');
  });
});

describe('rollbackTemplate', () => {
  it('re-points the live template at an earlier version', () => {
    const prior = version({ id: 'tpl-1-v1', version: 1, status: 'rolled-back' });
    const current = version({ id: 'tpl-1-v2', version: 2, status: 'published' });
    const next = rollbackTemplate('award-confirmation', 1, [current, prior]);

    expect(next.find((entry) => entry.version === 1)?.status).toBe('published');
    expect(next.find((entry) => entry.version === 2)?.status).toBe('rolled-back');
  });

  it('throws when the target version does not exist', () => {
    expect(() => rollbackTemplate('award-confirmation', 9, [version()])).toThrow(/no version 9/);
  });
});

describe('redaction and delivery records', () => {
  it('redacts PII values from the log copy', () => {
    const rendered = renderTemplate(version(), {
      applicantName: 'Ada Lovelace',
      awardName: 'ChainVerse Scholarship',
      awardDate: '1 Sep 2025',
    });
    const redacted = redactForLog(rendered, ['Ada Lovelace']);
    expect(redacted).not.toContain('Ada Lovelace');
    expect(redacted).toContain('[redacted]');
    expect(redacted).toContain('ChainVerse Scholarship');
  });

  it('delivery record carries the template version and a redacted log', () => {
    const record = buildDeliveryRecord({
      id: 'dlv-1',
      template: version(),
      values: {
        applicantName: 'Ada Lovelace',
        awardName: 'ChainVerse Scholarship',
        awardDate: '1 Sep 2025',
      },
      recipientRef: 'recipient-hash-9f2',
      deliveredAt: '2025-09-02T10:00:00.000Z',
    });

    expect(record.templateVersion).toBe(2);
    expect(record.redactedLog).not.toContain('Ada Lovelace');
    expect(record.recipientRef).toBe('recipient-hash-9f2');
  });
});

describe('approvalHistory', () => {
  it('lists approved versions newest first', () => {
    const entries = approvalHistory(
      [
        version({ id: 'a', version: 1, approvedBy: 'x', status: 'rolled-back' }),
        version({ id: 'b', version: 2, status: 'draft' }),
        version({ id: 'c', version: 3, approvedBy: 'y', status: 'published' }),
      ],
      'award-confirmation'
    );
    expect(entries.map((entry) => entry.version)).toEqual([3, 1]);
  });
});

describe('templateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads templates from the scholarships namespace', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([version()]);
    const result = await templateService.listTemplates();
    expect(apiClient.get).toHaveBeenCalledWith('/scholarships/templates');
    expect(result).toHaveLength(1);
  });

  it('sends the approver and idempotency key when publishing', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(version({ status: 'published' }));
    await templateService.publishTemplate({
      template: version(),
      expectedVersion: 2,
      approver: 'a-1',
      idempotencyKey: 'publish-award-confirmation-2',
    });
    expect(vi.mocked(apiClient.post).mock.calls[0][0]).toBe('/scholarships/templates/publish');
    expect(vi.mocked(apiClient.post).mock.calls[0][1]).toMatchObject({
      approver: 'a-1',
      expectedVersion: 2,
      idempotencyKey: 'publish-award-confirmation-2',
    });
  });
});
