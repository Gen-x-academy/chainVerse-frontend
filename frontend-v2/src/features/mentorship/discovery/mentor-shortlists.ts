/** MENTOR-025: saved mentor shortlists (named, capped, duplicate-safe). */
export interface Shortlist {
  id: string;
  name: string;
  mentorIds: string[];
  updatedAt: string;
}

export const MAX_SHORTLISTS = 10;
export const MAX_MENTORS_PER_SHORTLIST = 50;

const touch = (s: Shortlist, now: Date, mentorIds = s.mentorIds): Shortlist => ({ ...s, mentorIds, updatedAt: now.toISOString() });

export function createShortlist(lists: Shortlist[], id: string, name: string, now: Date = new Date()): Shortlist[] {
  const clean = name.trim();
  if (!clean || clean.length > 60) throw new Error('Name must be 1-60 characters');
  if (lists.length >= MAX_SHORTLISTS) throw new Error(`You can keep at most ${MAX_SHORTLISTS} shortlists`);
  if (lists.some((l) => l.name.toLowerCase() === clean.toLowerCase())) throw new Error('You already have a shortlist with that name');
  return [...lists, { id, name: clean, mentorIds: [], updatedAt: now.toISOString() }];
}

/** Idempotent: adding a saved mentor again is a no-op. */
export function addMentor(lists: Shortlist[], listId: string, mentorId: string, now: Date = new Date()): Shortlist[] {
  return lists.map((l) => {
    if (l.id !== listId || l.mentorIds.includes(mentorId)) return l;
    if (l.mentorIds.length >= MAX_MENTORS_PER_SHORTLIST) throw new Error(`A shortlist holds at most ${MAX_MENTORS_PER_SHORTLIST} mentors`);
    return touch(l, now, [...l.mentorIds, mentorId]);
  });
}

export function removeMentor(lists: Shortlist[], listId: string, mentorId: string, now: Date = new Date()): Shortlist[] {
  return lists.map((l) => (l.id === listId && l.mentorIds.includes(mentorId) ? touch(l, now, l.mentorIds.filter((m) => m !== mentorId)) : l));
}

export const deleteShortlist = (lists: Shortlist[], listId: string): Shortlist[] => lists.filter((l) => l.id !== listId);

export const shortlistsContaining = (lists: Shortlist[], mentorId: string): Shortlist[] => lists.filter((l) => l.mentorIds.includes(mentorId));

/** Drops mentors that no longer exist (e.g. deactivated) when a shortlist is loaded. */
export function pruneUnavailable(lists: Shortlist[], availableIds: Set<string>): Shortlist[] {
  return lists.map((l) => ({ ...l, mentorIds: l.mentorIds.filter((id) => availableIds.has(id)) }));
}
