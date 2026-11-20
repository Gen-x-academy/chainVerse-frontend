/**
 * Charter acceptance records (CAPSTONE-050).
 *
 * Each participant explicitly approves one sealed charter version. The record
 * holds the actor, charter hash, version, timestamp and expiry, and a
 * single-use nonce so a captured request cannot be replayed. Only the hash is
 * stored, never the charter text.
 */

export interface AcceptanceIntent {
  /** Single-use value created when the participant opens the acceptance step. */
  nonce: string;
  charterId: string;
  charterVersion: number;
  charterHash: string;
  actorId: string;
  /** ISO time after which the intent can no longer be used. */
  expiresAt: string;
}

export interface AcceptanceRecord {
  id: string;
  charterId: string;
  charterVersion: number;
  charterHash: string;
  actorId: string;
  acceptedAt: string;
  /** When this acceptance stops counting, for example at the end of the project phase. */
  validUntil: string;
}

export interface AcceptanceLedger {
  records: AcceptanceRecord[];
  usedNonces: string[];
}

export type AcceptanceErrorCode = "intent_expired" | "nonce_used" | "hash_mismatch" | "version_mismatch" | "not_a_participant" | "already_accepted" | "bad_validity";

export type AcceptanceResult = { ok: true; ledger: AcceptanceLedger; record: AcceptanceRecord; replayed: boolean } | { ok: false; code: AcceptanceErrorCode; message: string };

const MESSAGES: Record<AcceptanceErrorCode, string> = {
  intent_expired: "This approval request has expired. Open the charter again.",
  nonce_used: "This approval request was already used.",
  hash_mismatch: "The charter changed after you opened it. Review the new version.",
  version_mismatch: "A newer charter version is available. Review it first.",
  not_a_participant: "Only team participants can approve this charter.",
  already_accepted: "You have already approved this version.",
  bad_validity: "The approval end date must be after it is given.",
};

const fail = (code: AcceptanceErrorCode): AcceptanceResult => ({ ok: false, code, message: MESSAGES[code] });

export const emptyAcceptanceLedger = (): AcceptanceLedger => ({ records: [], usedNonces: [] });

export interface SealedCharterRef {
  charterId: string;
  version: number;
  hash: string;
}

/**
 * Record an approval. The same intent sent again returns the stored record
 * rather than a second one; a different intent for the same version is refused.
 */
export function recordAcceptance(
  ledger: AcceptanceLedger,
  intent: AcceptanceIntent,
  charter: SealedCharterRef,
  participantIds: readonly string[],
  now: string,
  validUntil: string,
): AcceptanceResult {
  if (intent.nonce.length > 0 && ledger.usedNonces.includes(intent.nonce)) {
    const prior = ledger.records.find((r) => r.id === recordId(intent));
    if (prior && prior.actorId === intent.actorId) return { ok: true, ledger, record: prior, replayed: true };
    return fail("nonce_used");
  }
  if (Date.parse(now) >= Date.parse(intent.expiresAt)) return fail("intent_expired");
  if (!participantIds.includes(intent.actorId)) return fail("not_a_participant");
  if (intent.charterId !== charter.charterId || intent.charterVersion !== charter.version) return fail("version_mismatch");
  if (intent.charterHash !== charter.hash) return fail("hash_mismatch");
  if (!(Date.parse(validUntil) > Date.parse(now))) return fail("bad_validity");
  if (ledger.records.some((r) => r.actorId === intent.actorId && r.charterId === charter.charterId && r.charterVersion === charter.version && Date.parse(r.validUntil) > Date.parse(now))) {
    return fail("already_accepted");
  }
  const record: AcceptanceRecord = {
    id: recordId(intent),
    charterId: charter.charterId,
    charterVersion: charter.version,
    charterHash: charter.hash,
    actorId: intent.actorId,
    acceptedAt: now,
    validUntil,
  };
  return { ok: true, ledger: { records: [...ledger.records, record], usedNonces: [...ledger.usedNonces, intent.nonce] }, record, replayed: false };
}

function recordId(intent: AcceptanceIntent): string {
  return `acc-${intent.nonce}`;
}

/** Whether a person's approval of this exact charter is in force. */
export function hasValidAcceptance(ledger: AcceptanceLedger, actorId: string, charter: SealedCharterRef, now: string): boolean {
  return ledger.records.some(
    (r) => r.actorId === actorId && r.charterId === charter.charterId && r.charterVersion === charter.version && r.charterHash === charter.hash && Date.parse(r.validUntil) > Date.parse(now),
  );
}

/** Participants who still need to approve, expired approvals included. */
export function pendingAcceptors(ledger: AcceptanceLedger, participantIds: readonly string[], charter: SealedCharterRef, now: string): string[] {
  return participantIds.filter((id) => !hasValidAcceptance(ledger, id, charter, now));
}

export function allAccepted(ledger: AcceptanceLedger, participantIds: readonly string[], charter: SealedCharterRef, now: string): boolean {
  return participantIds.length > 0 && pendingAcceptors(ledger, participantIds, charter, now).length === 0;
}
