import { describe, expect, it } from 'vitest';
import { validateProgramDraft } from './validation';
import type { CreateProgramPayload } from './types';

const VALID_DRAFT: CreateProgramPayload = {
  organizationId: 'org-1',
  name: 'Career mentorship',
  audience: ['final-year students'],
  outcomes: ['interview readiness'],
  capacity: 20,
  durationWeeks: 8,
  deliveryMode: 'hybrid',
  startsAt: '2026-11-01T00:00:00.000Z',
  endsAt: '2026-12-27T00:00:00.000Z',
  ownerUserId: 'staff-1',
  visibility: 'public',
};

describe('validateProgramDraft', () => {
  it('accepts a complete draft', () => {
    expect(validateProgramDraft(VALID_DRAFT)).toEqual([]);
  });

  it('requires a non-empty name', () => {
    const errors = validateProgramDraft({ ...VALID_DRAFT, name: '   ' });
    expect(errors.map((error) => error.field)).toContain('name');
  });

  it('rejects negative capacity', () => {
    const errors = validateProgramDraft({ ...VALID_DRAFT, capacity: -1 });
    expect(errors.map((error) => error.field)).toContain('capacity');
  });

  it('requires at least one week of duration', () => {
    const errors = validateProgramDraft({ ...VALID_DRAFT, durationWeeks: 0 });
    expect(errors.map((error) => error.field)).toContain('durationWeeks');
  });

  it('requires an ISO 8601 start date', () => {
    const errors = validateProgramDraft({ ...VALID_DRAFT, startsAt: 'soon' });
    expect(errors.map((error) => error.field)).toContain('startsAt');
  });

  it('requires the end date to follow the start date', () => {
    const errors = validateProgramDraft({
      ...VALID_DRAFT,
      endsAt: '2026-10-01T00:00:00.000Z',
    });
    expect(errors.map((error) => error.field)).toContain('endsAt');
  });

  it('requires a non-empty audience and outcomes', () => {
    const errors = validateProgramDraft({
      ...VALID_DRAFT,
      audience: [],
      outcomes: [],
    });
    const fields = errors.map((error) => error.field);
    expect(fields).toContain('audience');
    expect(fields).toContain('outcomes');
  });
});
