/**
 * Accessibility domain logic (issue #1143).
 *
 * The seed list below is the audit baseline: 27 real WCAG 2.1 A/AA success
 * criteria mapped to the five scholarship journeys. Pure functions do the
 * summarising, the contrast maths, and the focus-order checking so results are
 * reproducible in tests; `accessibilityService` fetches check results.
 */

import { apiClient } from '@/src/lib/api-client';
import type {
  A11yCheckResult,
  A11ySummary,
  ScholarshipJourney,
  WcagCriterion,
  WcagLevel,
} from './types';

const ACCESSIBILITY_PATH = '/scholarships/accessibility';

type Seed = {
  id: string;
  principle: WcagCriterion['principle'];
  level: WcagLevel;
  name: string;
  journey: ScholarshipJourney;
  automated: boolean;
};

const SEED: Seed[] = [
  { id: '1.1.1', principle: 'perceivable', level: 'A', name: 'Non-text Content', journey: 'discovery', automated: true },
  { id: '1.3.1', principle: 'perceivable', level: 'A', name: 'Info and Relationships', journey: 'complex-forms', automated: true },
  { id: '1.3.2', principle: 'perceivable', level: 'A', name: 'Meaningful Sequence', journey: 'complex-forms', automated: true },
  { id: '1.4.3', principle: 'perceivable', level: 'AA', name: 'Contrast (Minimum)', journey: 'review-rubric', automated: true },
  { id: '1.4.4', principle: 'perceivable', level: 'AA', name: 'Resize Text', journey: 'discovery', automated: true },
  { id: '1.4.10', principle: 'perceivable', level: 'AA', name: 'Reflow', journey: 'complex-forms', automated: true },
  { id: '1.4.11', principle: 'perceivable', level: 'AA', name: 'Non-text Contrast', journey: 'financial-tables', automated: true },
  { id: '1.4.13', principle: 'perceivable', level: 'AA', name: 'Content on Hover or Focus', journey: 'complex-forms', automated: false },
  { id: '2.1.1', principle: 'operable', level: 'A', name: 'Keyboard', journey: 'discovery', automated: true },
  { id: '2.1.2', principle: 'operable', level: 'A', name: 'No Keyboard Trap', journey: 'complex-forms', automated: false },
  { id: '2.1.4', principle: 'operable', level: 'A', name: 'Character Key Shortcuts', journey: 'review-rubric', automated: true },
  { id: '2.4.1', principle: 'operable', level: 'A', name: 'Bypass Blocks', journey: 'discovery', automated: true },
  { id: '2.4.2', principle: 'operable', level: 'A', name: 'Page Titled', journey: 'discovery', automated: true },
  { id: '2.4.3', principle: 'operable', level: 'A', name: 'Focus Order', journey: 'review-rubric', automated: false },
  { id: '2.4.4', principle: 'operable', level: 'A', name: 'Link Purpose (In Context)', journey: 'status-updates', automated: true },
  { id: '2.4.6', principle: 'operable', level: 'AA', name: 'Headings and Labels', journey: 'review-rubric', automated: true },
  { id: '2.4.7', principle: 'operable', level: 'AA', name: 'Focus Visible', journey: 'financial-tables', automated: true },
  { id: '2.4.11', principle: 'operable', level: 'AA', name: 'Focus Not Obscured (Minimum)', journey: 'financial-tables', automated: false },
  { id: '3.2.1', principle: 'understandable', level: 'A', name: 'On Focus', journey: 'status-updates', automated: true },
  { id: '3.2.2', principle: 'understandable', level: 'A', name: 'On Input', journey: 'status-updates', automated: true },
  { id: '3.2.3', principle: 'understandable', level: 'AA', name: 'Consistent Navigation', journey: 'discovery', automated: false },
  { id: '3.2.4', principle: 'understandable', level: 'AA', name: 'Consistent Identification', journey: 'status-updates', automated: false },
  { id: '3.3.1', principle: 'understandable', level: 'A', name: 'Error Identification', journey: 'complex-forms', automated: true },
  { id: '3.3.2', principle: 'understandable', level: 'A', name: 'Labels or Instructions', journey: 'complex-forms', automated: true },
  { id: '3.3.3', principle: 'understandable', level: 'AA', name: 'Error Suggestion', journey: 'complex-forms', automated: false },
  { id: '3.3.4', principle: 'understandable', level: 'AA', name: 'Error Prevention (Legal, Financial, Data)', journey: 'financial-tables', automated: false },
  { id: '4.1.2', principle: 'robust', level: 'A', name: 'Name, Role, Value', journey: 'review-rubric', automated: true },
  { id: '4.1.3', principle: 'robust', level: 'AA', name: 'Status Messages', journey: 'status-updates', automated: false },
];

/** The audit baseline: every criterion starts untested. */
export const WCAG_SEED_CRITERIA: WcagCriterion[] = SEED.map((criterion) => ({
  ...criterion,
  status: 'untested' as const,
}));

export function criteriaForJourney(journey: ScholarshipJourney): WcagCriterion[] {
  return WCAG_SEED_CRITERIA.filter((criterion) => criterion.journey === journey);
}

export function describeCriterion(id: string): WcagCriterion | undefined {
  return WCAG_SEED_CRITERIA.find((criterion) => criterion.id === id);
}

const LEVEL_ORDER: Record<WcagLevel, number> = { A: 0, AA: 1, AAA: 2 };

/** Criteria at `level` or stricter. `blockingCriteria('AA')` is the release gate. */
export function blockingCriteria(level: WcagLevel): string[] {
  return WCAG_SEED_CRITERIA.filter((criterion) => LEVEL_ORDER[criterion.level] <= LEVEL_ORDER[level]).map(
    (criterion) => criterion.id
  );
}

export function summariseAccessibility(results: A11yCheckResult[]): A11ySummary {
  const total = results.length;
  const passing = results.filter((result) => result.status === 'pass').length;
  const failing = results.filter((result) => result.status === 'fail').length;
  const untested = results.filter((result) => result.status === 'untested').length;
  const automated = results.filter((result) => result.automated).length;

  const blockingFailures = results
    .filter((result) => result.status === 'fail')
    .filter((result) => {
      const criterion = describeCriterion(result.criterionId);
      return criterion ? LEVEL_ORDER[criterion.level] <= LEVEL_ORDER.AA : false;
    })
    .map((result) => result.criterionId);

  return {
    total,
    passing,
    failing,
    untested,
    automatedCoverage: total === 0 ? 0 : Number((automated / total).toFixed(2)),
    blockingFailures: [...new Set(blockingFailures)],
  };
}

export type HexColour = `#${string}`;

const SHORT_HEX = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const LONG_HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

export function isValidHexColour(value: string): boolean {
  return SHORT_HEX.test(value.trim()) || LONG_HEX.test(value.trim());
}

/** One 0..1 colour component from the short or long hex match groups. */
function component(short: RegExpExecArray | null, long: RegExpExecArray | null, index: number): number {
  if (short) return Number.parseInt(short[index], 16) / 15;
  return Number.parseInt(long![index], 16) / 255;
}

/** WCAG 2.x relative luminance, 0 (black) .. 1 (white). */
export function relativeLuminance(colour: string): number {
  const value = colour.trim();
  const short = SHORT_HEX.exec(value);
  const long = short ? null : LONG_HEX.exec(value);
  if (!short && !long) {
    throw new Error(`Unsupported colour value: ${colour}. Use a 3- or 6-digit hex colour.`);
  }
  const red = component(short, long, 1);
  const green = component(short, long, 2);
  const blue = component(short, long, 3);
  const linearise = (part: number): number =>
    part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4;
  return Number((0.2126 * linearise(red) + 0.7152 * linearise(green) + 0.0722 * linearise(blue)).toFixed(4));
}

/** Contrast ratio between two colours, 1:1 .. 21:1, rounded to 2 decimals. */
export function evaluateContrast(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

/** Minimum ratio for the requested conformance level. */
export function contrastThreshold(level: WcagLevel, isLargeText: boolean): number {
  if (level === 'AAA') return isLargeText ? 4.5 : 7;
  return isLargeText ? 3 : 4.5;
}

export function meetsContrast(ratio: number, level: WcagLevel, isLargeText: boolean): boolean {
  return ratio >= contrastThreshold(level, isLargeText);
}

/**
 * True when focusable ids read as an unbroken ascending sequence, e.g.
 * `['field-1', 'field-2', 'field-3']`. Ids without a numeric suffix are only
 * sequential when they do not repeat.
 */
export function focusOrderIsSequential(order: string[]): boolean {
  if (new Set(order).size !== order.length) return false;
  const positions = order.map((id) => {
    const match = /(\d+)$/.exec(id);
    return match ? Number(match[1]) : null;
  });
  if (positions.some((position) => position === null)) return true;
  for (let index = 1; index < positions.length; index += 1) {
    if ((positions[index] as number) !== (positions[index - 1] as number) + 1) return false;
  }
  return true;
}

export type FocusOrderValidation = {
  valid: boolean;
  missing: string[];
  unexpected: string[];
  outOfOrder: boolean;
  problems: string[];
};

export function validateFocusOrder(expected: string[], actual: string[]): FocusOrderValidation {
  const missing = expected.filter((id) => !actual.includes(id));
  const unexpected = actual.filter((id) => !expected.includes(id));
  const outOfOrder = !focusOrderIsSequential(actual);
  const problems: string[] = [];
  if (missing.length > 0) problems.push(`Not focusable: ${missing.join(', ')}.`);
  if (unexpected.length > 0) problems.push(`Unexpected focus stops: ${unexpected.join(', ')}.`);
  if (outOfOrder) problems.push('Focus order does not follow the reading order.');
  return { valid: missing.length === 0 && unexpected.length === 0 && !outOfOrder, missing, unexpected, outOfOrder, problems };
}

export const accessibilityService = {
  listCriteria: (journey?: ScholarshipJourney): Promise<WcagCriterion[]> =>
    apiClient.get<WcagCriterion[]>(
      journey ? `${ACCESSIBILITY_PATH}/criteria?journey=${encodeURIComponent(journey)}` : `${ACCESSIBILITY_PATH}/criteria`
    ),
  listResults: (): Promise<A11yCheckResult[]> => apiClient.get<A11yCheckResult[]>(`${ACCESSIBILITY_PATH}/results`),
  runChecks: (input: { criteria: string[]; idempotencyKey: string }): Promise<A11yCheckResult[]> =>
    apiClient.post<A11yCheckResult[]>(`${ACCESSIBILITY_PATH}/checks`, input),
};
