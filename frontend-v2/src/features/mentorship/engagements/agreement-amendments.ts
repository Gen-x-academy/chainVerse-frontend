/** MENTOR-048: amend an active mentorship agreement; both parties must accept before it takes effect. */
export interface AgreementTermsSnapshot {
  sessionsPerMonth: number;
  sessionMinutes: number;
  endDate: string;
  goals: string[];
}

export type AmendmentStatus = 'proposed' | 'accepted' | 'rejected' | 'withdrawn';

export interface Amendment {
  id: string;
  agreementId: string;
  proposedBy: string;
  baseVersion: number;
  changes: Partial<AgreementTermsSnapshot>;
  reason: string;
  status: AmendmentStatus;
  acceptedBy: string[];
}

export interface ActiveAgreement {
  id: string;
  version: number;
  parties: [string, string];
  terms: AgreementTermsSnapshot;
}

export function proposeAmendment(a: ActiveAgreement, proposedBy: string, changes: Partial<AgreementTermsSnapshot>, reason: string): Amendment {
  if (!a.parties.includes(proposedBy)) throw new Error('Only agreement parties can propose amendments');
  if (!Object.keys(changes).length) throw new Error('Specify at least one change');
  if (!reason.trim()) throw new Error('Explain why the agreement needs to change');
  return {
    id: `${a.id}:amend:${a.version + 1}`,
    agreementId: a.id,
    baseVersion: a.version,
    proposedBy,
    changes,
    reason: reason.trim(),
    status: 'proposed',
    acceptedBy: [proposedBy],
  };
}

/** Idempotent per participant. */
export function acceptAmendment(am: Amendment, participantId: string, a: ActiveAgreement): Amendment {
  if (!a.parties.includes(participantId)) throw new Error('Only agreement parties can respond');
  if (am.status !== 'proposed') throw new Error('Amendment is no longer open');
  if (am.baseVersion !== a.version) throw new Error('Agreement changed since this was proposed');
  if (am.acceptedBy.includes(participantId)) return am;
  const acceptedBy = [...am.acceptedBy, participantId];
  return { ...am, acceptedBy, status: a.parties.every((p) => acceptedBy.includes(p)) ? 'accepted' : 'proposed' };
}

/** Applies an accepted amendment, producing the next immutable version. */
export function applyAmendment(a: ActiveAgreement, am: Amendment): ActiveAgreement {
  if (am.status !== 'accepted' || am.baseVersion !== a.version) throw new Error('Amendment cannot be applied');
  return { ...a, version: a.version + 1, terms: { ...a.terms, ...am.changes } };
}
