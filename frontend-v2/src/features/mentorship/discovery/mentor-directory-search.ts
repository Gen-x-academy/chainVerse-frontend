/** MENTOR-023: mentor directory search, filtering, ranking and pagination (client-side contract). */
export interface DirectoryMentor {
  id: string;
  displayName: string;
  headline: string;
  skills: string[];
  languages: string[];
  timeZone: string;
  acceptingMentees: boolean;
  rating?: number;
}

export interface DirectoryQuery {
  text?: string;
  skills?: string[];
  languages?: string[];
  acceptingOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface DirectoryPage {
  items: DirectoryMentor[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

const MAX_PAGE_SIZE = 50;
const norm = (s: string) => s.trim().toLowerCase();

/** Relevance: name match outranks headline, which outranks skill match. 0 means no text hit. */
function score(m: DirectoryMentor, terms: string[]): number {
  let s = 0;
  for (const t of terms) {
    if (norm(m.displayName).includes(t)) s += 3;
    if (norm(m.headline).includes(t)) s += 2;
    if (m.skills.some((k) => norm(k).includes(t))) s += 1;
  }
  return s;
}

export function searchMentors(all: DirectoryMentor[], q: DirectoryQuery): DirectoryPage {
  const terms = norm(q.text ?? '').split(/\s+/).filter(Boolean);
  const skills = (q.skills ?? []).map(norm);
  const langs = (q.languages ?? []).map(norm);

  const scored = all
    .filter((m) => !q.acceptingOnly || m.acceptingMentees)
    .filter((m) => skills.every((s) => m.skills.some((k) => norm(k) === s)))
    .filter((m) => langs.every((l) => m.languages.some((x) => norm(x) === l)))
    .map((m) => ({ m, s: terms.length ? score(m, terms) : 1 }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || (b.m.rating ?? 0) - (a.m.rating ?? 0) || a.m.id.localeCompare(b.m.id));

  const pageSize = Math.min(Math.max(q.pageSize ?? 20, 1), MAX_PAGE_SIZE);
  const page = Math.max(q.page ?? 1, 1);
  const start = (page - 1) * pageSize;
  return {
    items: scored.slice(start, start + pageSize).map((x) => x.m),
    total: scored.length,
    page,
    pageSize,
    hasMore: start + pageSize < scored.length,
  };
}
