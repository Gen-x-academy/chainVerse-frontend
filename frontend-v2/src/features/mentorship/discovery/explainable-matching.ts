/** MENTOR-028: recommend mentors with explainable matching (every score comes with its reasons). */
export interface MenteeNeeds {
  goals: string[];
  skillsWanted: string[];
  languages: string[];
  timeZone: string;
}

export interface RecommendableMentor {
  id: string;
  skills: string[];
  languages: string[];
  timeZone: string;
  acceptingMentees: boolean;
  rating?: number;
}

export interface Recommendation {
  mentorId: string;
  /** 0-100. */
  score: number;
  reasons: { factor: string; points: number; detail: string }[];
}

const WEIGHTS = { skills: 50, languages: 20, timeZone: 15, rating: 15 } as const;
const lower = (xs: string[]) => xs.map((x) => x.toLowerCase());

/** Hour offset between two IANA zones at the given instant. */
function offsetHours(tz: string, at: Date): number | undefined {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, hour: 'numeric', minute: 'numeric', day: 'numeric' }).formatToParts(at);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return get('day') * 24 + (get('hour') % 24) + get('minute') / 60;
  } catch {
    return undefined;
  }
}

export function scoreMentor(needs: MenteeNeeds, m: RecommendableMentor, now: Date = new Date()): Recommendation | undefined {
  if (!m.acceptingMentees) return undefined;
  const reasons: Recommendation['reasons'] = [];

  const wanted = lower(needs.skillsWanted);
  const have = lower(m.skills);
  const matched = wanted.filter((s) => have.includes(s));
  if (wanted.length) {
    reasons.push({
      factor: 'skills',
      points: Math.round((matched.length / wanted.length) * WEIGHTS.skills),
      detail: matched.length ? `Covers ${matched.join(', ')}` : 'No requested skills covered',
    });
  }

  const shared = lower(needs.languages).filter((l) => lower(m.languages).includes(l));
  reasons.push({
    factor: 'languages',
    points: shared.length ? WEIGHTS.languages : 0,
    detail: shared.length ? `Shared language: ${shared.join(', ')}` : 'No shared language',
  });

  const a = offsetHours(needs.timeZone, now);
  const b = offsetHours(m.timeZone, now);
  const diff = a === undefined || b === undefined ? undefined : Math.min(Math.abs(a - b), 24 - Math.abs(a - b));
  reasons.push({
    factor: 'timeZone',
    points: diff === undefined ? 0 : Math.round(WEIGHTS.timeZone * Math.max(0, 1 - diff / 8)),
    detail: diff === undefined ? 'Time zone unknown' : `${Math.round(diff)}h apart`,
  });

  reasons.push({
    factor: 'rating',
    points: m.rating ? Math.round((m.rating / 5) * WEIGHTS.rating) : 0,
    detail: m.rating ? `Rated ${m.rating.toFixed(1)}/5` : 'No rating yet',
  });

  const max = (wanted.length ? WEIGHTS.skills : 0) + WEIGHTS.languages + WEIGHTS.timeZone + WEIGHTS.rating;
  const total = reasons.reduce((s, r) => s + r.points, 0);
  return { mentorId: m.id, score: Math.round((total / max) * 100), reasons };
}

export function recommendMentors(needs: MenteeNeeds, mentors: RecommendableMentor[], limit = 10, now: Date = new Date()): Recommendation[] {
  return mentors
    .map((m) => scoreMentor(needs, m, now))
    .filter((r): r is Recommendation => !!r && r.score > 0)
    .sort((a, b) => b.score - a.score || a.mentorId.localeCompare(b.mentorId))
    .slice(0, limit);
}
