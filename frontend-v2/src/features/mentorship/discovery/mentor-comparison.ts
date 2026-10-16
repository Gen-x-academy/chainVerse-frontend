/** MENTOR-026: side-by-side mentor comparison (2-4 mentors). */
export interface ComparableMentor {
  id: string;
  displayName: string;
  skills: string[];
  languages: string[];
  yearsExperience: number;
  rating?: number;
  hourlyRateUsd?: number;
  acceptingMentees: boolean;
}

export const MIN_COMPARE = 2;
export const MAX_COMPARE = 4;

export function toggleCompare(selected: string[], mentorId: string): string[] {
  if (selected.includes(mentorId)) return selected.filter((id) => id !== mentorId);
  if (selected.length >= MAX_COMPARE) throw new Error(`Compare up to ${MAX_COMPARE} mentors at a time`);
  return [...selected, mentorId];
}

export const canCompare = (selected: string[]): boolean => selected.length >= MIN_COMPARE && selected.length <= MAX_COMPARE;

export interface ComparisonRow {
  key: string;
  label: string;
  values: (string | number | boolean | string[] | undefined)[];
  /** Ids of mentors holding the best value for this row, when "best" is defined. */
  bestIds: string[];
}

function best(mentors: ComparableMentor[], pick: (m: ComparableMentor) => number | undefined, higher: boolean): string[] {
  const vals = mentors.map((m) => ({ id: m.id, v: pick(m) })).filter((x): x is { id: string; v: number } => x.v !== undefined);
  if (vals.length < 2) return [];
  const target = higher ? Math.max(...vals.map((x) => x.v)) : Math.min(...vals.map((x) => x.v));
  const winners = vals.filter((x) => x.v === target).map((x) => x.id);
  return winners.length === vals.length ? [] : winners;
}

export function buildComparison(mentors: ComparableMentor[]): ComparisonRow[] {
  if (!canCompare(mentors.map((m) => m.id))) throw new Error(`Select ${MIN_COMPARE}-${MAX_COMPARE} mentors to compare`);
  return [
    { key: 'experience', label: 'Experience (years)', values: mentors.map((m) => m.yearsExperience), bestIds: best(mentors, (m) => m.yearsExperience, true) },
    { key: 'rating', label: 'Rating', values: mentors.map((m) => m.rating), bestIds: best(mentors, (m) => m.rating, true) },
    { key: 'rate', label: 'Hourly rate (USD)', values: mentors.map((m) => m.hourlyRateUsd), bestIds: best(mentors, (m) => m.hourlyRateUsd, false) },
    { key: 'skills', label: 'Skills', values: mentors.map((m) => m.skills), bestIds: [] },
    { key: 'languages', label: 'Languages', values: mentors.map((m) => m.languages), bestIds: [] },
    { key: 'availability', label: 'Accepting mentees', values: mentors.map((m) => m.acceptingMentees), bestIds: [] },
  ];
}

/** Skills shared by every compared mentor. */
export function sharedSkills(mentors: ComparableMentor[]): string[] {
  if (!mentors.length) return [];
  return mentors[0].skills.filter((s) => mentors.every((m) => m.skills.includes(s)));
}
