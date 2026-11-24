/**
 * Capstone consent ledger (CAPSTONE-105 / issue #1531).
 *
 * Provides purpose-specific, verifiable consent management for capstone and
 * research project participants. Participants independently inspect, grant,
 * and withdraw consent for distinct purposes with explicit lifecycle tracking,
 * optimistic concurrency, and idempotency.
 *
 * Privacy boundaries:
 * - Private proposal text, sensitive data, research content, and credentials
 *   are NEVER stored in consent records or emitted into audit entries.
 * - Audit records contain only non-sensitive event metadata (recordId,
 *   purpose, state transition, timestamps, revision, tenant).
 * - Client-side operations do not treat withdrawal as erasure of historical
 *   tamper-evident audit logs unless explicit server policy mandates it.
 */

export const CONSENT_PURPOSES = [
  "matching",
  "collaboration",
  "provider_access",
  "integrity_checks",
  "analytics",
  "publication",
  "credentials",
] as const;

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const CONSENT_STATES = [
  "pending",
  "granted",
  "withdrawn",
  "expired",
  "unavailable",
] as const;

export type ConsentState = (typeof CONSENT_STATES)[number];

export interface PurposeDefinition {
  purpose: ConsentPurpose;
  title: string;
  description: string;
  dataCovered: string;
  isOptional: boolean;
  isConsequentialOnWithdrawal: boolean;
  consequentialWarning?: string;
  category: "matching" | "workspace" | "verification" | "distribution";
}

export const PURPOSE_DEFINITIONS: Readonly<Record<ConsentPurpose, PurposeDefinition>> = {
  matching: {
    purpose: "matching",
    title: "Project & Mentor Matching",
    description: "Allow platform matching algorithms to suggest research projects and mentors based on your profile and skills.",
    dataCovered: "Academic profile, listed skill proficiencies, and research interests.",
    isOptional: true,
    isConsequentialOnWithdrawal: false,
    category: "matching",
  },
  collaboration: {
    purpose: "collaboration",
    title: "Project Workspace & Collaboration",
    description: "Participate in shared project workspaces, document authoring, and team communication channels.",
    dataCovered: "Workspace activity logs, collaborative comments, and assigned task submissions.",
    isOptional: false,
    isConsequentialOnWithdrawal: true,
    consequentialWarning: "Withdrawing workspace collaboration consent will suspend your write access to project documents and discussions until re-granted.",
    category: "workspace",
  },
  provider_access: {
    purpose: "provider_access",
    title: "Authorized Provider Access",
    description: "Allow certified computational, AI tooling, and dataset hosting providers access to project artifacts for research analysis.",
    dataCovered: "Targeted research inputs, model execution telemetry, and pipeline outputs.",
    isOptional: true,
    isConsequentialOnWithdrawal: true,
    consequentialWarning: "Withdrawing provider access may interrupt automated pipeline execution and external computational jobs.",
    category: "verification",
  },
  integrity_checks: {
    purpose: "integrity_checks",
    title: "Originality & Integrity Screening",
    description: "Submit project deliverables to automated plagiarism, citation verification, and research ethics checks.",
    dataCovered: "Submitted draft papers, milestone code repositories, and citation bibliographies.",
    isOptional: false,
    isConsequentialOnWithdrawal: true,
    consequentialWarning: "Integrity screening is required for milestone acceptance and funding disbursement. Withdrawing may pause milestone reviews.",
    category: "verification",
  },
  analytics: {
    purpose: "analytics",
    title: "Program Analytics & Evaluation",
    description: "Contribute anonymized, aggregated milestones and interaction telemetry to program efficacy research.",
    dataCovered: "Pseudonymized activity frequencies, milestone completion times, and aggregate success rates.",
    isOptional: true,
    isConsequentialOnWithdrawal: false,
    category: "distribution",
  },
  publication: {
    purpose: "publication",
    title: "Showcase & Repository Publication",
    description: "Display project abstracts, approved deliverables, and participant attribution on the public ChainVerse showcase.",
    dataCovered: "Final output summaries, public presentation decks, and author credit metadata.",
    isOptional: true,
    isConsequentialOnWithdrawal: false,
    category: "distribution",
  },
  credentials: {
    purpose: "credentials",
    title: "Verifiable Credential Minting",
    description: "Issue cryptographic completion badges and decentralized contributor credentials on the Stellar network.",
    dataCovered: "Participant public key, verified milestone completion proof, and role attributions.",
    isOptional: true,
    isConsequentialOnWithdrawal: false,
    category: "distribution",
  },
};

export interface ConsentRecord {
  id: string;
  projectId: string;
  participantId: string;
  organizationId: string;
  purpose: ConsentPurpose;
  state: ConsentState;
  required: boolean;
  providerId?: string;
  grantedAt?: string;
  withdrawnAt?: string;
  expiresAt?: string;
  updatedAt: string;
  revision: number;
}

export interface ConsentActor {
  id: string;
  organizationId: string;
  role: string;
}

export type ConsentErrorCode =
  | "UNKNOWN_PURPOSE"
  | "UNKNOWN_STATE"
  | "TENANT_MISMATCH"
  | "UNAUTHORIZED"
  | "INVALID_TRANSITION"
  | "STALE_REVISION"
  | "RECORD_NOT_FOUND"
  | "EXPIRED"
  | "UNAVAILABLE";

export type ConsentResult<T> =
  | { ok: true; value: T; replayed?: boolean }
  | { ok: false; code: ConsentErrorCode; message: string };

const ERROR_MESSAGES: Record<ConsentErrorCode, string> = {
  UNKNOWN_PURPOSE: "The requested consent purpose is not recognised.",
  UNKNOWN_STATE: "The consent state is invalid.",
  TENANT_MISMATCH: "Operation rejected across organization boundaries.",
  UNAUTHORIZED: "You are not authorized to modify this consent record.",
  INVALID_TRANSITION: "This consent transition is not permitted.",
  STALE_REVISION: "The consent record was updated elsewhere. Reload before retrying.",
  RECORD_NOT_FOUND: "The requested consent record could not be found.",
  EXPIRED: "This consent record has expired.",
  UNAVAILABLE: "This consent purpose is currently unavailable by policy.",
};

export function consentFail<T>(code: ConsentErrorCode, customMessage?: string): ConsentResult<T> {
  return { ok: false, code, message: customMessage ?? ERROR_MESSAGES[code] };
}

/** Allowed state transitions for participant consent */
const ALLOWED_TRANSITIONS: Record<ConsentState, readonly ConsentState[]> = {
  pending: ["granted", "withdrawn"],
  granted: ["withdrawn", "expired"],
  withdrawn: ["granted"],
  expired: ["granted"],
  unavailable: [],
};

export function isTransitionAllowed(from: ConsentState, to: ConsentState): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface GrantConsentInput {
  requestId: string;
  recordId: string;
  projectId: string;
  participantId: string;
  organizationId: string;
  purpose: ConsentPurpose;
  actor: ConsentActor;
  now: string;
  expectedRevision: number;
  expiresAt?: string;
  providerId?: string;
}

export interface WithdrawConsentInput {
  requestId: string;
  recordId: string;
  projectId: string;
  participantId: string;
  organizationId: string;
  actor: ConsentActor;
  now: string;
  expectedRevision: number;
}

export interface ConsentAuditEntry {
  eventType: "consent.granted" | "consent.withdrawn" | "consent.expired" | "consent.initialized";
  recordId: string;
  projectId: string;
  organizationId: string;
  participantId: string;
  purpose: ConsentPurpose;
  fromState: ConsentState;
  toState: ConsentState;
  revision: number;
  timestamp: string;
}

export type ConsentLedgerStore = {
  records: Map<string, ConsentRecord>;
  idempotencyCache: Map<string, ConsentResult<ConsentRecord>>;
  auditTrail: ConsentAuditEntry[];
};

export function createConsentLedgerStore(initialRecords: ConsentRecord[] = []): ConsentLedgerStore {
  const store: ConsentLedgerStore = {
    records: new Map(),
    idempotencyCache: new Map(),
    auditTrail: [],
  };
  for (const r of initialRecords) {
    store.records.set(r.id, { ...r });
  }
  return store;
}

/**
 * Initializes a full set of default consent records for a participant on a project.
 * Ensures every purpose is represented individually without blanket bundling.
 */
export function initializeProjectConsents(
  projectId: string,
  participantId: string,
  organizationId: string,
  now: string,
): ConsentRecord[] {
  return CONSENT_PURPOSES.map((purpose, index) => {
    const def = PURPOSE_DEFINITIONS[purpose];
    return {
      id: `cns_${projectId}_${participantId}_${purpose}`,
      projectId,
      participantId,
      organizationId,
      purpose,
      state: "pending",
      required: !def.isOptional,
      updatedAt: now,
      revision: 1,
    };
  });
}

/**
 * Grants consent for a specific purpose with concurrency and idempotency checks.
 */
export function grantConsent(
  store: ConsentLedgerStore,
  input: GrantConsentInput,
): ConsentResult<ConsentRecord> {
  const cached = store.idempotencyCache.get(input.requestId);
  if (cached) {
    return cached.ok ? { ...cached, replayed: true } : cached;
  }

  const recordResult = (res: ConsentResult<ConsentRecord>): ConsentResult<ConsentRecord> => {
    store.idempotencyCache.set(input.requestId, res);
    return res;
  };

  if (!CONSENT_PURPOSES.includes(input.purpose)) {
    return recordResult(consentFail("UNKNOWN_PURPOSE"));
  }

  if (input.actor.organizationId !== input.organizationId) {
    return recordResult(consentFail("TENANT_MISMATCH"));
  }

  // Only the participant themselves or an authorized administrator can grant consent
  if (input.actor.id !== input.participantId && input.actor.role !== "administrator") {
    return recordResult(consentFail("UNAUTHORIZED"));
  }

  let existing = store.records.get(input.recordId);
  if (!existing) {
    // If record doesn't exist yet, initialize it
    const def = PURPOSE_DEFINITIONS[input.purpose];
    existing = {
      id: input.recordId,
      projectId: input.projectId,
      participantId: input.participantId,
      organizationId: input.organizationId,
      purpose: input.purpose,
      state: "pending",
      required: !def.isOptional,
      updatedAt: input.now,
      revision: 1,
    };
    store.records.set(existing.id, existing);
  }

  if (existing.revision !== input.expectedRevision) {
    return recordResult(consentFail("STALE_REVISION"));
  }

  if (existing.state === "unavailable") {
    return recordResult(consentFail("UNAVAILABLE"));
  }

  if (!isTransitionAllowed(existing.state, "granted")) {
    return recordResult(consentFail("INVALID_TRANSITION", `Cannot grant consent from current state '${existing.state}'.`));
  }

  const fromState = existing.state;
  const updated: ConsentRecord = {
    ...existing,
    state: "granted",
    grantedAt: input.now,
    withdrawnAt: undefined,
    expiresAt: input.expiresAt,
    providerId: input.providerId ?? existing.providerId,
    updatedAt: input.now,
    revision: existing.revision + 1,
  };

  store.records.set(updated.id, updated);
  store.auditTrail.push({
    eventType: "consent.granted",
    recordId: updated.id,
    projectId: updated.projectId,
    organizationId: updated.organizationId,
    participantId: updated.participantId,
    purpose: updated.purpose,
    fromState,
    toState: "granted",
    revision: updated.revision,
    timestamp: input.now,
  });

  return recordResult({ ok: true, value: updated });
}

/**
 * Withdraws consent for a specific purpose with concurrency and idempotency checks.
 */
export function withdrawConsent(
  store: ConsentLedgerStore,
  input: WithdrawConsentInput,
): ConsentResult<ConsentRecord> {
  const cached = store.idempotencyCache.get(input.requestId);
  if (cached) {
    return cached.ok ? { ...cached, replayed: true } : cached;
  }

  const recordResult = (res: ConsentResult<ConsentRecord>): ConsentResult<ConsentRecord> => {
    store.idempotencyCache.set(input.requestId, res);
    return res;
  };

  if (input.actor.organizationId !== input.organizationId) {
    return recordResult(consentFail("TENANT_MISMATCH"));
  }

  if (input.actor.id !== input.participantId && input.actor.role !== "administrator") {
    return recordResult(consentFail("UNAUTHORIZED"));
  }

  const existing = store.records.get(input.recordId);
  if (!existing) {
    return recordResult(consentFail("RECORD_NOT_FOUND"));
  }

  if (existing.revision !== input.expectedRevision) {
    return recordResult(consentFail("STALE_REVISION"));
  }

  if (!isTransitionAllowed(existing.state, "withdrawn")) {
    return recordResult(consentFail("INVALID_TRANSITION", `Cannot withdraw consent from current state '${existing.state}'.`));
  }

  const fromState = existing.state;
  const updated: ConsentRecord = {
    ...existing,
    state: "withdrawn",
    withdrawnAt: input.now,
    updatedAt: input.now,
    revision: existing.revision + 1,
  };

  store.records.set(updated.id, updated);
  store.auditTrail.push({
    eventType: "consent.withdrawn",
    recordId: updated.id,
    projectId: updated.projectId,
    organizationId: updated.organizationId,
    participantId: updated.participantId,
    purpose: updated.purpose,
    fromState,
    toState: "withdrawn",
    revision: updated.revision,
    timestamp: input.now,
  });

  return recordResult({ ok: true, value: updated });
}

/**
 * Assesses whether a consent record is currently valid or expired.
 */
export function assessConsentValidity(record: ConsentRecord, now: string): ConsentState {
  if (record.state !== "granted") return record.state;
  if (record.expiresAt && Date.parse(record.expiresAt) <= Date.parse(now)) {
    return "expired";
  }
  return "granted";
}

/**
 * Filters audit records to ensure no sensitive payloads, proposals, or tokens leak.
 */
export function sanitizeAuditTrail(entries: readonly ConsentAuditEntry[]): ConsentAuditEntry[] {
  return entries.map((e) => ({
    eventType: e.eventType,
    recordId: e.recordId,
    projectId: e.projectId,
    organizationId: e.organizationId,
    participantId: e.participantId,
    purpose: e.purpose,
    fromState: e.fromState,
    toState: e.toState,
    revision: e.revision,
    timestamp: e.timestamp,
  }));
}
