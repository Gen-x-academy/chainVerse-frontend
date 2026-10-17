/**
 * Mentorship program analytics (issue #1361).
 *
 * Privacy-safe reporting of applications, eligibility, matches, activation,
 * attendance, completion, wait time, retention, and outcomes by authorized
 * program and cohort dimensions.
 */

export type MentorshipAnalyticsDimension = 'programId' | 'cohortId' | 'mentorId' | 'tenantId';

export type MentorshipAnalyticsMetricKey =
  | 'applications'
  | 'eligible'
  | 'matches'
  | 'activated'
  | 'attendance'
  | 'completion'
  | 'waitTimeP50'
  | 'waitTimeP95'
  | 'retention'
  | 'outcomes';

export type MentorshipAnalyticsRow = {
  programId: string;
  cohortId?: string;
  tenantId: string;
  [key in MentorshipAnalyticsMetricKey]?: number | null;
};

export const MENTORSHIP_ANALYTICS_METRICS = [
  'applications',
  'eligible',
  'matches',
  'activated',
  'attendance',
  'completion',
  'waitTimeP50',
  'waitTimeP95',
  'retention',
  'outcomes',
] as const;

export type MentorshipAnalyticsSnapshot = {
  definitionsVersion: string;
  generatedAt: string;
  tenantId: string;
  rows: MentorshipAnalyticsRow[];
  suppressed: boolean;
  notes: string[];
};

export const SMALL_GROUP_THRESHOLD = 5;
export const MENTORSHIP_ANALYTICS_DEFINITIONS_VERSION = '2026-10-17';
