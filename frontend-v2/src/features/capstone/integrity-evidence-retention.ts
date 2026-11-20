/**
 * Integrity evidence retention (CAPSTONE-104).
 *
 * Applies category-specific retention, deletion, legal holds, access logging
 * and secure disposal to reports, evidence, reviews and provider results.
 * Legal holds always win, immutable records are never disposed, and a record is
 * only deleted when its rule permits it and names a disposal method. Every
 * mutation is deny-by-default, tenant-scoped, guarded by an expected revision
 * and idempotent on its request id. Audit entries and analytics never carry
 * subject identities, hold reasons, access purposes or record content.
 */

export const EVIDENCE_CATEGORIES = ["report", "evidence", "review", "provider_result"] as const;
export type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number];

export const RETENTION_BASES = ["legal", "contractual", "operational"] as const;
export type RetentionBasis = (typeof RETENTION_BASES)[number];

export const RETENTION_ACTIONS = ["retain", "review", "delete", "blocked-by-hold", "blocked-immutable"] as const;
export type RetentionAction = (typeof RETENTION_ACTIONS)[number];

export const DISPOSAL_METHODS = ["secure_delete", "crypto_erase", "redact"] as const;
export type DisposalMethod = (typeof DISPOSAL_METHODS)[number];

export const EVIDENCE_STATUSES = ["active", "disposed"] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const HOLD_STATUSES = ["active", "released"] as const;
export type HoldStatus = (typeof HOLD_STATUSES)[number];

export const ACCESS_ACTIONS = ["view", "export", "download", "disclose"] as const;
export type AccessAction = (typeof ACCESS_ACTIONS)[number];

export const MAX_REASON_LENGTH = 500;
export const MAX_PURPOSE_LENGTH = 500;
export const ANALYTICS_MIN_GROUP = 3;

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export const isEvidenceCategory = (value: unknown): value is EvidenceCategory =>
  typeof value === "string" && (EVIDENCE_CATEGORIES as readonly string[]).includes(value);

export const isRetentionBasis = (value: unknown): value is RetentionBasis =>
  typeof value === "string" && (RETENTION_BASES as readonly string[]).includes(value);

export const isDisposalMethod = (value: unknown): value is DisposalMethod =>
  typeof value === "string" && (DISPOSAL_METHODS as readonly string[]).includes(value);

export const isEvidenceStatus = (value: unknown): value is EvidenceStatus =>
  typeof value === "string" && (EVIDENCE_STATUSES as readonly string[]).includes(value);

export const isHoldStatus = (value: unknown): value is HoldStatus =>
  typeof value === "string" && (HOLD_STATUSES as readonly string[]).includes(value);

export const isAccessAction = (value: unknown): value is AccessAction =>
  typeof value === "string" && (ACCESS_ACTIONS as readonly string[]).includes(value);

export interface RetentionRule {
  category: EvidenceCategory;
  /** Whole days after the last touch; `null` retains indefinitely. */
  retentionDays: number | null;
  basis: RetentionBasis;
  legalBasis: string;
  deletable: boolean;
  /** Required when `deletable` is true; omitted otherwise. */
  disposalMethod: DisposalMethod | null;
  owner: string;
}

export interface RetentionPolicy {
  version: string;
  rules: RetentionRule[];
  updatedAt: string;
  approvedBy: string;
}

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  version: "2026.04",
  updatedAt: "2026-04-01T00:00:00Z",
  approvedBy: "Integrity Council",
  rules: [
    {
      category: "report",
      retentionDays: 2555,
      basis: "legal",
      legalBasis: "Integrity reports are kept for the seven-year limitations period.",
      deletable: true,
      disposalMethod: "secure_delete",
      owner: "Integrity Office",
    },
    {
      category: "evidence",
      retentionDays: 2555,
      basis: "legal",
      legalBasis: "Evidence supporting an integrity decision is kept for the limitations period.",
      deletable: true,
      disposalMethod: "secure_delete",
      owner: "Integrity Office",
    },
    {
      category: "review",
      retentionDays: 1095,
      basis: "operational",
      legalBasis: "Review working papers are kept for three years for quality assurance.",
      deletable: true,
      disposalMethod: "redact",
      owner: "Review Operations",
    },
    {
      category: "provider_result",
      retentionDays: 365,
      basis: "contractual",
      legalBasis: "Provider verification results are kept for one year under the provider agreement.",
      deletable: true,
      disposalMethod: "crypto_erase",
      owner: "Verification Operations",
    },
  ],
};

export interface PolicyIssue {
  field: string;
  code: string;
  message: string;
}

/** Problems with a retention policy, or an empty list when it is valid. */
export function validateRetentionPolicy(policy: RetentionPolicy): PolicyIssue[] {
  const issues: PolicyIssue[] = [];
  const bad = (field: string, code: string, message: string) => issues.push({ field, code, message });

  if (policy.version.trim().length === 0) bad("version", "MISSING_VERSION", "give the policy a version");
  if (!ISO_INSTANT.test(policy.updatedAt)) bad("updatedAt", "INVALID_TIMESTAMP", "use an ISO 8601 UTC instant");
  if (policy.approvedBy.trim().length === 0) bad("approvedBy", "MISSING_APPROVER", "name the policy approver");

  const seen = new Set<EvidenceCategory>();
  policy.rules.forEach((rule, index) => {
    const at = `rules[${index}]`;
    if (!isEvidenceCategory(rule.category)) {
      bad(`${at}.category`, "UNKNOWN_CATEGORY", "choose a recognised evidence category");
    } else {
      if (seen.has(rule.category)) bad(`${at}.category`, "DUPLICATE_CATEGORY", "each category needs exactly one rule");
      seen.add(rule.category);
    }
    if (rule.retentionDays !== null && (!Number.isInteger(rule.retentionDays) || rule.retentionDays < 1)) {
      bad(`${at}.retentionDays`, "INVALID_RETENTION", "retention days must be null or a positive integer");
    }
    if (!isRetentionBasis(rule.basis)) bad(`${at}.basis`, "UNKNOWN_BASIS", "choose legal, contractual or operational");
    if (rule.legalBasis.trim().length === 0) bad(`${at}.legalBasis`, "MISSING_LEGAL_BASIS", "state the legal basis");
    if (rule.owner.trim().length === 0) bad(`${at}.owner`, "MISSING_OWNER", "name the rule owner");
    if (rule.deletable && !isDisposalMethod(rule.disposalMethod)) {
      bad(`${at}.disposalMethod`, "MISSING_DISPOSAL", "a deletable rule needs a secure disposal method");
    }
    if (!rule.deletable && rule.disposalMethod !== null) {
      bad(`${at}.disposalMethod`, "UNEXPECTED_DISPOSAL", "a non-deletable rule cannot name a disposal method");
    }
  });

  for (const category of EVIDENCE_CATEGORIES) {
    if (!seen.has(category)) bad("rules", "MISSING_CATEGORY", `add a rule for ${category}`);
  }
  return issues;
}

export interface EvidenceRecord {
  id: string;
  organizationId: string;
  /** The case, report or participant the evidence belongs to. */
  subjectId: string;
  category: EvidenceCategory;
  status: EvidenceStatus;
  revision: number;
  createdAt: string;
  lastTouchedAt?: string;
  /** Records linked to a safety or financial obligation are never disposed. */
  immutable?: boolean;
  /** Reviewers assigned to this record for read access. */
  assignedReviewerIds?: string[];
  disposalMethod?: DisposalMethod;
  disposedAt?: string;
  disposedBy?: string;
}

export interface LegalHold {
  id: string;
  organizationId: string;
  subjectId: string;
  categories: EvidenceCategory[];
  reason: string;
  status: HoldStatus;
  revision: number;
  placedAt: string;
  placedBy: string;
  releasedAt?: string;
  releasedBy?: string;
}

export interface RetentionAssessment {
  recordId: string;
  category: EvidenceCategory;
  action: RetentionAction;
  reason: string;
  retentionDaysRemaining: number | null;
  protectedBy: "legal-hold" | "immutable" | null;
  disposalMethod: DisposalMethod | null;
  holdId?: string;
}

/** Whole days until the window closes; negative after expiry and null when indefinite. */
export function daysUntilExpiry(record: EvidenceRecord, rule: RetentionRule, now: Date): number | null {
  if (rule.retentionDays === null) return null;
  const anchor = Date.parse(record.lastTouchedAt ?? record.createdAt);
  if (!Number.isFinite(anchor)) return null;
  const expiry = anchor + rule.retentionDays * DAY_MS;
  return Math.ceil((expiry - now.getTime()) / DAY_MS);
}

/** The active hold covering this record, if any. */
export function findActiveHold(record: EvidenceRecord, holds: readonly LegalHold[]): LegalHold | undefined {
  return holds.find(
    (hold) =>
      hold.status === "active" &&
      hold.organizationId === record.organizationId &&
      hold.categories.includes(record.category) &&
      (hold.subjectId === record.id || hold.subjectId === record.subjectId),
  );
}

export function ruleForCategory(policy: RetentionPolicy, category: EvidenceCategory): RetentionRule | undefined {
  return policy.rules.find((rule) => rule.category === category);
}

export function assessRetention(
  rule: RetentionRule,
  record: EvidenceRecord,
  now: Date,
  holds: readonly LegalHold[],
): RetentionAssessment {
  const remaining = daysUntilExpiry(record, rule, now);
  const base = {
    recordId: record.id,
    category: record.category,
    retentionDaysRemaining: remaining,
  };

  const hold = findActiveHold(record, holds);
  if (hold) {
    return {
      ...base,
      action: "blocked-by-hold",
      reason: `Legal hold ${hold.id} covers this record until it is released.`,
      protectedBy: "legal-hold",
      disposalMethod: null,
      holdId: hold.id,
    };
  }

  if (record.immutable) {
    return {
      ...base,
      action: "blocked-immutable",
      reason: "This record is linked to a safety or financial obligation and is never disposed.",
      protectedBy: "immutable",
      disposalMethod: null,
    };
  }

  if (rule.retentionDays === null) {
    return {
      ...base,
      action: "retain",
      reason: `Retained indefinitely on a ${rule.basis} basis (${rule.legalBasis}).`,
      protectedBy: null,
      disposalMethod: null,
    };
  }

  if (remaining === null) {
    return {
      ...base,
      action: "retain",
      reason: "The retention anchor is not a readable date, so the record is retained.",
      protectedBy: null,
      disposalMethod: null,
    };
  }

  if (remaining > 0) {
    return {
      ...base,
      action: "retain",
      reason: `Inside the ${rule.retentionDays}-day window with ${remaining} day(s) remaining.`,
      protectedBy: null,
      disposalMethod: null,
    };
  }

  if (remaining === 0) {
    return {
      ...base,
      action: "review",
      reason: `The ${rule.retentionDays}-day window closes today; review before the next sweep.`,
      protectedBy: null,
      disposalMethod: rule.disposalMethod,
    };
  }

  if (!rule.deletable || rule.disposalMethod === null) {
    return {
      ...base,
      action: "retain",
      reason: `The window expired ${Math.abs(remaining)} day(s) ago but the rule does not permit disposal.`,
      protectedBy: null,
      disposalMethod: null,
    };
  }

  return {
    ...base,
    action: "delete",
    reason: `The ${rule.retentionDays}-day window expired ${Math.abs(remaining)} day(s) ago.`,
    protectedBy: null,
    disposalMethod: rule.disposalMethod,
  };
}

export interface DisposalPlanItem {
  recordId: string;
  category: EvidenceCategory;
  disposalMethod: DisposalMethod;
}

export interface DisposalPlan {
  policyVersion: string;
  generatedAt: string;
  assessments: RetentionAssessment[];
  deletable: DisposalPlanItem[];
  retained: RetentionAssessment[];
  blockedByHolds: string[];
  immutable: string[];
}

/** Plan what may be disposed, what must stay, and why. Never deletes anything itself. */
export function planDisposal(
  policy: RetentionPolicy,
  records: readonly EvidenceRecord[],
  holds: readonly LegalHold[],
  now: Date,
): DisposalPlan {
  const assessments: RetentionAssessment[] = [];
  const deletable: DisposalPlanItem[] = [];
  const retained: RetentionAssessment[] = [];
  const blockedByHolds = new Set<string>();
  const immutable: string[] = [];

  for (const record of records) {
    const rule = ruleForCategory(policy, record.category);
    if (!rule) {
      retained.push({
        recordId: record.id,
        category: record.category,
        action: "retain",
        reason: "No retention rule exists for this category, so the record is retained.",
        retentionDaysRemaining: null,
        protectedBy: "immutable",
        disposalMethod: null,
      });
      immutable.push(record.id);
      continue;
    }

    const assessment = assessRetention(rule, record, now, holds);
    assessments.push(assessment);
    if (assessment.action === "delete" && assessment.disposalMethod) {
      deletable.push({ recordId: record.id, category: record.category, disposalMethod: assessment.disposalMethod });
      continue;
    }
    retained.push(assessment);
    if (assessment.holdId) blockedByHolds.add(assessment.holdId);
    if (assessment.action === "blocked-immutable") immutable.push(record.id);
  }

  return {
    policyVersion: policy.version,
    generatedAt: now.toISOString(),
    assessments,
    deletable,
    retained,
    blockedByHolds: [...blockedByHolds],
    immutable,
  };
}

export const EVIDENCE_ACTOR_ROLES = ["reviewer", "safety_officer", "auditor", "organization_admin"] as const;
export type EvidenceActorRole = (typeof EVIDENCE_ACTOR_ROLES)[number];

export const EVIDENCE_ACTIONS = [
  "evidence.view",
  "evidence.export",
  "evidence.dispose",
  "evidence.hold.place",
  "evidence.hold.release",
  "evidence.retention.manage",
  "evidence.access_log_view",
] as const;
export type EvidenceAction = (typeof EVIDENCE_ACTIONS)[number];

export const EVIDENCE_SCOPES = ["assigned", "organization"] as const;
export type EvidenceScope = (typeof EVIDENCE_SCOPES)[number];

export const EVIDENCE_PERMISSIONS: Readonly<Record<EvidenceActorRole, Partial<Record<EvidenceAction, EvidenceScope>>>> = {
  reviewer: {
    "evidence.view": "assigned",
  },
  safety_officer: {
    "evidence.view": "organization",
    "evidence.export": "organization",
    "evidence.hold.place": "organization",
    "evidence.access_log_view": "organization",
  },
  auditor: {
    "evidence.view": "organization",
    "evidence.access_log_view": "organization",
  },
  organization_admin: {
    "evidence.view": "organization",
    "evidence.export": "organization",
    "evidence.dispose": "organization",
    "evidence.hold.place": "organization",
    "evidence.hold.release": "organization",
    "evidence.retention.manage": "organization",
    "evidence.access_log_view": "organization",
  },
};

/** Actions a role may never perform, even if a future grant lists them (separation of duties). */
export const EVIDENCE_FORBIDDEN: Readonly<Partial<Record<EvidenceActorRole, readonly EvidenceAction[]>>> = {
  reviewer: [
    "evidence.export",
    "evidence.dispose",
    "evidence.hold.place",
    "evidence.hold.release",
    "evidence.retention.manage",
    "evidence.access_log_view",
  ],
  safety_officer: ["evidence.dispose", "evidence.hold.release", "evidence.retention.manage"],
  auditor: ["evidence.export", "evidence.dispose", "evidence.hold.place", "evidence.hold.release", "evidence.retention.manage"],
  organization_admin: [],
};

export interface EvidenceActor {
  id: string;
  role: EvidenceActorRole;
  organizationId: string;
}

export interface EvidenceResource {
  organizationId: string;
  subjectId?: string;
  recordId?: string;
  /** Reviewers assigned to this subject. */
  assignedIds?: readonly string[];
}

export type EvidenceAuthorizationReason =
  | "UNKNOWN_ROLE"
  | "UNKNOWN_ACTION"
  | "FORBIDDEN_FOR_ROLE"
  | "NOT_GRANTED"
  | "TENANT_MISMATCH"
  | "NOT_ASSIGNED";

export type EvidenceAuthorizationDecision =
  | { allowed: true }
  | { allowed: false; reason: EvidenceAuthorizationReason };

/** Deny-by-default authorization with tenant and reviewer-assignment boundaries. */
export function authorizeEvidence(
  actor: EvidenceActor,
  action: EvidenceAction,
  resource: EvidenceResource,
): EvidenceAuthorizationDecision {
  if (!(EVIDENCE_ACTOR_ROLES as readonly string[]).includes(actor.role)) return { allowed: false, reason: "UNKNOWN_ROLE" };
  if (!(EVIDENCE_ACTIONS as readonly string[]).includes(action)) return { allowed: false, reason: "UNKNOWN_ACTION" };
  if (EVIDENCE_FORBIDDEN[actor.role]?.includes(action)) return { allowed: false, reason: "FORBIDDEN_FOR_ROLE" };

  const scope = EVIDENCE_PERMISSIONS[actor.role][action];
  if (scope === undefined) return { allowed: false, reason: "NOT_GRANTED" };
  if (actor.organizationId !== resource.organizationId) return { allowed: false, reason: "TENANT_MISMATCH" };
  if (scope === "organization") return { allowed: true };
  return resource.assignedIds?.includes(actor.id) ? { allowed: true } : { allowed: false, reason: "NOT_ASSIGNED" };
}

export function evidenceActionsFor(role: EvidenceActorRole): EvidenceAction[] {
  return (Object.keys(EVIDENCE_PERMISSIONS[role]) as EvidenceAction[])
    .filter((action) => !EVIDENCE_FORBIDDEN[role]?.includes(action))
    .sort();
}

const resourceOfRecord = (record: EvidenceRecord): EvidenceResource => ({
  organizationId: record.organizationId,
  subjectId: record.subjectId,
  recordId: record.id,
  assignedIds: record.assignedReviewerIds,
});

const resourceOfHold = (hold: LegalHold): EvidenceResource => ({
  organizationId: hold.organizationId,
  subjectId: hold.subjectId,
});

export interface LegalHoldInput {
  id: string;
  organizationId: string;
  subjectId: string;
  categories: string[];
  reason: string;
  now: string;
}

export interface HoldValidationIssue {
  field: string;
  code: string;
  message: string;
}

export function validateLegalHoldInput(input: LegalHoldInput): HoldValidationIssue[] {
  const issues: HoldValidationIssue[] = [];
  const bad = (field: string, code: string, message: string) => issues.push({ field, code, message });

  if (input.id.trim().length === 0) bad("id", "MISSING_ID", "give the hold an id");
  if (input.organizationId.trim().length === 0) bad("organizationId", "MISSING_ORGANIZATION", "the hold needs an organization");
  if (input.subjectId.trim().length === 0) bad("subjectId", "MISSING_SUBJECT", "name the held subject or record");
  if (input.categories.length === 0) bad("categories", "NO_CATEGORIES", "name at least one category");
  const seen = new Set<string>();
  input.categories.forEach((category, index) => {
    if (!isEvidenceCategory(category)) bad(`categories[${index}]`, "UNKNOWN_CATEGORY", "choose a recognised evidence category");
    if (seen.has(category)) bad(`categories[${index}]`, "DUPLICATE_CATEGORY", "categories must be unique");
    seen.add(category);
  });
  if (input.reason.trim().length === 0 || input.reason.length > MAX_REASON_LENGTH) {
    bad("reason", "INVALID_REASON", `give a reason of 1 to ${MAX_REASON_LENGTH} characters`);
  }
  if (!ISO_INSTANT.test(input.now)) bad("now", "INVALID_TIMESTAMP", "use an ISO 8601 UTC instant");
  return issues;
}

export type PlaceLegalHoldErrorCode = "NOT_AUTHORIZED" | "INVALID_HOLD" | "DUPLICATE_HOLD_ID";

export type PlaceLegalHoldResult =
  | { ok: true; hold: LegalHold; replayed: boolean }
  | { ok: false; code: PlaceLegalHoldErrorCode; message: string; issues?: HoldValidationIssue[] };

export type PlaceLegalHoldLedger = Map<string, PlaceLegalHoldResult>;

export interface PlaceLegalHoldRequest {
  requestId: string;
  actor: EvidenceActor;
  input: LegalHoldInput;
}

export function placeLegalHold(
  request: PlaceLegalHoldRequest,
  existing: readonly LegalHold[],
  ledger: PlaceLegalHoldLedger = new Map(),
): PlaceLegalHoldResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;

  const store = (result: PlaceLegalHoldResult): PlaceLegalHoldResult => {
    ledger.set(request.requestId, result);
    return result;
  };
  const fail = (
    code: PlaceLegalHoldErrorCode,
    message: string,
    issues?: HoldValidationIssue[],
  ): PlaceLegalHoldResult => store({ ok: false, code, message, ...(issues ? { issues } : {}) });

  const decision = authorizeEvidence(request.actor, "evidence.hold.place", resourceOfHoldInput(request.input));
  if (!decision.allowed) return fail("NOT_AUTHORIZED", `You cannot place this hold (${decision.reason}).`);

  const issues = validateLegalHoldInput(request.input);
  if (issues.length > 0) return fail("INVALID_HOLD", "The hold needs changes before it can be placed.", issues);
  if (existing.some((hold) => hold.id === request.input.id)) {
    return fail("DUPLICATE_HOLD_ID", "A hold with this id already exists.");
  }

  const categories = [...new Set(request.input.categories as EvidenceCategory[])].sort();
  const duplicate = existing.find(
    (hold) =>
      hold.status === "active" &&
      hold.organizationId === request.input.organizationId &&
      hold.subjectId === request.input.subjectId &&
      hold.categories.length === categories.length &&
      hold.categories.every((category) => categories.includes(category)),
  );
  if (duplicate) return store({ ok: true, hold: duplicate, replayed: true });

  return store({
    ok: true,
    replayed: false,
    hold: {
      id: request.input.id,
      organizationId: request.input.organizationId,
      subjectId: request.input.subjectId,
      categories,
      reason: request.input.reason,
      status: "active",
      revision: 1,
      placedAt: request.input.now,
      placedBy: request.actor.id,
    },
  });
}

function resourceOfHoldInput(input: LegalHoldInput): EvidenceResource {
  return { organizationId: input.organizationId, subjectId: input.subjectId };
}

export type ReleaseLegalHoldErrorCode = "NOT_AUTHORIZED" | "STALE_REVISION" | "INVALID_STATE";

export type ReleaseLegalHoldResult =
  | { ok: true; hold: LegalHold; replayed: boolean }
  | { ok: false; code: ReleaseLegalHoldErrorCode; message: string };

export type ReleaseLegalHoldLedger = Map<string, ReleaseLegalHoldResult>;

export interface ReleaseLegalHoldRequest {
  requestId: string;
  actor: EvidenceActor;
  expectedRevision: number;
  now: string;
}

export function releaseLegalHold(
  hold: LegalHold,
  request: ReleaseLegalHoldRequest,
  ledger: ReleaseLegalHoldLedger = new Map(),
): ReleaseLegalHoldResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;

  const store = (result: ReleaseLegalHoldResult): ReleaseLegalHoldResult => {
    ledger.set(request.requestId, result);
    return result;
  };
  const fail = (code: ReleaseLegalHoldErrorCode, message: string): ReleaseLegalHoldResult => store({ ok: false, code, message });

  const decision = authorizeEvidence(request.actor, "evidence.hold.release", resourceOfHold(hold));
  if (!decision.allowed) return fail("NOT_AUTHORIZED", `You cannot release this hold (${decision.reason}).`);
  if (request.expectedRevision !== hold.revision) {
    return fail("STALE_REVISION", `The hold changed (revision ${hold.revision}); reload before retrying.`);
  }
  if (hold.status !== "active") return fail("INVALID_STATE", "Only an active hold can be released.");

  return store({
    ok: true,
    replayed: false,
    hold: {
      ...hold,
      status: "released",
      revision: hold.revision + 1,
      releasedAt: request.now,
      releasedBy: request.actor.id,
    },
  });
}

export type DisposeEvidenceErrorCode = "NOT_AUTHORIZED" | "STALE_REVISION" | "INVALID_STATE" | "NOT_DISPOSABLE" | "RECORD_MISMATCH";

export type DisposeEvidenceResult =
  | { ok: true; record: EvidenceRecord; replayed: boolean }
  | { ok: false; code: DisposeEvidenceErrorCode; message: string };

export type DisposeEvidenceLedger = Map<string, DisposeEvidenceResult>;

export interface DisposeEvidenceRequest {
  requestId: string;
  actor: EvidenceActor;
  expectedRevision: number;
  now: string;
}

export function disposeEvidence(
  record: EvidenceRecord,
  assessment: RetentionAssessment,
  request: DisposeEvidenceRequest,
  ledger: DisposeEvidenceLedger = new Map(),
): DisposeEvidenceResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;

  const store = (result: DisposeEvidenceResult): DisposeEvidenceResult => {
    ledger.set(request.requestId, result);
    return result;
  };
  const fail = (code: DisposeEvidenceErrorCode, message: string): DisposeEvidenceResult => store({ ok: false, code, message });

  const decision = authorizeEvidence(request.actor, "evidence.dispose", resourceOfRecord(record));
  if (!decision.allowed) return fail("NOT_AUTHORIZED", `You cannot dispose this record (${decision.reason}).`);
  if (request.expectedRevision !== record.revision) {
    return fail("STALE_REVISION", `The record changed (revision ${record.revision}); reload before retrying.`);
  }
  if (record.status !== "active") return fail("INVALID_STATE", "Only an active record can be disposed.");
  if (assessment.recordId !== record.id || assessment.category !== record.category) {
    return fail("RECORD_MISMATCH", "The assessment does not belong to this record.");
  }
  if (assessment.action !== "delete" || !assessment.disposalMethod) {
    return fail("NOT_DISPOSABLE", `The current assessment does not allow disposal (${assessment.action}).`);
  }

  return store({
    ok: true,
    replayed: false,
    record: {
      ...record,
      status: "disposed",
      revision: record.revision + 1,
      disposedAt: request.now,
      disposedBy: request.actor.id,
      disposalMethod: assessment.disposalMethod,
    },
  });
}

export interface EvidenceAccessEvent {
  id: string;
  organizationId: string;
  recordId: string;
  category: EvidenceCategory;
  actorId: string;
  action: AccessAction;
  at: string;
  /** Private purpose text; never copied into audit entries or analytics. */
  purpose?: string;
}

export type LogEvidenceAccessErrorCode = "NOT_AUTHORIZED" | "INVALID_STATE" | "INVALID_ACCESS" | "PURPOSE_TOO_LONG";

export type LogEvidenceAccessResult =
  | { ok: true; event: EvidenceAccessEvent; replayed: boolean }
  | { ok: false; code: LogEvidenceAccessErrorCode; message: string };

export type LogEvidenceAccessLedger = Map<string, LogEvidenceAccessResult>;

export interface LogEvidenceAccessRequest {
  requestId: string;
  actor: EvidenceActor;
  action: string;
  purpose?: string;
  now: string;
}

const ACCESS_PERMISSION: Record<AccessAction, EvidenceAction> = {
  view: "evidence.view",
  export: "evidence.export",
  download: "evidence.export",
  disclose: "evidence.export",
};

export function logEvidenceAccess(
  record: EvidenceRecord,
  request: LogEvidenceAccessRequest,
  ledger: LogEvidenceAccessLedger = new Map(),
): LogEvidenceAccessResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;

  const store = (result: LogEvidenceAccessResult): LogEvidenceAccessResult => {
    ledger.set(request.requestId, result);
    return result;
  };
  const fail = (code: LogEvidenceAccessErrorCode, message: string): LogEvidenceAccessResult => store({ ok: false, code, message });

  if (!isAccessAction(request.action)) return fail("INVALID_ACCESS", "choose a recognised access action");
  const decision = authorizeEvidence(request.actor, ACCESS_PERMISSION[request.action], resourceOfRecord(record));
  if (!decision.allowed) return fail("NOT_AUTHORIZED", `You cannot access this record (${decision.reason}).`);
  if (record.status !== "active") return fail("INVALID_STATE", "A disposed record cannot be accessed.");
  if (request.purpose !== undefined && request.purpose.length > MAX_PURPOSE_LENGTH) {
    return fail("PURPOSE_TOO_LONG", `a purpose can be at most ${MAX_PURPOSE_LENGTH} characters`);
  }

  return store({
    ok: true,
    replayed: false,
    event: {
      id: `evt_${request.requestId}`,
      organizationId: record.organizationId,
      recordId: record.id,
      category: record.category,
      actorId: request.actor.id,
      action: request.action,
      at: request.now,
      ...(request.purpose !== undefined ? { purpose: request.purpose } : {}),
    },
  });
}

export interface EvidenceAuditEntry {
  eventType: string;
  recordId: string;
  organizationId: string;
  category: EvidenceCategory;
  status: EvidenceStatus;
  revision: number;
  action?: RetentionAction;
  at: string;
}

/**
 * A privacy-safe audit entry. It omits subject ids, hold reasons, access
 * purposes, actor ids, free text and record content.
 */
export function evidenceAuditEntry(
  record: EvidenceRecord,
  eventType: string,
  at: string,
  assessment?: RetentionAssessment,
): EvidenceAuditEntry {
  return {
    eventType,
    recordId: record.id,
    organizationId: record.organizationId,
    category: record.category,
    status: record.status,
    revision: record.revision,
    ...(assessment ? { action: assessment.action } : {}),
    at,
  };
}

export interface RetentionAnalyticsSummary {
  total: number;
  byCategory: Array<{ category: EvidenceCategory; count: number }>;
  byAction: Array<{ action: RetentionAction; count: number }>;
  suppressedCategories: number;
  suppressedActions: number;
}

/** Aggregate retention actions by category with small groups suppressed; no ids or subjects. */
export function summarizeRetention(
  assessments: readonly RetentionAssessment[],
  minGroupSize: number = ANALYTICS_MIN_GROUP,
): RetentionAnalyticsSummary {
  const categoryCounts = new Map<EvidenceCategory, number>();
  const actionCounts = new Map<RetentionAction, number>();
  for (const assessment of assessments) {
    categoryCounts.set(assessment.category, (categoryCounts.get(assessment.category) ?? 0) + 1);
    actionCounts.set(assessment.action, (actionCounts.get(assessment.action) ?? 0) + 1);
  }

  const threshold = Math.max(1, minGroupSize);
  const byCategory: RetentionAnalyticsSummary["byCategory"] = [];
  let suppressedCategories = 0;
  for (const category of EVIDENCE_CATEGORIES) {
    const count = categoryCounts.get(category) ?? 0;
    if (count === 0) continue;
    if (count < threshold) suppressedCategories += 1;
    else byCategory.push({ category, count });
  }

  const byAction: RetentionAnalyticsSummary["byAction"] = [];
  let suppressedActions = 0;
  for (const action of RETENTION_ACTIONS) {
    const count = actionCounts.get(action) ?? 0;
    if (count === 0) continue;
    if (count < threshold) suppressedActions += 1;
    else byAction.push({ action, count });
  }

  return { total: assessments.length, byCategory, byAction, suppressedCategories, suppressedActions };
}

export interface AccessAnalyticsSummary {
  total: number;
  byAction: Array<{ action: AccessAction; count: number }>;
  suppressedActions: number;
}

/** Aggregate access counts by action with small groups suppressed; no actors or purposes. */
export function summarizeAccessEvents(
  events: readonly EvidenceAccessEvent[],
  minGroupSize: number = ANALYTICS_MIN_GROUP,
): AccessAnalyticsSummary {
  const counts = new Map<AccessAction, number>();
  for (const event of events) counts.set(event.action, (counts.get(event.action) ?? 0) + 1);

  const threshold = Math.max(1, minGroupSize);
  const byAction: AccessAnalyticsSummary["byAction"] = [];
  let suppressedActions = 0;
  for (const action of ACCESS_ACTIONS) {
    const count = counts.get(action) ?? 0;
    if (count === 0) continue;
    if (count < threshold) suppressedActions += 1;
    else byAction.push({ action, count });
  }
  return { total: events.length, byAction, suppressedActions };
}
