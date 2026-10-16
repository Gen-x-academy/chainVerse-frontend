/** MENTOR-045: mentorship engagement agreements built from a template and versioned terms. */
export interface AgreementTerms {
  goals: string[];
  sessionsPerMonth: number;
  sessionMinutes: number;
  startDate: string;
  endDate: string;
  communicationChannel: 'in_app' | 'video' | 'email';
  confidentiality: boolean;
  paymentTerms?: string;
}

export type AgreementStatus = 'draft' | 'pending_acceptance' | 'active' | 'superseded';

export interface EngagementAgreement {
  id: string;
  engagementId: string;
  version: number;
  status: AgreementStatus;
  terms: AgreementTerms;
  createdAt: string;
}

const UNSAFE = /<\s*\/?\s*[a-z!][^>]*>|javascript:/i;

export function validateTerms(t: AgreementTerms): string[] {
  const errors: string[] = [];
  if (!t.goals.length) errors.push('Add at least one goal');
  if (t.goals.some((g) => UNSAFE.test(g) || !g.trim())) errors.push('Goals must be plain, non-empty text');
  if (!Number.isInteger(t.sessionsPerMonth) || t.sessionsPerMonth < 1 || t.sessionsPerMonth > 30) errors.push('Sessions per month must be 1-30');
  if (t.sessionMinutes < 15 || t.sessionMinutes > 240) errors.push('Session length must be 15-240 minutes');
  const start = Date.parse(t.startDate);
  const end = Date.parse(t.endDate);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) errors.push('End date must be after start date');
  return errors;
}

export function createAgreement(engagementId: string, terms: AgreementTerms, now: Date = new Date()): EngagementAgreement {
  const errors = validateTerms(terms);
  if (errors.length) throw new Error(errors.join('; '));
  return { id: `${engagementId}:v1`, engagementId, version: 1, status: 'draft', terms, createdAt: now.toISOString() };
}

/** Only drafts may be sent for acceptance; published terms stay immutable. */
export function submitForAcceptance(a: EngagementAgreement): EngagementAgreement {
  if (a.status !== 'draft') throw new Error('Only draft agreements can be submitted');
  return { ...a, status: 'pending_acceptance' };
}

export function summarizeTerms(t: AgreementTerms): string {
  return `${t.sessionsPerMonth} x ${t.sessionMinutes} min sessions per month via ${t.communicationChannel.replace('_', ' ')}, ${t.startDate} to ${t.endDate}`;
}
