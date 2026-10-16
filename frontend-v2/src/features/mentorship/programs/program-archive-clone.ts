/** MENTOR-022: archive and clone mentorship programs. */
export type ProgramState = 'draft' | 'published' | 'archived';

export interface MentorshipProgram {
  id: string;
  name: string;
  state: ProgramState;
  activeEngagements: number;
  config: Record<string, unknown>;
  staffUserIds: string[];
  archivedAt?: string;
  clonedFromId?: string;
}

/** Archiving is blocked while engagements are active so no one loses an in-flight mentorship. */
export function archiveProgram(p: MentorshipProgram, now: Date = new Date()): MentorshipProgram {
  if (p.state === 'archived') return p;
  if (p.activeEngagements > 0) throw new Error(`Cannot archive: ${p.activeEngagements} active engagement(s)`);
  return { ...p, state: 'archived', archivedAt: now.toISOString() };
}

export function restoreProgram(p: MentorshipProgram): MentorshipProgram {
  if (p.state !== 'archived') return p;
  return { ...p, state: 'draft', archivedAt: undefined };
}

/**
 * Clone settings into a fresh draft. Participants, engagements and publication state are never copied;
 * staff are carried over so the new draft is immediately manageable.
 */
export function cloneProgram(p: MentorshipProgram, newId: string, name?: string): MentorshipProgram {
  return {
    id: newId,
    name: name?.trim() || `${p.name} (copy)`,
    state: 'draft',
    activeEngagements: 0,
    config: JSON.parse(JSON.stringify(p.config)) as Record<string, unknown>,
    staffUserIds: [...p.staffUserIds],
    clonedFromId: p.id,
  };
}

export const isEditable = (p: MentorshipProgram): boolean => p.state !== 'archived';
