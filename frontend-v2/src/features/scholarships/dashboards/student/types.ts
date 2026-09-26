/**
 * Student scholarship dashboard (issue #1132).
 *
 * A student sees where they are in the journey, not a pile of numbers. Every
 * count is *authoritative*: it carries its own `asOf` timestamp and its
 * source, so "0 open milestones" is never confused with "we could not load
 * milestones".
 */

export type CountSourceKind = 'api' | 'cached' | 'unavailable';

export type CountSource = {
  value: number;
  asOf: string;
  source: CountSourceKind;
};

export type StudentJourneySectionId =
  | 'programs'
  | 'applications'
  | 'decisions'
  | 'awards'
  | 'milestones'
  | 'payments';

export type StudentJourneySectionStatus = 'loading' | 'ready' | 'empty' | 'error';

export type NextStep = {
  label: string;
  href: string;
};

export type StudentJourneySection = {
  id: StudentJourneySectionId;
  title: string;
  count: CountSource;
  status: StudentJourneySectionStatus;
  nextStep?: NextStep;
  error?: string;
};

export type StudentDashboard = {
  studentId: string;
  sections: StudentJourneySection[];
  generatedAt: string;
};

/**
 * The raw counts a dashboard is built from. Every key is optional so a single
 * failing source can be represented without inventing zeroes.
 */
export type StudentJourneyCounts = {
  discoverablePrograms: number;
  drafts: number;
  submitted: number;
  inReview: number;
  decisions: number;
  awards: number;
  openMilestones: number;
  payments: number;
};

/** One part of the dashboard: either counts, or the failure that replaced them. */
export type StudentDashboardPart =
  | {
      ok: true;
      counts: Partial<StudentJourneyCounts>;
      asOf: string;
      source?: CountSourceKind;
    }
  | {
      ok: false;
      error: string;
      asOf: string;
    };

export type StudentDashboardParts = Record<string, StudentDashboardPart>;

/** Which count feeds which section. Keeps `buildStudentDashboard` declarative. */
export const SECTION_COUNT_KEYS: Record<StudentJourneySectionId, keyof StudentJourneyCounts> = {
  programs: 'discoverablePrograms',
  applications: 'drafts',
  decisions: 'decisions',
  awards: 'awards',
  milestones: 'openMilestones',
  payments: 'payments',
};

export const SECTION_TITLES: Record<StudentJourneySectionId, string> = {
  programs: 'Discoverable programs',
  applications: 'Applications in progress',
  decisions: 'Decisions',
  awards: 'Awards',
  milestones: 'Open milestones',
  payments: 'Payments',
};

export const SECTION_ORDER: readonly StudentJourneySectionId[] = [
  'programs',
  'applications',
  'decisions',
  'awards',
  'milestones',
  'payments',
];

/** A count older than this is flagged stale rather than presented as fact. */
export const COUNT_MAX_AGE_SECONDS = 300;
