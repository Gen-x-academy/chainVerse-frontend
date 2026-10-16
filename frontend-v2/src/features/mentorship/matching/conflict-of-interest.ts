/** MENTOR-040: detect mentorship conflicts of interest before a match is proposed. */
export interface ParticipantProfile {
  id: string;
  employerId?: string;
  emailDomain?: string;
  /** Ids of people this participant has declared a close relationship with. */
  declaredRelationIds?: string[];
  /** Ids of people this participant reports to, or who report to them. */
  reportingLineIds?: string[];
}

export type ConflictKind = 'same_employer' | 'declared_relationship' | 'reporting_line' | 'same_person';

export interface Conflict {
  kind: ConflictKind;
  severity: 'block' | 'review';
  message: string;
}

const PUBLIC_EMAIL_DOMAINS = new Set(['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'icloud.com', 'proton.me']);

export function detectConflicts(mentor: ParticipantProfile, mentee: ParticipantProfile): Conflict[] {
  const out: Conflict[] = [];
  if (mentor.id === mentee.id) {
    return [{ kind: 'same_person', severity: 'block', message: 'A person cannot mentor themselves.' }];
  }
  if (mentor.declaredRelationIds?.includes(mentee.id) || mentee.declaredRelationIds?.includes(mentor.id)) {
    out.push({ kind: 'declared_relationship', severity: 'block', message: 'A declared personal relationship exists.' });
  }
  if (mentor.reportingLineIds?.includes(mentee.id) || mentee.reportingLineIds?.includes(mentor.id)) {
    out.push({ kind: 'reporting_line', severity: 'block', message: 'The participants are in the same reporting line.' });
  }
  const sameEmployer = !!mentor.employerId && mentor.employerId === mentee.employerId;
  const sameDomain =
    !!mentor.emailDomain &&
    mentor.emailDomain === mentee.emailDomain &&
    !PUBLIC_EMAIL_DOMAINS.has(mentor.emailDomain.toLowerCase());
  if (sameEmployer || sameDomain) {
    out.push({ kind: 'same_employer', severity: 'review', message: 'Both participants work at the same organization.' });
  }
  return out;
}

export const hasBlockingConflict = (conflicts: Conflict[]): boolean => conflicts.some((c) => c.severity === 'block');
