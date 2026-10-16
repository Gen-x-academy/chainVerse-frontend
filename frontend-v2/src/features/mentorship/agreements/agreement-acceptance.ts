/** MENTOR-046: record each participant's acceptance of a specific agreement version. */
export interface Acceptance {
  agreementId: string;
  version: number;
  participantId: string;
  role: 'mentor' | 'mentee';
  acceptedAt: string;
  /** Hash of the terms the participant saw, so later edits cannot be passed off as accepted. */
  termsDigest: string;
}

export interface AcceptanceState {
  acceptances: Acceptance[];
  required: { participantId: string; role: Acceptance['role'] }[];
}

/** Small deterministic digest (FNV-1a); sufficient for change detection, not security. */
export function digestTerms(terms: unknown): string {
  const text = JSON.stringify(terms, Object.keys(terms as object).sort());
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Idempotent: re-accepting the same version returns the existing state. */
export function recordAcceptance(
  state: AcceptanceState,
  input: Omit<Acceptance, 'acceptedAt'>,
  now: Date = new Date(),
): AcceptanceState {
  if (!state.required.some((r) => r.participantId === input.participantId && r.role === input.role)) {
    throw new Error('Participant is not a party to this agreement');
  }
  const already = state.acceptances.some(
    (a) => a.participantId === input.participantId && a.agreementId === input.agreementId && a.version === input.version,
  );
  if (already) return state;
  return { ...state, acceptances: [...state.acceptances, { ...input, acceptedAt: now.toISOString() }] };
}

export function pendingParticipants(state: AcceptanceState, agreementId: string, version: number): string[] {
  return state.required
    .filter((r) => !state.acceptances.some((a) => a.participantId === r.participantId && a.agreementId === agreementId && a.version === version))
    .map((r) => r.participantId);
}

export const isFullyAccepted = (state: AcceptanceState, agreementId: string, version: number): boolean =>
  pendingParticipants(state, agreementId, version).length === 0;
