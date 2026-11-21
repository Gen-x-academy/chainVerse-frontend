/**
 * Contributor attribution registry (CAPSTONE-089).
 *
 * Records versioned contributor roles, declared contributions, approvals,
 * disputes and output linkage against the recognised CRediT contribution
 * taxonomy. Every mutation is deny-by-default, stays inside one organization,
 * is guarded by an expected revision (stale requests are rejected), and is
 * idempotent on its request id so retries cannot duplicate approvals,
 * disputes or versions. Private text and contributor identities never appear
 * in audit entries or analytics aggregates.
 */

/** The 14 CRediT contributor roles; a stable, recognised contribution taxonomy. */
export const CONTRIBUTION_KINDS = [
  "conceptualization",
  "methodology",
  "software",
  "validation",
  "formal_analysis",
  "investigation",
  "resources",
  "data_curation",
  "writing_original_draft",
  "writing_review_editing",
  "visualization",
  "supervision",
  "project_administration",
  "funding_acquisition",
] as const;
export type ContributionKind = (typeof CONTRIBUTION_KINDS)[number];

export const CONTRIBUTION_KIND_LABELS: Readonly<Record<ContributionKind, string>> = {
  conceptualization: "Conceptualization",
  methodology: "Methodology",
  software: "Software",
  validation: "Validation",
  formal_analysis: "Formal analysis",
  investigation: "Investigation",
  resources: "Resources",
  data_curation: "Data curation",
  writing_original_draft: "Writing - original draft",
  writing_review_editing: "Writing - review & editing",
  visualization: "Visualization",
  supervision: "Supervision",
  project_administration: "Project administration",
  funding_acquisition: "Funding acquisition",
};

/** The role a contributor holds on the attribution, independent of CRediT work. */
export const ATTRIBUTION_ROLES = [
  "lead_author",
  "co_author",
  "contributing_author",
  "editor",
  "reviewer",
  "translator",
  "data_steward",
  "supervisor",
  "adviser",
  "funder",
] as const;
export type AttributionRole = (typeof ATTRIBUTION_ROLES)[number];

export const ATTRIBUTION_ROLE_LABELS: Readonly<Record<AttributionRole, string>> = {
  lead_author: "Lead author",
  co_author: "Co-author",
  contributing_author: "Contributing author",
  editor: "Editor",
  reviewer: "Reviewer",
  translator: "Translator",
  data_steward: "Data steward",
  supervisor: "Supervisor",
  adviser: "Adviser",
  funder: "Funder",
};

export const CONTRIBUTION_LEVELS = ["lead", "equal", "supporting"] as const;
export type ContributionLevel = (typeof CONTRIBUTION_LEVELS)[number];

export const ATTRIBUTION_STATUSES = ["draft", "submitted", "approved", "rejected", "superseded"] as const;
export type AttributionStatus = (typeof ATTRIBUTION_STATUSES)[number];

export const DISPUTE_REASONS = [
  "misattribution",
  "missing_credit",
  "incorrect_role",
  "incorrect_contribution",
  "output_link",
  "other",
] as const;
export type DisputeReason = (typeof DISPUTE_REASONS)[number];

export const DISPUTE_STATUSES = ["open", "upheld", "rejected", "withdrawn"] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const MAX_CONTRIBUTIONS = CONTRIBUTION_KINDS.length;
export const MAX_NOTE_LENGTH = 500;
export const ANALYTICS_MIN_GROUP = 3;

export const normalizeTaxonomyTerm = (text: string): string =>
  text
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

const CONTRIBUTION_ALIASES: Readonly<Record<string, ContributionKind>> = {
  concept: "conceptualization",
  concepts: "conceptualization",
  methods: "methodology",
  code: "software",
  verification: "validation",
  "formal analysis": "formal_analysis",
  "data curation": "data_curation",
  "writing original draft": "writing_original_draft",
  "original draft": "writing_original_draft",
  "writing review editing": "writing_review_editing",
  "review and editing": "writing_review_editing",
  visualisation: "visualization",
  "project administration": "project_administration",
  "funding acquisition": "funding_acquisition",
};

const KIND_TERMS = new Map<string, ContributionKind>();
for (const kind of CONTRIBUTION_KINDS) {
  KIND_TERMS.set(normalizeTaxonomyTerm(kind), kind);
  KIND_TERMS.set(normalizeTaxonomyTerm(CONTRIBUTION_KIND_LABELS[kind]), kind);
}
for (const [term, kind] of Object.entries(CONTRIBUTION_ALIASES)) KIND_TERMS.set(normalizeTaxonomyTerm(term), kind);

/** Resolve a free-text term to a recognised contribution kind, or `null`. */
export function resolveContributionKind(value: string): ContributionKind | null {
  return KIND_TERMS.get(normalizeTaxonomyTerm(value)) ?? null;
}

const ROLE_ALIASES: Readonly<Record<string, AttributionRole>> = {
  "first author": "lead_author",
  first_author: "lead_author",
  coauthor: "co_author",
  "co author": "co_author",
  contributor: "contributing_author",
  "data steward": "data_steward",
  advisor: "adviser",
  funder: "funder",
};

const ROLE_TERMS = new Map<string, AttributionRole>();
for (const role of ATTRIBUTION_ROLES) {
  ROLE_TERMS.set(normalizeTaxonomyTerm(role), role);
  ROLE_TERMS.set(normalizeTaxonomyTerm(ATTRIBUTION_ROLE_LABELS[role]), role);
}
for (const [term, role] of Object.entries(ROLE_ALIASES)) ROLE_TERMS.set(normalizeTaxonomyTerm(term), role);

export function resolveAttributionRole(value: string): AttributionRole | null {
  return ROLE_TERMS.get(normalizeTaxonomyTerm(value)) ?? null;
}

export const isContributionKind = (value: unknown): value is ContributionKind =>
  typeof value === "string" && (CONTRIBUTION_KINDS as readonly string[]).includes(value);

export const isAttributionRole = (value: unknown): value is AttributionRole =>
  typeof value === "string" && (ATTRIBUTION_ROLES as readonly string[]).includes(value);

export const isContributionLevel = (value: unknown): value is ContributionLevel =>
  typeof value === "string" && (CONTRIBUTION_LEVELS as readonly string[]).includes(value);

export const isDisputeReason = (value: unknown): value is DisputeReason =>
  typeof value === "string" && (DISPUTE_REASONS as readonly string[]).includes(value);

export type OutputKind = "document" | "dataset" | "code" | "artifact" | "media" | "other";

/** A project output a contribution can point at. */
export interface ProjectOutput {
  id: string;
  projectId: string;
  kind: OutputKind;
}

export interface DeclaredContribution {
  kind: ContributionKind;
  level: ContributionLevel;
  /** Outputs this contribution produced; may be empty for non-output work. */
  outputIds: string[];
  /** Private free text; never copied into audit entries or analytics. */
  note?: string;
}

export interface AttributionApproval {
  approverId: string;
  decision: "approved" | "rejected";
  at: string;
  /** Private free text; never copied into audit entries. */
  note?: string;
}

export interface AttributionRecord {
  id: string;
  organizationId: string;
  projectId: string;
  contributorId: string;
  role: AttributionRole;
  status: AttributionStatus;
  /** Immutable lineage version; a revision creates the next version. */
  version: number;
  /** Increases by one on every applied change to this version. */
  revision: number;
  contributions: DeclaredContribution[];
  requiredApproverIds: string[];
  approvals: AttributionApproval[];
  createdAt: string;
  updatedAt: string;
}

export interface AttributionDispute {
  id: string;
  attributionId: string;
  version: number;
  raisedById: string;
  reason: DisputeReason;
  status: DisputeStatus;
  raisedAt: string;
  resolvedAt?: string;
  resolvedById?: string;
  /** Private free text; never copied into audit entries. */
  note?: string;
}

export interface AttributionValidationContext {
  organizationId: string;
  projectId: string;
  contributorId: string;
  outputs: readonly ProjectOutput[];
}

export interface DeclarationInput {
  role: AttributionRole;
  contributions: readonly DeclaredContribution[];
  requiredApproverIds: readonly string[];
}

export interface AttributionIssue {
  field: string;
  code: string;
  message: string;
}

/** Problems with a declaration, or an empty list when it is valid. */
export function validateDeclaration(input: DeclarationInput, ctx: AttributionValidationContext): AttributionIssue[] {
  const issues: AttributionIssue[] = [];
  const bad = (field: string, code: string, message: string) => issues.push({ field, code, message });

  if (!isAttributionRole(input.role)) {
    bad("role", "UNKNOWN_ROLE", "choose a recognised contributor role");
  }

  const approvers = input.requiredApproverIds;
  if (approvers.length === 0) bad("requiredApproverIds", "NO_APPROVERS", "name at least one approver");
  const seenApprovers = new Set<string>();
  approvers.forEach((id, index) => {
    if (seenApprovers.has(id)) bad(`requiredApproverIds[${index}]`, "DUPLICATE_APPROVER", "approvers must be unique");
    seenApprovers.add(id);
    if (id === ctx.contributorId) bad(`requiredApproverIds[${index}]`, "SELF_APPROVAL", "a contributor cannot approve their own attribution");
  });

  const contributions = input.contributions;
  if (contributions.length === 0) bad("contributions", "NO_CONTRIBUTIONS", "declare at least one contribution");
  if (contributions.length > MAX_CONTRIBUTIONS) {
    bad("contributions", "TOO_MANY_CONTRIBUTIONS", `declare at most ${MAX_CONTRIBUTIONS} contributions`);
  }

  const outputs = new Map(ctx.outputs.map((output) => [output.id, output]));
  const seenKinds = new Set<ContributionKind>();
  contributions.forEach((contribution, index) => {
    const at = `contributions[${index}]`;
    if (!isContributionKind(contribution.kind)) {
      bad(`${at}.kind`, "UNKNOWN_CONTRIBUTION", "use a recognised CRediT contribution kind");
    } else {
      if (seenKinds.has(contribution.kind)) bad(`${at}.kind`, "DUPLICATE_CONTRIBUTION", "each contribution kind may be declared only once");
      seenKinds.add(contribution.kind);
    }
    if (!isContributionLevel(contribution.level)) {
      bad(`${at}.level`, "UNKNOWN_LEVEL", "choose lead, equal or supporting");
    }
    if (contribution.note !== undefined && contribution.note.length > MAX_NOTE_LENGTH) {
      bad(`${at}.note`, "NOTE_TOO_LONG", `a note can be at most ${MAX_NOTE_LENGTH} characters`);
    }

    const seenOutputs = new Set<string>();
    contribution.outputIds.forEach((outputId, outputIndex) => {
      const outputAt = `${at}.outputIds[${outputIndex}]`;
      if (seenOutputs.has(outputId)) bad(outputAt, "DUPLICATE_OUTPUT", "link each output only once per contribution");
      seenOutputs.add(outputId);
      const output = outputs.get(outputId);
      if (!output) bad(outputAt, "UNKNOWN_OUTPUT", "the output was not found");
      else if (output.projectId !== ctx.projectId) bad(outputAt, "OUTPUT_PROJECT_MISMATCH", "the output belongs to another project");
    });
  });

  return issues;
}

export const ACTOR_ROLES = ["contributor", "supervisor", "editor", "organization_admin", "auditor"] as const;
export type ActorRole = (typeof ACTOR_ROLES)[number];

export const ATTRIBUTION_ACTIONS = [
  "attribution.view",
  "attribution.declare",
  "attribution.revise",
  "attribution.submit",
  "attribution.approve",
  "attribution.dispute",
  "attribution.resolve_dispute",
  "attribution.audit_view",
] as const;
export type AttributionAction = (typeof ATTRIBUTION_ACTIONS)[number];

export const ATTRIBUTION_SCOPES = ["own", "assigned", "organization"] as const;
export type AttributionScope = (typeof ATTRIBUTION_SCOPES)[number];

export const ATTRIBUTION_PERMISSIONS: Readonly<Record<ActorRole, Partial<Record<AttributionAction, AttributionScope>>>> = {
  contributor: {
    "attribution.view": "own",
    "attribution.declare": "own",
    "attribution.revise": "own",
    "attribution.submit": "own",
    "attribution.dispute": "own",
  },
  supervisor: {
    "attribution.view": "assigned",
    "attribution.approve": "assigned",
    "attribution.dispute": "assigned",
    "attribution.audit_view": "assigned",
  },
  editor: {
    "attribution.view": "organization",
    "attribution.dispute": "organization",
    "attribution.resolve_dispute": "organization",
    "attribution.audit_view": "organization",
  },
  organization_admin: {
    "attribution.view": "organization",
    "attribution.resolve_dispute": "organization",
    "attribution.audit_view": "organization",
  },
  auditor: {
    "attribution.view": "organization",
    "attribution.audit_view": "organization",
  },
};

/** Actions a role may never perform, even if a future grant lists them (separation of duties). */
export const ATTRIBUTION_FORBIDDEN: Readonly<Partial<Record<ActorRole, readonly AttributionAction[]>>> = {
  contributor: ["attribution.approve", "attribution.resolve_dispute", "attribution.audit_view"],
  supervisor: ["attribution.declare", "attribution.revise", "attribution.submit", "attribution.resolve_dispute"],
  editor: ["attribution.declare", "attribution.revise", "attribution.submit", "attribution.approve"],
  organization_admin: ["attribution.declare", "attribution.revise", "attribution.submit", "attribution.approve", "attribution.dispute"],
  auditor: [
    "attribution.declare",
    "attribution.revise",
    "attribution.submit",
    "attribution.approve",
    "attribution.dispute",
    "attribution.resolve_dispute",
  ],
};

export interface AttributionActor {
  id: string;
  role: ActorRole;
  organizationId: string;
}

export interface AttributionResource {
  organizationId: string;
  contributorId: string;
  /** Supervisors assigned as approvers for this version. */
  assignedIds?: readonly string[];
}

export type AuthorizationReason =
  | "UNKNOWN_ROLE"
  | "UNKNOWN_ACTION"
  | "FORBIDDEN_FOR_ROLE"
  | "NOT_GRANTED"
  | "TENANT_MISMATCH"
  | "NOT_OWNER"
  | "NOT_ASSIGNED"
  | "SELF_APPROVAL";

export type AuthorizationDecision = { allowed: true } | { allowed: false; reason: AuthorizationReason };

/** Deny-by-default authorization with tenant and self-approval boundaries. */
export function authorizeAttribution(
  actor: AttributionActor,
  action: AttributionAction,
  resource: AttributionResource,
): AuthorizationDecision {
  if (!(ACTOR_ROLES as readonly string[]).includes(actor.role)) return { allowed: false, reason: "UNKNOWN_ROLE" };
  if (!(ATTRIBUTION_ACTIONS as readonly string[]).includes(action)) return { allowed: false, reason: "UNKNOWN_ACTION" };
  if (ATTRIBUTION_FORBIDDEN[actor.role]?.includes(action)) return { allowed: false, reason: "FORBIDDEN_FOR_ROLE" };

  const scope = ATTRIBUTION_PERMISSIONS[actor.role][action];
  if (scope === undefined) return { allowed: false, reason: "NOT_GRANTED" };

  if (actor.organizationId !== resource.organizationId) return { allowed: false, reason: "TENANT_MISMATCH" };
  if (action === "attribution.approve" && actor.id === resource.contributorId) return { allowed: false, reason: "SELF_APPROVAL" };

  switch (scope) {
    case "organization":
      return { allowed: true };
    case "own":
      return actor.id === resource.contributorId ? { allowed: true } : { allowed: false, reason: "NOT_OWNER" };
    case "assigned":
      return resource.assignedIds?.includes(actor.id) ? { allowed: true } : { allowed: false, reason: "NOT_ASSIGNED" };
  }
}

/** Actions a role could perform in principle, minus forbidden ones. */
export function attributionActionsFor(role: ActorRole): AttributionAction[] {
  return (Object.keys(ATTRIBUTION_PERMISSIONS[role]) as AttributionAction[])
    .filter((action) => !ATTRIBUTION_FORBIDDEN[role]?.includes(action))
    .sort();
}

const resourceOf = (record: AttributionRecord): AttributionResource => ({
  organizationId: record.organizationId,
  contributorId: record.contributorId,
  assignedIds: record.requiredApproverIds,
});

const contextOf = (record: AttributionRecord, outputs: readonly ProjectOutput[]): AttributionValidationContext => ({
  organizationId: record.organizationId,
  projectId: record.projectId,
  contributorId: record.contributorId,
  outputs,
});

const hasOpenDispute = (disputes: readonly AttributionDispute[], record: AttributionRecord): boolean =>
  disputes.some((dispute) => dispute.attributionId === record.id && dispute.version === record.version && dispute.status === "open");

export type SubmitErrorCode =
  | "NOT_AUTHORIZED"
  | "STALE_REVISION"
  | "INVALID_STATE"
  | "INVALID_DECLARATION";

export type SubmitResult =
  | { ok: true; attribution: AttributionRecord; replayed: boolean }
  | { ok: false; code: SubmitErrorCode; message: string; issues?: AttributionIssue[] };

export type SubmitLedger = Map<string, SubmitResult>;

export interface SubmitAttributionRequest {
  /** Client-generated id; a retry with the same id is not applied again. */
  requestId: string;
  actor: AttributionActor;
  expectedRevision: number;
  now: string;
}

export function submitAttribution(
  record: AttributionRecord,
  request: SubmitAttributionRequest,
  outputs: readonly ProjectOutput[],
  ledger: SubmitLedger = new Map(),
): SubmitResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;

  const recordResult = (result: SubmitResult): SubmitResult => {
    ledger.set(request.requestId, result);
    return result;
  };
  const fail = (code: SubmitErrorCode, message: string, issues?: AttributionIssue[]): SubmitResult =>
    recordResult({ ok: false, code, message, ...(issues ? { issues } : {}) });

  const decision = authorizeAttribution(request.actor, "attribution.submit", resourceOf(record));
  if (!decision.allowed) return fail("NOT_AUTHORIZED", `You cannot submit this attribution (${decision.reason}).`);

  if (request.expectedRevision !== record.revision) {
    return fail("STALE_REVISION", `The attribution changed (revision ${record.revision}); reload before retrying.`);
  }
  if (record.status !== "draft") {
    return fail("INVALID_STATE", `Only a draft attribution can be submitted; this one is ${record.status}.`);
  }

  const issues = validateDeclaration(record, contextOf(record, outputs));
  if (issues.length > 0) return fail("INVALID_DECLARATION", "The attribution needs changes before it can be submitted.", issues);

  return recordResult({
    ok: true,
    replayed: false,
    attribution: { ...record, status: "submitted", revision: record.revision + 1, updatedAt: request.now },
  });
}

export type ApproveErrorCode =
  | "NOT_AUTHORIZED"
  | "STALE_REVISION"
  | "INVALID_STATE"
  | "UNKNOWN_APPROVER"
  | "OPEN_DISPUTE"
  | "NOTE_TOO_LONG";

export type ApproveResult =
  | { ok: true; attribution: AttributionRecord; replayed: boolean }
  | { ok: false; code: ApproveErrorCode; message: string };

export type ApproveLedger = Map<string, ApproveResult>;

export interface ApproveAttributionRequest {
  requestId: string;
  actor: AttributionActor;
  expectedRevision: number;
  decision: "approved" | "rejected";
  note?: string;
  now: string;
}

export function recordApproval(
  record: AttributionRecord,
  request: ApproveAttributionRequest,
  disputes: readonly AttributionDispute[],
  ledger: ApproveLedger = new Map(),
): ApproveResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;

  const recordResult = (result: ApproveResult): ApproveResult => {
    ledger.set(request.requestId, result);
    return result;
  };
  const fail = (code: ApproveErrorCode, message: string): ApproveResult => recordResult({ ok: false, code, message });

  const decision = authorizeAttribution(request.actor, "attribution.approve", resourceOf(record));
  if (!decision.allowed) return fail("NOT_AUTHORIZED", `You cannot approve this attribution (${decision.reason}).`);
  if (request.expectedRevision !== record.revision) {
    return fail("STALE_REVISION", `The attribution changed (revision ${record.revision}); reload before retrying.`);
  }
  if (record.status !== "submitted") return fail("INVALID_STATE", `Only a submitted attribution can be decided; this one is ${record.status}.`);
  if (!record.requiredApproverIds.includes(request.actor.id)) {
    return fail("UNKNOWN_APPROVER", "This person is not an assigned approver for this attribution.");
  }
  if (request.note !== undefined && request.note.length > MAX_NOTE_LENGTH) {
    return fail("NOTE_TOO_LONG", `a note can be at most ${MAX_NOTE_LENGTH} characters`);
  }
  if (hasOpenDispute(disputes, record)) {
    return fail("OPEN_DISPUTE", "Resolve the open dispute before recording an approval.");
  }

  // A retry, even with a different request id, never records a second decision
  // from the same approver for the same version.
  if (record.approvals.some((approval) => approval.approverId === request.actor.id)) {
    return recordResult({ ok: true, replayed: true, attribution: record });
  }

  const approvals = [
    ...record.approvals,
    {
      approverId: request.actor.id,
      decision: request.decision,
      at: request.now,
      ...(request.note !== undefined ? { note: request.note } : {}),
    },
  ];
  const approvedEverywhere =
    request.decision === "approved" &&
    record.requiredApproverIds.every((id) => approvals.some((approval) => approval.approverId === id && approval.decision === "approved"));
  const status: AttributionStatus = request.decision === "rejected" ? "rejected" : approvedEverywhere ? "approved" : "submitted";

  return recordResult({
    ok: true,
    replayed: false,
    attribution: { ...record, approvals, status, revision: record.revision + 1, updatedAt: request.now },
  });
}

export type ReviseErrorCode =
  | "NOT_AUTHORIZED"
  | "STALE_REVISION"
  | "INVALID_STATE"
  | "INVALID_DECLARATION";

export type ReviseResult =
  | { ok: true; previous: AttributionRecord; attribution: AttributionRecord; replayed: boolean }
  | { ok: false; code: ReviseErrorCode; message: string; issues?: AttributionIssue[] };

export type ReviseLedger = Map<string, ReviseResult>;

export interface ReviseAttributionRequest {
  requestId: string;
  actor: AttributionActor;
  expectedRevision: number;
  role: AttributionRole;
  contributions: DeclaredContribution[];
  requiredApproverIds: string[];
  now: string;
}

/** Register a new version of an approved or rejected attribution without editing the old one. */
export function reviseAttribution(
  record: AttributionRecord,
  request: ReviseAttributionRequest,
  outputs: readonly ProjectOutput[],
  ledger: ReviseLedger = new Map(),
): ReviseResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;

  const recordResult = (result: ReviseResult): ReviseResult => {
    ledger.set(request.requestId, result);
    return result;
  };
  const fail = (code: ReviseErrorCode, message: string, issues?: AttributionIssue[]): ReviseResult =>
    recordResult({ ok: false, code, message, ...(issues ? { issues } : {}) });

  const decision = authorizeAttribution(request.actor, "attribution.revise", resourceOf(record));
  if (!decision.allowed) return fail("NOT_AUTHORIZED", `You cannot revise this attribution (${decision.reason}).`);
  if (request.expectedRevision !== record.revision) {
    return fail("STALE_REVISION", `The attribution changed (revision ${record.revision}); reload before retrying.`);
  }
  if (record.status !== "approved" && record.status !== "rejected") {
    return fail("INVALID_STATE", `Only an approved or rejected attribution can be revised; this one is ${record.status}.`);
  }

  const next: AttributionRecord = {
    id: record.id,
    organizationId: record.organizationId,
    projectId: record.projectId,
    contributorId: record.contributorId,
    role: request.role,
    status: "draft",
    version: record.version + 1,
    revision: 1,
    contributions: request.contributions,
    requiredApproverIds: request.requiredApproverIds,
    approvals: [],
    createdAt: request.now,
    updatedAt: request.now,
  };
  const issues = validateDeclaration(next, contextOf(next, outputs));
  if (issues.length > 0) return fail("INVALID_DECLARATION", "The new version needs changes before it can be submitted.", issues);

  return recordResult({ ok: true, replayed: false, previous: record, attribution: next });
}

export type RaiseDisputeErrorCode =
  | "NOT_AUTHORIZED"
  | "STALE_REVISION"
  | "INVALID_STATE"
  | "INVALID_REASON"
  | "NOTE_TOO_LONG";

export type RaiseDisputeResult =
  | { ok: true; dispute: AttributionDispute; replayed: boolean }
  | { ok: false; code: RaiseDisputeErrorCode; message: string };

export type RaiseDisputeLedger = Map<string, RaiseDisputeResult>;

export interface RaiseDisputeRequest {
  requestId: string;
  actor: AttributionActor;
  expectedRevision: number;
  reason: string;
  note?: string;
  now: string;
}

export function raiseDispute(
  record: AttributionRecord,
  request: RaiseDisputeRequest,
  disputes: readonly AttributionDispute[],
  ledger: RaiseDisputeLedger = new Map(),
): RaiseDisputeResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;

  const recordResult = (result: RaiseDisputeResult): RaiseDisputeResult => {
    ledger.set(request.requestId, result);
    return result;
  };
  const fail = (code: RaiseDisputeErrorCode, message: string): RaiseDisputeResult => recordResult({ ok: false, code, message });

  const decision = authorizeAttribution(request.actor, "attribution.dispute", resourceOf(record));
  if (!decision.allowed) return fail("NOT_AUTHORIZED", `You cannot dispute this attribution (${decision.reason}).`);
  if (request.expectedRevision !== record.revision) {
    return fail("STALE_REVISION", `The attribution changed (revision ${record.revision}); reload before retrying.`);
  }
  if (record.status !== "submitted" && record.status !== "approved") {
    return fail("INVALID_STATE", `A ${record.status} attribution cannot be disputed.`);
  }
  if (!isDisputeReason(request.reason)) return fail("INVALID_REASON", "choose a recognised dispute reason");
  if (request.note !== undefined && request.note.length > MAX_NOTE_LENGTH) {
    return fail("NOTE_TOO_LONG", `a note can be at most ${MAX_NOTE_LENGTH} characters`);
  }

  const duplicate = disputes.find(
    (dispute) =>
      dispute.attributionId === record.id &&
      dispute.version === record.version &&
      dispute.raisedById === request.actor.id &&
      dispute.reason === request.reason &&
      dispute.status === "open",
  );
  if (duplicate) return recordResult({ ok: true, replayed: true, dispute: duplicate });

  return recordResult({
    ok: true,
    replayed: false,
    dispute: {
      id: `dsp_${request.requestId}`,
      attributionId: record.id,
      version: record.version,
      raisedById: request.actor.id,
      reason: request.reason,
      status: "open",
      raisedAt: request.now,
      ...(request.note !== undefined ? { note: request.note } : {}),
    },
  });
}

export type ResolveDisputeErrorCode =
  | "NOT_AUTHORIZED"
  | "INVALID_STATE"
  | "DISPUTE_MISMATCH"
  | "SELF_RESOLUTION"
  | "NOTE_TOO_LONG";

export type ResolveDisputeResult =
  | { ok: true; dispute: AttributionDispute; attribution: AttributionRecord; replayed: boolean }
  | { ok: false; code: ResolveDisputeErrorCode; message: string };

export type ResolveDisputeLedger = Map<string, ResolveDisputeResult>;

export interface ResolveDisputeRequest {
  requestId: string;
  actor: AttributionActor;
  outcome: "upheld" | "rejected";
  note?: string;
  now: string;
}

export function resolveDispute(
  record: AttributionRecord,
  dispute: AttributionDispute,
  request: ResolveDisputeRequest,
  ledger: ResolveDisputeLedger = new Map(),
): ResolveDisputeResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;

  const recordResult = (result: ResolveDisputeResult): ResolveDisputeResult => {
    ledger.set(request.requestId, result);
    return result;
  };
  const fail = (code: ResolveDisputeErrorCode, message: string): ResolveDisputeResult => recordResult({ ok: false, code, message });

  const decision = authorizeAttribution(request.actor, "attribution.resolve_dispute", resourceOf(record));
  if (!decision.allowed) return fail("NOT_AUTHORIZED", `You cannot resolve this dispute (${decision.reason}).`);
  if (dispute.attributionId !== record.id || dispute.version !== record.version) {
    return fail("DISPUTE_MISMATCH", "The dispute does not belong to this attribution version.");
  }
  if (dispute.status !== "open") return fail("INVALID_STATE", `Only an open dispute can be resolved; this one is ${dispute.status}.`);
  if (dispute.raisedById === request.actor.id) return fail("SELF_RESOLUTION", "A person cannot resolve their own dispute.");
  if (request.note !== undefined && request.note.length > MAX_NOTE_LENGTH) {
    return fail("NOTE_TOO_LONG", `a note can be at most ${MAX_NOTE_LENGTH} characters`);
  }

  const resolved: AttributionDispute = {
    ...dispute,
    status: request.outcome,
    resolvedAt: request.now,
    resolvedById: request.actor.id,
    ...(request.note !== undefined ? { note: request.note } : {}),
  };
  const attribution: AttributionRecord =
    request.outcome === "upheld"
      ? { ...record, status: "rejected", revision: record.revision + 1, updatedAt: request.now }
      : record;

  return recordResult({ ok: true, replayed: false, dispute: resolved, attribution });
}

export type SupersedeResult =
  | { ok: true; attribution: AttributionRecord }
  | { ok: false; code: "INVALID_SUPERSESSION"; message: string };

/** Mark an older approved version superseded once the next approved version exists. */
export function supersedeAttribution(previous: AttributionRecord, next: AttributionRecord, now: string): SupersedeResult {
  if (previous.id !== next.id || previous.status !== "approved" || next.status !== "approved" || next.version !== previous.version + 1) {
    return {
      ok: false,
      code: "INVALID_SUPERSESSION",
      message: "Only an approved version can supersede the immediately previous approved version of the same attribution.",
    };
  }
  return { ok: true, attribution: { ...previous, status: "superseded", revision: previous.revision + 1, updatedAt: now } };
}

export interface AttributionVersionSummary {
  version: number;
  role: AttributionRole;
  status: AttributionStatus;
  createdAt: string;
  contributionKinds: ContributionKind[];
}

/** Version history of one attribution lineage, oldest first. */
export function versionHistory(records: readonly AttributionRecord[]): AttributionVersionSummary[] {
  return [...records]
    .sort((a, b) => a.version - b.version)
    .map((record) => ({
      version: record.version,
      role: record.role,
      status: record.status,
      createdAt: record.createdAt,
      contributionKinds: record.contributions.map((contribution) => contribution.kind),
    }));
}

export function latestVersion(records: readonly AttributionRecord[]): AttributionRecord | null {
  return records.reduce<AttributionRecord | null>((latest, record) => (!latest || record.version > latest.version ? record : latest), null);
}

export interface AttributionAuditEntry {
  eventType: string;
  attributionId: string;
  projectId: string;
  version: number;
  revision: number;
  status: AttributionStatus;
  contributionKinds: ContributionKind[];
  outputLinkCount: number;
  approvalCount: number;
  at: string;
}

/**
 * A privacy-safe audit entry. It deliberately omits contributor and approver
 * identities, free-text notes and output ids; only recognised taxonomy values
 * and counters remain.
 */
export function attributionAuditEntry(record: AttributionRecord, eventType: string, at: string): AttributionAuditEntry {
  return {
    eventType,
    attributionId: record.id,
    projectId: record.projectId,
    version: record.version,
    revision: record.revision,
    status: record.status,
    contributionKinds: record.contributions.map((contribution) => contribution.kind),
    outputLinkCount: record.contributions.reduce((total, contribution) => total + contribution.outputIds.length, 0),
    approvalCount: record.approvals.length,
    at,
  };
}

export interface AttributionKindCount {
  kind: ContributionKind;
  count: number;
}

export interface AttributionAnalyticsSummary {
  total: number;
  byStatus: Record<AttributionStatus, number>;
  byKind: AttributionKindCount[];
  suppressedKinds: number;
}

/**
 * Aggregate attribution counts with small groups suppressed. Identities,
 * notes and output ids are never included.
 */
export function summarizeAttributions(
  records: readonly AttributionRecord[],
  minGroupSize: number = ANALYTICS_MIN_GROUP,
): AttributionAnalyticsSummary {
  const byStatus = Object.fromEntries(ATTRIBUTION_STATUSES.map((status) => [status, 0])) as Record<AttributionStatus, number>;
  const kindCounts = new Map<ContributionKind, number>();
  for (const record of records) {
    byStatus[record.status] += 1;
    for (const contribution of record.contributions) {
      kindCounts.set(contribution.kind, (kindCounts.get(contribution.kind) ?? 0) + 1);
    }
  }

  const threshold = Math.max(1, minGroupSize);
  const byKind: AttributionKindCount[] = [];
  let suppressedKinds = 0;
  for (const kind of CONTRIBUTION_KINDS) {
    const count = kindCounts.get(kind) ?? 0;
    if (count === 0) continue;
    if (count < threshold) suppressedKinds += 1;
    else byKind.push({ kind, count });
  }

  return { total: records.length, byStatus, byKind, suppressedKinds };
}
