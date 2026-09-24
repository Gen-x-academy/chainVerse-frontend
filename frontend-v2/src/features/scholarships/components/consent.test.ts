import { describe, expect, it } from 'vitest';
import { buildConsentSubmission, needsReconsent } from '../consent';
import type { ConsentRequirement } from '../consent';

const requirement: ConsentRequirement = {
  kind: 'privacyNotice',
  title: 'Privacy notice',
  description: 'Privacy terms.',
  version: '2026-09-01',
  required: true,
  revocable: true,
  documentUrl: '/privacy',
};

describe('scholarship consent', () => {
  it('requires consent when a policy version changes', () => {
    expect(needsReconsent(requirement, {
      kind: 'privacyNotice',
      version: '2026-01-01',
      accepted: true,
      acceptedAt: '2026-01-02T00:00:00.000Z',
      revocable: true,
    })).toBe(true);
  });

  it('builds affirmative, timestamped submissions for accepted requirements', () => {
    const now = new Date('2026-09-24T00:00:00.000Z');
    expect(buildConsentSubmission([requirement], new Set(['privacyNotice']), now)).toEqual([{
      kind: 'privacyNotice',
      version: '2026-09-01',
      accepted: true,
      acceptedAt: '2026-09-24T00:00:00.000Z',
    }]);
  });
});
