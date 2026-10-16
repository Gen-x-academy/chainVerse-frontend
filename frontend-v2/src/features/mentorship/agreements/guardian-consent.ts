/** MENTOR-047: guardian consent required for participants under the age of majority. */
export interface ConsentPolicy {
  /** Age below which guardian consent is required. */
  minimumAdultAge: number;
}

export type ConsentStatus = 'not_required' | 'required' | 'requested' | 'granted' | 'declined' | 'expired';

export interface GuardianConsent {
  participantId: string;
  guardianEmail: string;
  status: ConsentStatus;
  requestedAt?: string;
  decidedAt?: string;
  expiresAt?: string;
}

export const DEFAULT_CONSENT_POLICY: ConsentPolicy = { minimumAdultAge: 18 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ageOn(dateOfBirth: string, today: Date = new Date()): number {
  const dob = new Date(dateOfBirth);
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const before = today.getUTCMonth() < dob.getUTCMonth() || (today.getUTCMonth() === dob.getUTCMonth() && today.getUTCDate() < dob.getUTCDate());
  if (before) age -= 1;
  return age;
}

export function isGuardianConsentRequired(dateOfBirth: string, policy: ConsentPolicy = DEFAULT_CONSENT_POLICY, today: Date = new Date()): boolean {
  return ageOn(dateOfBirth, today) < policy.minimumAdultAge;
}

export function requestConsent(participantId: string, guardianEmail: string, now: Date = new Date(), validDays = 14): GuardianConsent {
  if (!EMAIL.test(guardianEmail)) throw new Error('Enter a valid guardian email');
  return {
    participantId,
    guardianEmail,
    status: 'requested',
    requestedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + validDays * 86_400_000).toISOString(),
  };
}

/** Status as of `now`; a pending request past its expiry reads as expired. */
export function effectiveStatus(c: GuardianConsent, now: Date = new Date()): ConsentStatus {
  if (c.status === 'requested' && c.expiresAt && Date.parse(c.expiresAt) < now.getTime()) return 'expired';
  return c.status;
}

export function decideConsent(c: GuardianConsent, granted: boolean, now: Date = new Date()): GuardianConsent {
  if (effectiveStatus(c, now) !== 'requested') throw new Error('Consent request is no longer pending');
  return { ...c, status: granted ? 'granted' : 'declined', decidedAt: now.toISOString() };
}

/** The engagement may only proceed when consent is not required or has been granted. */
export const canProceed = (required: boolean, c: GuardianConsent | undefined, now: Date = new Date()): boolean =>
  !required || (!!c && effectiveStatus(c, now) === 'granted');
