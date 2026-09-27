/**
 * Student dashboard domain rules (issue #1132).
 *
 * Partial failure is isolated by design: the dashboard is assembled from
 * independent parts, and one part failing marks exactly one section as
 * `error` while every other section stays `ready`.
 */

import { apiClient } from '@/src/lib/api-client';
import {
  COUNT_MAX_AGE_SECONDS,
  SECTION_COUNT_KEYS,
  SECTION_ORDER,
  SECTION_TITLES,
  type CountSource,
  type NextStep,
  type StudentDashboard,
  type StudentDashboardParts,
  type StudentDashboardPart,
  type StudentJourneyCounts,
  type StudentJourneySection,
  type StudentJourneySectionId,
} from './types';

/** The single most useful next action for each section of the journey. */
export function nextStepFor(sectionId: StudentJourneySectionId): NextStep {
  switch (sectionId) {
    case 'programs':
      return { label: 'Browse open programs', href: '/scholarships/apply' };
    case 'applications':
      return { label: 'Continue an application', href: '/scholarships/apply' };
    case 'decisions':
      return { label: 'Review your decisions', href: '/scholarships/applications' };
    case 'awards':
      return { label: 'Review award terms', href: '/scholarships/awards' };
    case 'milestones':
      return { label: 'Submit milestone evidence', href: '/scholarships/awards' };
    case 'payments':
      return { label: 'Check payment schedule', href: '/scholarships/awards' };
  }
}

function unavailableCount(asOf: string): CountSource {
  return { value: 0, asOf, source: 'unavailable' };
}

/**
 * Build a dashboard from independently loaded parts. A part that failed marks
 * only its own section as `error`; a section whose count is zero is `empty`
 * and always carries a next step so the student is never left at a dead end.
 */
export function buildStudentDashboard(
  studentId: string,
  parts: StudentDashboardParts,
  now: Date
): StudentDashboard {
  const generatedAt = now.toISOString();

  const sections: StudentJourneySection[] = SECTION_ORDER.map((id) => {
    const key = SECTION_COUNT_KEYS[id];
    const part = parts[id];

    if (!part || !part.ok) {
      return {
        id,
        title: SECTION_TITLES[id],
        count: unavailableCount(part ? part.asOf : generatedAt),
        status: 'error',
        error: part && !part.ok ? part.error : 'This section could not be loaded.',
        nextStep: nextStepFor(id),
      };
    }

    const value = part.counts[key] ?? 0;
    const count: CountSource = { value, asOf: part.asOf, source: part.source ?? 'api' };

    return {
      id,
      title: SECTION_TITLES[id],
      count,
      status: value === 0 ? 'empty' : 'ready',
      nextStep: value === 0 ? nextStepFor(id) : undefined,
    };
  });

  return { studentId, sections, generatedAt };
}

/** Total of the raw counts, used for quick assertions and summaries. */
export function sumJourneyCounts(counts: StudentJourneyCounts): number {
  return Object.values(counts).reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

export function isStaleCount(count: CountSource, now: Date, maxAgeSeconds = COUNT_MAX_AGE_SECONDS): boolean {
  return staleCount(count, now, maxAgeSeconds);
}

/** A count is stale once it is older than the allowed age. */
export function staleCount(count: CountSource, now: Date, maxAgeSeconds = COUNT_MAX_AGE_SECONDS): boolean {
  const asOf = Date.parse(count.asOf);
  if (Number.isNaN(asOf)) return true;
  return now.getTime() - asOf > maxAgeSeconds * 1000;
}

export function ageSecondsOf(count: CountSource, now: Date): number {
  const asOf = Date.parse(count.asOf);
  if (Number.isNaN(asOf)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round((now.getTime() - asOf) / 1000));
}

export const studentDashboardService = {
  async get(studentId: string): Promise<StudentDashboard> {
    return apiClient.get<StudentDashboard>(
      `/scholarships/dashboard/student/${encodeURIComponent(studentId)}`
    );
  },

  /** Loads each journey part independently so one failure cannot blank the rest. */
  async getParts(studentId: string): Promise<StudentDashboardParts> {
    const resources: { id: StudentJourneySectionId; resource: string }[] = [
      { id: 'programs', resource: 'programs' },
      { id: 'applications', resource: 'applications' },
      { id: 'decisions', resource: 'decisions' },
      { id: 'awards', resource: 'awards' },
      { id: 'milestones', resource: 'milestones' },
      { id: 'payments', resource: 'payments' },
    ];

    const now = new Date().toISOString();
    const loaded = await Promise.all(
      resources.map(async ({ id, resource }) => {
        try {
          const payload = await apiClient.get<{ counts?: Partial<StudentJourneyCounts>; asOf?: string }>(
            `/scholarships/dashboard/student/${encodeURIComponent(studentId)}/${resource}`
          );
          const part: StudentDashboardPart = {
            ok: true,
            counts: payload.counts ?? {},
            asOf: payload.asOf ?? now,
            source: 'api',
          };
          return [id, part] as const;
        } catch (cause: unknown) {
          const part: StudentDashboardPart = {
            ok: false,
            error: cause instanceof Error ? cause.message : 'This section could not be loaded.',
            asOf: now,
          };
          return [id, part] as const;
        }
      })
    );

    return Object.fromEntries(loaded);
  },
};
