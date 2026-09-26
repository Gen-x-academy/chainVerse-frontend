/**
 * WCAG conformance tracking across the scholarship journeys (issue #1143).
 *
 * The audit is a curated, real list of success criteria mapped to the five
 * applicant/staff journeys. Statuses are recorded per criterion with evidence
 * and a timestamp, and the module ships a WCAG contrast implementation so the
 * team can verify ratios locally instead of trusting a design token.
 */

export type WcagPrinciple = 'perceivable' | 'operable' | 'understandable' | 'robust';

export type WcagLevel = 'A' | 'AA' | 'AAA';

export type ScholarshipJourney =
  | 'discovery'
  | 'complex-forms'
  | 'review-rubric'
  | 'financial-tables'
  | 'status-updates';

export type WcagStatus = 'untested' | 'pass' | 'fail' | 'not-applicable';

export type WcagCriterion = {
  id: `${number}` | string;
  principle: WcagPrinciple;
  level: WcagLevel;
  name: string;
  journey: ScholarshipJourney;
  status: WcagStatus;
  /** True when a tool (axe, Lighthouse, eslint-plugin-jsx-a11y) can decide it. */
  automated: boolean;
  evidence?: string;
  lastCheckedAt?: string;
};

export type A11yCheckResult = {
  criterionId: string;
  status: WcagStatus;
  automated: boolean;
  evidence: string;
  checkedAt: string;
};

export type A11ySummary = {
  total: number;
  passing: number;
  failing: number;
  untested: number;
  /** Share of criteria decided by an automated tool, 0..1. */
  automatedCoverage: number;
  /** Failing A/AA criteria: release blockers. */
  blockingFailures: string[];
};

export const SCHOLARSHIP_JOURNEYS: ScholarshipJourney[] = [
  'discovery',
  'complex-forms',
  'review-rubric',
  'financial-tables',
  'status-updates',
];

export const JOURNEY_LABELS: Record<ScholarshipJourney, string> = {
  discovery: 'Discovery and program search',
  'complex-forms': 'Application and complex forms',
  'review-rubric': 'Review and rubric scoring',
  'financial-tables': 'Financial tables and disbursements',
  'status-updates': 'Status updates and notifications',
};
