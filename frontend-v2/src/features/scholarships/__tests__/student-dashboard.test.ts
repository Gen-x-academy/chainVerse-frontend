import { describe, expect, it, vi } from 'vitest';
import {
  buildStudentDashboard,
  nextStepFor,
  staleCount,
  sumJourneyCounts,
  studentDashboardService,
  ageSecondsOf,
} from '../dashboards/student';
import type { StudentDashboardPart, StudentDashboardParts, StudentJourneyCounts } from '../dashboards/student';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const NOW = new Date('2026-04-01T12:00:00.000Z');

const ok = (counts: Partial<StudentJourneyCounts>, asOf = '2026-04-01T11:59:00.000Z'): StudentDashboardPart => ({
  ok: true,
  counts,
  asOf,
  source: 'api',
});

const failed = (error: string): StudentDashboardPart => ({
  ok: false,
  error,
  asOf: '2026-04-01T11:59:00.000Z',
});

const FULL_COUNTS: StudentJourneyCounts = {
  discoverablePrograms: 4,
  drafts: 1,
  submitted: 2,
  inReview: 1,
  decisions: 0,
  awards: 1,
  openMilestones: 3,
  payments: 2,
};

const sectionOf = (dashboard: ReturnType<typeof buildStudentDashboard>, id: string) => {
  const section = dashboard.sections.find((entry) => entry.id === id);
  if (!section) throw new Error(`missing section ${id}`);
  return section;
};

describe('buildStudentDashboard', () => {
  it('marks sections with data as ready and carries an asOf timestamp per count', () => {
    const parts: StudentDashboardParts = {
      programs: ok({ discoverablePrograms: 4 }),
      applications: ok({ drafts: 1 }),
      decisions: ok({ decisions: 0 }),
      awards: ok({ awards: 1 }),
      milestones: ok({ openMilestones: 3 }),
      payments: ok({ payments: 2 }),
    };
    const dashboard = buildStudentDashboard('student-1', parts, NOW);

    expect(dashboard.studentId).toBe('student-1');
    expect(dashboard.generatedAt).toBe(NOW.toISOString());
    expect(sectionOf(dashboard, 'programs')).toMatchObject({
      status: 'ready',
      count: { value: 4, asOf: '2026-04-01T11:59:00.000Z', source: 'api' },
    });
    expect(sectionOf(dashboard, 'milestones').count.asOf).toBe('2026-04-01T11:59:00.000Z');
  });

  it('isolates one failing part to a single error section', () => {
    const parts: StudentDashboardParts = {
      programs: ok({ discoverablePrograms: 4 }),
      applications: ok({ drafts: 1 }),
      decisions: failed('decision service unavailable'),
      awards: ok({ awards: 1 }),
      milestones: ok({ openMilestones: 3 }),
      payments: ok({ payments: 2 }),
    };
    const dashboard = buildStudentDashboard('student-1', parts, NOW);

    const statuses = dashboard.sections.map((section) => [section.id, section.status]);
    expect(statuses).toEqual([
      ['programs', 'ready'],
      ['applications', 'ready'],
      ['decisions', 'error'],
      ['awards', 'ready'],
      ['milestones', 'ready'],
      ['payments', 'ready'],
    ]);
    expect(sectionOf(dashboard, 'decisions').error).toBe('decision service unavailable');
    expect(sectionOf(dashboard, 'decisions').count.source).toBe('unavailable');
    expect(sectionOf(dashboard, 'awards').count.value).toBe(1);
  });

  it('marks a zero count as empty and gives it a next step', () => {
    const parts: StudentDashboardParts = {
      programs: ok({ discoverablePrograms: 0 }),
      applications: ok({ drafts: 1 }),
      decisions: ok({ decisions: 0 }),
      awards: ok({ awards: 0 }),
      milestones: ok({ openMilestones: 0 }),
      payments: ok({ payments: 0 }),
    };
    const dashboard = buildStudentDashboard('student-1', parts, NOW);

    expect(sectionOf(dashboard, 'milestones').status).toBe('empty');
    expect(sectionOf(dashboard, 'milestones').nextStep?.href).toBe('/scholarships/awards');
    expect(sectionOf(dashboard, 'programs').nextStep?.label).toMatch(/browse/i);
  });

  it('gives a ready section no next step', () => {
    const dashboard = buildStudentDashboard(
      'student-1',
      {
        programs: ok({ discoverablePrograms: 2 }),
        applications: ok({ drafts: 1 }),
        decisions: ok({ decisions: 1 }),
        awards: ok({ awards: 1 }),
        milestones: ok({ openMilestones: 1 }),
        payments: ok({ payments: 1 }),
      },
      NOW
    );
    expect(sectionOf(dashboard, 'programs').nextStep).toBeUndefined();
  });

  it('treats a missing part as an error rather than a zero', () => {
    const dashboard = buildStudentDashboard('student-1', { programs: ok({ discoverablePrograms: 1 }) }, NOW);
    expect(sectionOf(dashboard, 'payments').status).toBe('error');
    expect(sectionOf(dashboard, 'payments').count.source).toBe('unavailable');
  });
});

describe('nextStepFor', () => {
  it('maps every section to an action with a label and an href', () => {
    for (const id of ['programs', 'applications', 'decisions', 'awards', 'milestones', 'payments'] as const) {
      const next = nextStepFor(id);
      expect(next.label).not.toHaveLength(0);
      expect(next.href.startsWith('/scholarships')).toBe(true);
    }
  });
});

describe('staleCount', () => {
  const count = { value: 1, asOf: NOW.toISOString(), source: 'api' as const };

  it('is fresh within the allowed age', () => {
    expect(staleCount(count, new Date('2026-04-01T12:04:00.000Z'), 300)).toBe(false);
  });

  it('is stale beyond the allowed age', () => {
    expect(staleCount(count, new Date('2026-04-01T12:06:00.000Z'), 300)).toBe(true);
  });

  it('reports the age in seconds', () => {
    expect(ageSecondsOf(count, new Date('2026-04-01T12:02:30.000Z'))).toBe(150);
  });
});

describe('sumJourneyCounts', () => {
  it('totals every count', () => {
    expect(sumJourneyCounts(FULL_COUNTS)).toBe(14);
  });
});

describe('studentDashboardService.getParts', () => {
  it('keeps a failing part isolated from the rest', async () => {
    const { apiClient } = await import('@/src/lib/api-client');
    const values: Record<string, number> = {
      programs: FULL_COUNTS.discoverablePrograms,
      applications: FULL_COUNTS.drafts,
      decisions: FULL_COUNTS.decisions,
      awards: FULL_COUNTS.awards,
      payments: FULL_COUNTS.payments,
    };
    const countKeys: Record<string, keyof StudentJourneyCounts> = {
      programs: 'discoverablePrograms',
      applications: 'drafts',
      decisions: 'decisions',
      awards: 'awards',
      payments: 'payments',
    };

    vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
      const resource = path.split('/').pop() as string;
      if (resource === 'milestones') throw new Error('milestone service unavailable');
      return {
        counts: { [countKeys[resource]]: values[resource] ?? 0 },
        asOf: '2026-04-01T11:59:00.000Z',
      };
    });

    const parts = await studentDashboardService.getParts('student-1');
    expect(parts.milestones).toMatchObject({ ok: false, error: 'milestone service unavailable' });
    expect(parts.programs).toMatchObject({ ok: true });

    const dashboard = buildStudentDashboard('student-1', parts, NOW);
    expect(sectionOf(dashboard, 'milestones').status).toBe('error');
    expect(sectionOf(dashboard, 'programs').status).toBe('ready');
  });
});
