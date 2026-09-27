import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  accessibilityService,
  blockingCriteria,
  contrastThreshold,
  criteriaForJourney,
  describeCriterion,
  evaluateContrast,
  focusOrderIsSequential,
  isValidHexColour,
  meetsContrast,
  relativeLuminance,
  summariseAccessibility,
  validateFocusOrder,
  WCAG_SEED_CRITERIA,
} from '../accessibility/service';
import type { A11yCheckResult } from '../accessibility/types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { apiClient } from '@/src/lib/api-client';

function result(overrides: Partial<A11yCheckResult> = {}): A11yCheckResult {
  return {
    criterionId: '1.4.3',
    status: 'pass',
    automated: true,
    evidence: 'axe-core: no violations',
    checkedAt: '2025-09-01T12:00:00.000Z',
    ...overrides,
  };
}

describe('seed criteria', () => {
  it('ships at least 24 curated criteria', () => {
    expect(WCAG_SEED_CRITERIA.length).toBeGreaterThanOrEqual(24);
  });

  it('covers the five journeys', () => {
    for (const journey of ['discovery', 'complex-forms', 'review-rubric', 'financial-tables', 'status-updates'] as const) {
      expect(criteriaForJourney(journey).length).toBeGreaterThan(0);
    }
  });

  it('covers every criterion the release gate names', () => {
    const required = [
      '1.1.1', '1.3.1', '1.4.3', '1.4.11',
      '2.1.1', '2.1.2', '2.4.1', '2.4.3', '2.4.7', '2.4.11',
      '3.2.1', '3.3.1', '3.3.2', '3.3.3', '3.3.4',
      '4.1.2', '4.1.3',
    ];
    for (const id of required) {
      const criterion = describeCriterion(id);
      expect(criterion, id).toBeDefined();
      expect(['A', 'AA', 'AAA']).toContain(criterion?.level);
    }
  });

  it('uses unique criterion ids', () => {
    const ids = WCAG_SEED_CRITERIA.map((criterion) => criterion.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('describeCriterion and blockingCriteria', () => {
  it('returns undefined for an unknown id', () => {
    expect(describeCriterion('9.9.9')).toBeUndefined();
  });

  it('treats level A and AA criteria as blocking', () => {
    const blocking = blockingCriteria('AA');
    expect(blocking).toContain('1.4.3');
    expect(blocking).toContain('4.1.2');
    expect(blocking.length).toBe(WCAG_SEED_CRITERIA.length);
  });
});

describe('contrast maths', () => {
  it('returns 21:1 for black on white', () => {
    expect(evaluateContrast('#000000', '#ffffff')).toBe(21);
    expect(evaluateContrast('#000', '#fff')).toBe(21);
  });

  it('returns 1:1 for identical colours', () => {
    expect(evaluateContrast('#ffffff', '#ffffff')).toBe(1);
  });

  it('computes a documented AA-passing pair', () => {
    // #767676 on #ffffff is 4.54:1, the canonical "smallest passing grey".
    const ratio = evaluateContrast('#767676', '#ffffff');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(meetsContrast(ratio, 'AA', false)).toBe(true);
  });

  it('computes a documented AA-failing pair', () => {
    // #9a9a9a on #ffffff is 2.85:1, below the 4.5:1 minimum.
    const ratio = evaluateContrast('#9a9a9a', '#ffffff');
    expect(ratio).toBeLessThan(4.5);
    expect(meetsContrast(ratio, 'AA', false)).toBe(false);
  });

  it('is symmetric in its arguments', () => {
    expect(evaluateContrast('#1f2937', '#ffffff')).toBe(evaluateContrast('#ffffff', '#1f2937'));
  });

  it('exposes the relative luminance endpoints', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBe(1);
  });

  it('rejects a colour it cannot parse', () => {
    expect(isValidHexColour('#zzz')).toBe(false);
    expect(() => evaluateContrast('rebeccapurple', '#ffffff')).toThrow(/hex/i);
  });
});

describe('meetsContrast', () => {
  it('uses 4.5:1 for normal text and 3:1 for large text at AA', () => {
    expect(contrastThreshold('AA', false)).toBe(4.5);
    expect(contrastThreshold('AA', true)).toBe(3);
    expect(meetsContrast(3.2, 'AA', true)).toBe(true);
    expect(meetsContrast(3.2, 'AA', false)).toBe(false);
  });

  it('uses 7:1 for AAA normal text and 4.5:1 for AAA large text', () => {
    expect(contrastThreshold('AAA', false)).toBe(7);
    expect(contrastThreshold('AAA', true)).toBe(4.5);
    expect(meetsContrast(4.6, 'AAA', true)).toBe(true);
    expect(meetsContrast(4.6, 'AAA', false)).toBe(false);
  });
});

describe('summariseAccessibility', () => {
  it('counts pass, fail, untested and automated coverage', () => {
    const summary = summariseAccessibility([
      result({ criterionId: '1.4.3', status: 'pass', automated: true }),
      result({ criterionId: '4.1.2', status: 'fail', automated: true }),
      result({ criterionId: '2.4.3', status: 'untested', automated: false }),
    ]);

    expect(summary.total).toBe(3);
    expect(summary.passing).toBe(1);
    expect(summary.failing).toBe(1);
    expect(summary.untested).toBe(1);
    expect(summary.automatedCoverage).toBeCloseTo(0.67, 2);
  });

  it('lists only level A and AA failures as blocking', () => {
    const summary = summariseAccessibility([
      result({ criterionId: '1.4.3', status: 'fail', automated: true }),
      result({ criterionId: '4.1.2', status: 'fail', automated: false }),
      result({ criterionId: '2.4.7', status: 'pass', automated: false }),
    ]);

    expect(summary.blockingFailures).toEqual(['1.4.3', '4.1.2']);
  });

  it('handles an empty result set without dividing by zero', () => {
    const summary = summariseAccessibility([]);
    expect(summary.total).toBe(0);
    expect(summary.automatedCoverage).toBe(0);
    expect(summary.blockingFailures).toEqual([]);
  });
});

describe('focus order', () => {
  it('detects a sequential order', () => {
    expect(focusOrderIsSequential(['field-1', 'field-2', 'field-3'])).toBe(true);
  });

  it('detects a gap and a repeat', () => {
    expect(focusOrderIsSequential(['field-1', 'field-3'])).toBe(false);
    expect(focusOrderIsSequential(['field-1', 'field-1'])).toBe(false);
  });

  it('validates the expected order against the actual one', () => {
    const expected = ['a', 'b', 'c'];
    expect(validateFocusOrder(expected, ['a', 'b', 'c']).valid).toBe(true);
    expect(validateFocusOrder(expected, ['a', 'c']).valid).toBe(false);
  });

  it('reports every focus-order problem', () => {
    const outcome = validateFocusOrder(['field-1', 'field-2'], ['field-2', 'field-9']);
    expect(outcome.valid).toBe(false);
    expect(outcome.missing).toEqual(['field-1']);
    expect(outcome.unexpected).toEqual(['field-9']);
    expect(outcome.outOfOrder).toBe(true);
    expect(outcome.problems).toHaveLength(3);
  });
});

describe('accessibilityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches criteria and results from the scholarships namespace', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([]);
    await accessibilityService.listCriteria();
    await accessibilityService.listResults();
    expect(vi.mocked(apiClient.get).mock.calls[0][0]).toBe('/scholarships/accessibility/criteria');
    expect(vi.mocked(apiClient.get).mock.calls[1][0]).toBe('/scholarships/accessibility/results');
  });

  it('scopes criteria by journey', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([]);
    await accessibilityService.listCriteria('financial-tables');
    expect(vi.mocked(apiClient.get).mock.calls[0][0]).toBe(
      '/scholarships/accessibility/criteria?journey=financial-tables'
    );
  });

  it('sends an idempotency key when running checks', async () => {
    vi.mocked(apiClient.post).mockResolvedValue([]);
    await accessibilityService.runChecks({ criteria: ['1.4.3'], idempotencyKey: 'a11y-1' });
    expect(vi.mocked(apiClient.post).mock.calls[0][0]).toBe('/scholarships/accessibility/checks');
    expect(vi.mocked(apiClient.post).mock.calls[0][1]).toMatchObject({ idempotencyKey: 'a11y-1' });
  });
});
