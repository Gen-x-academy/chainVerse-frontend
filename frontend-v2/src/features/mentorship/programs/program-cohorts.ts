/** MENTOR-017: configure mentorship program cohorts (dated intake groups). */
export type CohortStatus = 'planned' | 'open' | 'running' | 'closed';

export interface Cohort {
  id: string;
  programId: string;
  name: string;
  applicationOpensAt: string;
  applicationClosesAt: string;
  startsAt: string;
  endsAt: string;
}

export function validateCohort(c: Cohort, siblings: Cohort[] = []): string[] {
  const errors: string[] = [];
  const t = (s: string) => Date.parse(s);
  const [o, cl, s, e] = [t(c.applicationOpensAt), t(c.applicationClosesAt), t(c.startsAt), t(c.endsAt)];
  if ([o, cl, s, e].some(Number.isNaN)) return ['All dates must be valid'];
  if (!c.name.trim()) errors.push('Name is required');
  if (cl <= o) errors.push('Applications must close after they open');
  if (s < cl) errors.push('Cohort cannot start before applications close');
  if (e <= s) errors.push('Cohort must end after it starts');
  if (siblings.some((x) => x.id !== c.id && x.name.toLowerCase() === c.name.trim().toLowerCase())) {
    errors.push('Another cohort already uses this name');
  }
  return errors;
}

export function cohortStatus(c: Cohort, now: Date = new Date()): CohortStatus {
  const n = now.getTime();
  if (n < Date.parse(c.applicationOpensAt)) return 'planned';
  if (n < Date.parse(c.applicationClosesAt)) return 'open';
  if (n < Date.parse(c.endsAt)) return 'running';
  return 'closed';
}

export const acceptingApplications = (c: Cohort, now: Date = new Date()): boolean => cohortStatus(c, now) === 'open';

/** Chronological order by start date, then id for determinism. */
export const sortCohorts = (cs: Cohort[]): Cohort[] =>
  [...cs].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id));
