/**
 * Project output provenance (CAPSTONE-090).
 *
 * Captures, per output version, the source datasets, methods, tools, commits,
 * transformations, licenses, authorship and integrity commitments behind an
 * output. Versions are immutable: a correction registers the next version
 * instead of editing a published one. Every mutation is deny-by-default,
 * tenant-scoped, guarded by an expected revision and idempotent on its request
 * id. Audit entries and analytics never carry author identities, private source
 * locations, names, URLs or free text.
 */
import { canonicalize, sha256Hex } from "./portfolio-export";

export const OUTPUT_KINDS = ["document", "dataset", "code", "artifact", "media", "other"] as const;
export type OutputKind = (typeof OUTPUT_KINDS)[number];

export const PROVENANCE_STATUSES = ["draft", "submitted", "published", "rejected", "superseded"] as const;
export type ProvenanceStatus = (typeof PROVENANCE_STATUSES)[number];

export const SOURCE_ACCESS = ["public", "restricted", "private"] as const;
export type SourceAccess = (typeof SOURCE_ACCESS)[number];

export const AUTHOR_ROLES = ["lead", "contributor", "reviewer", "data_steward", "supervisor"] as const;
export type AuthorRole = (typeof AUTHOR_ROLES)[number];

export const REPRODUCIBILITY = ["scripted", "manual", "unknown"] as const;
export type Reproducibility = (typeof REPRODUCIBILITY)[number];

export const INTEGRITY_ALGORITHMS = ["SHA-256"] as const;
export type IntegrityAlgorithm = (typeof INTEGRITY_ALGORITHMS)[number];

export const INTEGRITY_SCOPES = ["output", "sources", "transformation"] as const;
export type IntegrityScope = (typeof INTEGRITY_SCOPES)[number];

export const MAX_NOTE_LENGTH = 500;
export const ANALYTICS_MIN_GROUP = 3;

const SHA256 = /^[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{7,64}$/i;
const SPDX = /^[A-Za-z0-9][A-Za-z0-9.+-]*$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export const isOutputKind = (value: unknown): value is OutputKind =>
  typeof value === "string" && (OUTPUT_KINDS as readonly string[]).includes(value);

export const isProvenanceStatus = (value: unknown): value is ProvenanceStatus =>
  typeof value === "string" && (PROVENANCE_STATUSES as readonly string[]).includes(value);

export const isSourceAccess = (value: unknown): value is SourceAccess =>
  typeof value === "string" && (SOURCE_ACCESS as readonly string[]).includes(value);

export const isAuthorRole = (value: unknown): value is AuthorRole =>
  typeof value === "string" && (AUTHOR_ROLES as readonly string[]).includes(value);

export const isReproducibility = (value: unknown): value is Reproducibility =>
  typeof value === "string" && (REPRODUCIBILITY as readonly string[]).includes(value);

export interface SourceDataset {
  id: string;
  /** Public name; omitted for restricted/private sources. */
  name?: string;
  version?: string;
  access: SourceAccess;
  /** Only public sources may carry a resolvable location. */
  uri?: string;
  /** Content digest of the specific dataset version. */
  sha256?: string;
  /** Private free text; never copied into audit entries or analytics. */
  note?: string;
}

export interface MethodRef {
  id: string;
  name: string;
  /** Citation or protocol reference. */
  reference?: string;
}

export interface ToolRef {
  id: string;
  name: string;
  version?: string;
  vendor?: string;
}

export interface CommitRef {
  id: string;
  repository: string;
  commit: string;
  branch?: string;
}

export interface TransformationRef {
  id: string;
  description: string;
  /** Tool that performed the transformation, when known. */
  toolId?: string;
  /** Source dataset ids or earlier transformation ids. */
  inputIds: string[];
  /** Later transformation ids or the output id. */
  outputIds: string[];
  reproducibility: Reproducibility;
}

export interface LicenseRef {
  id: string;
  name: string;
  /** SPDX identifier when one exists, e.g. "CC-BY-4.0". */
  spdx?: string;
  url?: string;
}

export interface AuthorCredit {
  authorId: string;
  role: AuthorRole;
  /** The author's declared CRediT contribution kinds, if recorded elsewhere. */
  contributionKinds?: string[];
}

export interface IntegrityCommitment {
  algorithm: IntegrityAlgorithm;
  /** Lowercase hex digest. */
  digest: string;
  scope: IntegrityScope;
  /** Component ids covered by this commitment, or "output". */
  covers: string[];
  committedAt: string;
}

export interface ProvenanceRecord {
  id: string;
  organizationId: string;
  projectId: string;
  outputId: string;
  kind: OutputKind;
  /** Immutable output version; a correction registers the next version. */
  version: number;
  /** Increases by one on every applied change to this version. */
  revision: number;
  status: ProvenanceStatus;
  sources: SourceDataset[];
  methods: MethodRef[];
  tools: ToolRef[];
  commits: CommitRef[];
  transformations: TransformationRef[];
  licenses: LicenseRef[];
  authors: AuthorCredit[];
  integrity: IntegrityCommitment[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export type ProvenanceInput = Pick<
  ProvenanceRecord,
  "kind" | "sources" | "methods" | "tools" | "commits" | "transformations" | "licenses" | "authors" | "integrity"
>;

export interface ProvenanceValidationContext {
  organizationId: string;
  projectId: string;
  outputId: string;
  /** Project members who may be credited as authors. */
  memberIds: readonly string[];
}

export interface ProvenanceIssue {
  field: string;
  code: string;
  message: string;
}

function hasTransformationCycle(transformations: readonly TransformationRef[]): boolean {
  const byId = new Map(transformations.map((transformation) => [transformation.id, transformation]));
  const state = new Map<string, 0 | 1 | 2>();

  const visit = (id: string): boolean => {
    const current = state.get(id) ?? 0;
    if (current === 1) return true;
    if (current === 2) return false;
    state.set(id, 1);
    for (const input of byId.get(id)?.inputIds ?? []) {
      if (byId.has(input) && visit(input)) return true;
    }
    state.set(id, 2);
    return false;
  };

  return transformations.some((transformation) => visit(transformation.id));
}

/** Problems with a provenance version, or an empty list when it is valid. */
export function validateProvenance(record: ProvenanceRecord, ctx: ProvenanceValidationContext): ProvenanceIssue[] {
  const issues: ProvenanceIssue[] = [];
  const bad = (field: string, code: string, message: string) => issues.push({ field, code, message });

  if (record.organizationId !== ctx.organizationId) bad("organizationId", "TENANT_MISMATCH", "the output belongs to another organization");
  if (record.projectId !== ctx.projectId) bad("projectId", "PROJECT_MISMATCH", "the output belongs to another project");
  if (record.outputId !== ctx.outputId) bad("outputId", "OUTPUT_MISMATCH", "provenance must describe the requested output");
  if (!isOutputKind(record.kind)) bad("kind", "UNKNOWN_OUTPUT_KIND", "choose a recognised output kind");
  if (!Number.isInteger(record.version) || record.version < 1) bad("version", "INVALID_VERSION", "the version must be a positive integer");
  if (!Number.isInteger(record.revision) || record.revision < 1) bad("revision", "INVALID_REVISION", "the revision must be a positive integer");

  const componentIds = new Set<string>();
  const addId = (id: string, field: string) => {
    if (typeof id !== "string" || id.trim().length === 0) bad(field, "MISSING_ID", "give this record an id");
    else if (componentIds.has(id)) bad(field, "DUPLICATE_ID", "component ids must be unique across the provenance");
    else componentIds.add(id);
  };

  if (record.sources.length === 0) bad("sources", "NO_SOURCES", "record at least one source dataset");
  const sourceIds = new Set<string>();
  record.sources.forEach((source, index) => {
    const at = `sources[${index}]`;
    addId(source.id, `${at}.id`);
    sourceIds.add(source.id);
    if (!isSourceAccess(source.access)) bad(`${at}.access`, "UNKNOWN_ACCESS", "choose public, restricted or private");
    if (source.sha256 !== undefined && !SHA256.test(source.sha256)) bad(`${at}.sha256`, "INVALID_DIGEST", "use a lowercase 64-character SHA-256 digest");
    if (source.access !== "public" && source.uri !== undefined) {
      bad(`${at}.uri`, "PRIVATE_LOCATION_EXPOSED", "restricted and private datasets must be referenced by id and digest, not a location");
    }
    if (source.note !== undefined && source.note.length > MAX_NOTE_LENGTH) bad(`${at}.note`, "NOTE_TOO_LONG", `a note can be at most ${MAX_NOTE_LENGTH} characters`);
  });

  if (record.methods.length === 0) bad("methods", "NO_METHODS", "record at least one method");
  record.methods.forEach((method, index) => {
    const at = `methods[${index}]`;
    addId(method.id, `${at}.id`);
    if (method.name.trim().length === 0) bad(`${at}.name`, "MISSING_NAME", "give the method a name");
  });

  const toolIds = new Set<string>();
  record.tools.forEach((tool, index) => {
    const at = `tools[${index}]`;
    addId(tool.id, `${at}.id`);
    toolIds.add(tool.id);
    if (tool.name.trim().length === 0) bad(`${at}.name`, "MISSING_NAME", "give the tool a name");
  });

  const commitIds = new Set<string>();
  record.commits.forEach((commit, index) => {
    const at = `commits[${index}]`;
    addId(commit.id, `${at}.id`);
    commitIds.add(commit.id);
    if (commit.repository.trim().length === 0) bad(`${at}.repository`, "MISSING_REPOSITORY", "give the repository");
    if (!COMMIT.test(commit.commit)) bad(`${at}.commit`, "INVALID_COMMIT", "use a 7 to 64 character hexadecimal commit id");
  });

  const transformationIds = new Set(record.transformations.map((transformation) => transformation.id));
  record.transformations.forEach((transformation, index) => {
    const at = `transformations[${index}]`;
    addId(transformation.id, `${at}.id`);
    if (transformation.description.trim().length === 0 || transformation.description.length > MAX_NOTE_LENGTH) {
      bad(`${at}.description`, "INVALID_DESCRIPTION", `give a description of 1 to ${MAX_NOTE_LENGTH} characters`);
    }
    if (!isReproducibility(transformation.reproducibility)) bad(`${at}.reproducibility`, "UNKNOWN_REPRODUCIBILITY", "choose scripted, manual or unknown");
    if (transformation.toolId !== undefined && !toolIds.has(transformation.toolId)) bad(`${at}.toolId`, "UNKNOWN_TOOL", "the tool was not found");
    if (transformation.inputIds.length === 0) bad(`${at}.inputIds`, "NO_INPUTS", "name at least one input");
    if (transformation.outputIds.length === 0) bad(`${at}.outputIds`, "NO_OUTPUTS", "name at least one output");
    new Set(transformation.inputIds).forEach((id) => {
      if (!sourceIds.has(id) && !transformationIds.has(id)) bad(`${at}.inputIds`, "UNKNOWN_INPUT", `input ${id} is not a source or transformation`);
    });
    new Set(transformation.outputIds).forEach((id) => {
      if (id !== record.outputId && !transformationIds.has(id)) bad(`${at}.outputIds`, "UNKNOWN_OUTPUT_REF", `output ${id} is not a transformation or this output`);
    });
    if (new Set(transformation.inputIds).size !== transformation.inputIds.length) bad(`${at}.inputIds`, "DUPLICATE_INPUT", "inputs must be unique");
    if (new Set(transformation.outputIds).size !== transformation.outputIds.length) bad(`${at}.outputIds`, "DUPLICATE_OUTPUT", "outputs must be unique");
  });
  if (hasTransformationCycle(record.transformations)) bad("transformations", "TRANSFORMATION_CYCLE", "transformations must not depend on themselves");

  if (record.licenses.length === 0) bad("licenses", "NO_LICENSES", "record at least one license");
  record.licenses.forEach((license, index) => {
    const at = `licenses[${index}]`;
    addId(license.id, `${at}.id`);
    if (license.name.trim().length === 0) bad(`${at}.name`, "MISSING_NAME", "give the license a name");
    if (license.spdx !== undefined && !SPDX.test(license.spdx)) bad(`${at}.spdx`, "INVALID_SPDX", "use a valid SPDX identifier");
  });

  if (record.authors.length === 0) bad("authors", "NO_AUTHORS", "credit at least one author");
  const authorIds = new Set<string>();
  record.authors.forEach((author, index) => {
    const at = `authors[${index}]`;
    if (authorIds.has(author.authorId)) bad(`${at}.authorId`, "DUPLICATE_AUTHOR", "each author may be credited only once");
    authorIds.add(author.authorId);
    if (!ctx.memberIds.includes(author.authorId)) bad(`${at}.authorId`, "UNKNOWN_AUTHOR", "the author must be a member of the project");
    if (!isAuthorRole(author.role)) bad(`${at}.role`, "UNKNOWN_AUTHOR_ROLE", "choose a recognised author role");
  });
  if (record.authors.length > 0 && !record.authors.some((author) => author.role === "lead")) {
    bad("authors", "NO_LEAD_AUTHOR", "name at least one lead author");
  }

  if (record.integrity.length === 0) bad("integrity", "NO_INTEGRITY_COMMITMENT", "record at least one integrity commitment");
  const commitmentKeys = new Set<string>();
  const knownCoverIds = new Set([...componentIds, "output"]);
  record.integrity.forEach((commitment, index) => {
    const at = `integrity[${index}]`;
    if (!(INTEGRITY_ALGORITHMS as readonly string[]).includes(commitment.algorithm)) {
      bad(`${at}.algorithm`, "UNKNOWN_ALGORITHM", "only SHA-256 commitments are supported");
    } else if (!SHA256.test(commitment.digest)) {
      bad(`${at}.digest`, "INVALID_DIGEST", "use a lowercase 64-character SHA-256 digest");
    }
    if (!(INTEGRITY_SCOPES as readonly string[]).includes(commitment.scope)) {
      bad(`${at}.scope`, "UNKNOWN_SCOPE", "choose output, sources or transformation");
    }
    if (!ISO_INSTANT.test(commitment.committedAt)) bad(`${at}.committedAt`, "INVALID_TIMESTAMP", "use an ISO 8601 UTC instant");
    if (commitment.covers.length === 0) bad(`${at}.covers`, "NO_COVERAGE", "name at least one covered id");
    if (new Set(commitment.covers).size !== commitment.covers.length) bad(`${at}.covers`, "DUPLICATE_COVERAGE", "covered ids must be unique");
    commitment.covers.forEach((id) => {
      if (!knownCoverIds.has(id)) bad(`${at}.covers`, "UNKNOWN_COVERAGE", `covered id ${id} was not found`);
    });
    const key = `${commitment.algorithm}:${commitment.scope}`;
    if (commitmentKeys.has(key)) bad(at, "DUPLICATE_COMMITMENT", "record one commitment per algorithm and scope");
    commitmentKeys.add(key);
  });
  if (record.integrity.length > 0 && !record.integrity.some((commitment) => commitment.scope === "output")) {
    bad("integrity", "NO_OUTPUT_COMMITMENT", "record an output-scoped integrity commitment");
  }

  return issues;
}

export const PROVENANCE_ACTOR_ROLES = ["contributor", "supervisor", "editor", "organization_admin", "auditor"] as const;
export type ProvenanceActorRole = (typeof PROVENANCE_ACTOR_ROLES)[number];

export const PROVENANCE_ACTIONS = [
  "provenance.view",
  "provenance.declare",
  "provenance.revise",
  "provenance.submit",
  "provenance.publish",
  "provenance.audit_view",
] as const;
export type ProvenanceAction = (typeof PROVENANCE_ACTIONS)[number];

export const PROVENANCE_SCOPES = ["own", "assigned", "organization"] as const;
export type ProvenanceScope = (typeof PROVENANCE_SCOPES)[number];

export const PROVENANCE_PERMISSIONS: Readonly<
  Record<ProvenanceActorRole, Partial<Record<ProvenanceAction, ProvenanceScope>>>
> = {
  contributor: {
    "provenance.view": "own",
    "provenance.declare": "own",
    "provenance.revise": "own",
    "provenance.submit": "own",
  },
  supervisor: {
    "provenance.view": "assigned",
    "provenance.publish": "assigned",
    "provenance.audit_view": "assigned",
  },
  editor: {
    "provenance.view": "organization",
    "provenance.publish": "organization",
    "provenance.audit_view": "organization",
  },
  organization_admin: {
    "provenance.view": "organization",
    "provenance.audit_view": "organization",
  },
  auditor: {
    "provenance.view": "organization",
    "provenance.audit_view": "organization",
  },
};

/** Actions a role may never perform, even if a future grant lists them (separation of duties). */
export const PROVENANCE_FORBIDDEN: Readonly<Partial<Record<ProvenanceActorRole, readonly ProvenanceAction[]>>> = {
  contributor: ["provenance.publish", "provenance.audit_view"],
  supervisor: ["provenance.declare", "provenance.revise", "provenance.submit"],
  editor: ["provenance.declare", "provenance.revise", "provenance.submit"],
  organization_admin: ["provenance.declare", "provenance.revise", "provenance.submit", "provenance.publish"],
  auditor: ["provenance.declare", "provenance.revise", "provenance.submit", "provenance.publish"],
};

export interface ProvenanceActor {
  id: string;
  role: ProvenanceActorRole;
  organizationId: string;
}

export interface ProvenanceResource {
  organizationId: string;
  outputId: string;
  /** Authors of the output; used for ownership and self-publish checks. */
  authorIds: readonly string[];
  /** Supervisors assigned to publish this output. */
  assignedIds?: readonly string[];
}

export type ProvenanceAuthorizationReason =
  | "UNKNOWN_ROLE"
  | "UNKNOWN_ACTION"
  | "FORBIDDEN_FOR_ROLE"
  | "NOT_GRANTED"
  | "TENANT_MISMATCH"
  | "NOT_AUTHOR"
  | "NOT_ASSIGNED"
  | "SELF_PUBLISH";

export type ProvenanceAuthorizationDecision =
  | { allowed: true }
  | { allowed: false; reason: ProvenanceAuthorizationReason };

/** Deny-by-default authorization with tenant, ownership and self-publish boundaries. */
export function authorizeProvenance(
  actor: ProvenanceActor,
  action: ProvenanceAction,
  resource: ProvenanceResource,
): ProvenanceAuthorizationDecision {
  if (!(PROVENANCE_ACTOR_ROLES as readonly string[]).includes(actor.role)) return { allowed: false, reason: "UNKNOWN_ROLE" };
  if (!(PROVENANCE_ACTIONS as readonly string[]).includes(action)) return { allowed: false, reason: "UNKNOWN_ACTION" };
  if (PROVENANCE_FORBIDDEN[actor.role]?.includes(action)) return { allowed: false, reason: "FORBIDDEN_FOR_ROLE" };

  const scope = PROVENANCE_PERMISSIONS[actor.role][action];
  if (scope === undefined) return { allowed: false, reason: "NOT_GRANTED" };

  if (actor.organizationId !== resource.organizationId) return { allowed: false, reason: "TENANT_MISMATCH" };
  if (action === "provenance.publish" && resource.authorIds.includes(actor.id)) return { allowed: false, reason: "SELF_PUBLISH" };

  switch (scope) {
    case "organization":
      return { allowed: true };
    case "own":
      return resource.authorIds.includes(actor.id) ? { allowed: true } : { allowed: false, reason: "NOT_AUTHOR" };
    case "assigned":
      return resource.assignedIds?.includes(actor.id) ? { allowed: true } : { allowed: false, reason: "NOT_ASSIGNED" };
  }
}

export function provenanceActionsFor(role: ProvenanceActorRole): ProvenanceAction[] {
  return (Object.keys(PROVENANCE_PERMISSIONS[role]) as ProvenanceAction[])
    .filter((action) => !PROVENANCE_FORBIDDEN[role]?.includes(action))
    .sort();
}

const resourceOf = (record: ProvenanceRecord): ProvenanceResource => ({
  organizationId: record.organizationId,
  outputId: record.outputId,
  authorIds: record.authors.filter((author) => author.role !== "supervisor").map((author) => author.authorId),
  assignedIds: record.authors.filter((author) => author.role === "supervisor").map((author) => author.authorId),
});

const contextOf = (record: ProvenanceRecord, memberIds: readonly string[]): ProvenanceValidationContext => ({
  organizationId: record.organizationId,
  projectId: record.projectId,
  outputId: record.outputId,
  memberIds,
});

export type SubmitProvenanceErrorCode =
  | "NOT_AUTHORIZED"
  | "STALE_REVISION"
  | "INVALID_STATE"
  | "INVALID_PROVENANCE";

export type SubmitProvenanceResult =
  | { ok: true; provenance: ProvenanceRecord; replayed: boolean }
  | { ok: false; code: SubmitProvenanceErrorCode; message: string; issues?: ProvenanceIssue[] };

export type SubmitProvenanceLedger = Map<string, SubmitProvenanceResult>;

export interface SubmitProvenanceRequest {
  requestId: string;
  actor: ProvenanceActor;
  expectedRevision: number;
  now: string;
}

export function submitProvenance(
  record: ProvenanceRecord,
  request: SubmitProvenanceRequest,
  memberIds: readonly string[],
  ledger: SubmitProvenanceLedger = new Map(),
): SubmitProvenanceResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;

  const store = (result: SubmitProvenanceResult): SubmitProvenanceResult => {
    ledger.set(request.requestId, result);
    return result;
  };
  const fail = (code: SubmitProvenanceErrorCode, message: string, issues?: ProvenanceIssue[]): SubmitProvenanceResult =>
    store({ ok: false, code, message, ...(issues ? { issues } : {}) });

  const decision = authorizeProvenance(request.actor, "provenance.submit", resourceOf(record));
  if (!decision.allowed) return fail("NOT_AUTHORIZED", `You cannot submit this provenance (${decision.reason}).`);
  if (request.expectedRevision !== record.revision) {
    return fail("STALE_REVISION", `The provenance changed (revision ${record.revision}); reload before retrying.`);
  }
  if (record.status !== "draft") return fail("INVALID_STATE", `Only a draft can be submitted; this version is ${record.status}.`);

  const issues = validateProvenance(record, contextOf(record, memberIds));
  if (issues.length > 0) return fail("INVALID_PROVENANCE", "The provenance needs changes before it can be submitted.", issues);

  return store({
    ok: true,
    replayed: false,
    provenance: { ...record, status: "submitted", revision: record.revision + 1, updatedAt: request.now },
  });
}

export type PublishProvenanceErrorCode =
  | "NOT_AUTHORIZED"
  | "STALE_REVISION"
  | "INVALID_STATE"
  | "INVALID_PROVENANCE";

export type PublishProvenanceResult =
  | { ok: true; provenance: ProvenanceRecord; replayed: boolean }
  | { ok: false; code: PublishProvenanceErrorCode; message: string; issues?: ProvenanceIssue[] };

export type PublishProvenanceLedger = Map<string, PublishProvenanceResult>;

export interface PublishProvenanceRequest {
  requestId: string;
  actor: ProvenanceActor;
  expectedRevision: number;
  now: string;
}

export function publishProvenance(
  record: ProvenanceRecord,
  request: PublishProvenanceRequest,
  memberIds: readonly string[],
  ledger: PublishProvenanceLedger = new Map(),
): PublishProvenanceResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;

  const store = (result: PublishProvenanceResult): PublishProvenanceResult => {
    ledger.set(request.requestId, result);
    return result;
  };
  const fail = (code: PublishProvenanceErrorCode, message: string, issues?: ProvenanceIssue[]): PublishProvenanceResult =>
    store({ ok: false, code, message, ...(issues ? { issues } : {}) });

  const decision = authorizeProvenance(request.actor, "provenance.publish", resourceOf(record));
  if (!decision.allowed) return fail("NOT_AUTHORIZED", `You cannot publish this provenance (${decision.reason}).`);
  if (request.expectedRevision !== record.revision) {
    return fail("STALE_REVISION", `The provenance changed (revision ${record.revision}); reload before retrying.`);
  }
  if (record.status !== "submitted") return fail("INVALID_STATE", `Only a submitted version can be published; this one is ${record.status}.`);

  const issues = validateProvenance(record, contextOf(record, memberIds));
  if (issues.length > 0) return fail("INVALID_PROVENANCE", "The provenance needs changes before it can be published.", issues);

  return store({
    ok: true,
    replayed: false,
    provenance: {
      ...record,
      status: "published",
      revision: record.revision + 1,
      updatedAt: request.now,
      publishedAt: request.now,
    },
  });
}

export type ReviseProvenanceErrorCode =
  | "NOT_AUTHORIZED"
  | "STALE_REVISION"
  | "INVALID_STATE"
  | "INVALID_PROVENANCE";

export type ReviseProvenanceResult =
  | { ok: true; previous: ProvenanceRecord; provenance: ProvenanceRecord; replayed: boolean }
  | { ok: false; code: ReviseProvenanceErrorCode; message: string; issues?: ProvenanceIssue[] };

export type ReviseProvenanceLedger = Map<string, ReviseProvenanceResult>;

export interface ReviseProvenanceRequest {
  requestId: string;
  actor: ProvenanceActor;
  expectedRevision: number;
  input: ProvenanceInput;
  now: string;
}

/** Register the next output version without editing the published one. */
export function reviseProvenance(
  previous: ProvenanceRecord,
  request: ReviseProvenanceRequest,
  memberIds: readonly string[],
  ledger: ReviseProvenanceLedger = new Map(),
): ReviseProvenanceResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;

  const store = (result: ReviseProvenanceResult): ReviseProvenanceResult => {
    ledger.set(request.requestId, result);
    return result;
  };
  const fail = (code: ReviseProvenanceErrorCode, message: string, issues?: ProvenanceIssue[]): ReviseProvenanceResult =>
    store({ ok: false, code, message, ...(issues ? { issues } : {}) });

  const decision = authorizeProvenance(request.actor, "provenance.revise", resourceOf(previous));
  if (!decision.allowed) return fail("NOT_AUTHORIZED", `You cannot revise this provenance (${decision.reason}).`);
  if (request.expectedRevision !== previous.revision) {
    return fail("STALE_REVISION", `The provenance changed (revision ${previous.revision}); reload before retrying.`);
  }
  if (previous.status !== "published" && previous.status !== "rejected") {
    return fail("INVALID_STATE", `Only a published or rejected version can be revised; this one is ${previous.status}.`);
  }

  const next: ProvenanceRecord = {
    id: previous.id,
    organizationId: previous.organizationId,
    projectId: previous.projectId,
    outputId: previous.outputId,
    version: previous.version + 1,
    revision: 1,
    status: "draft",
    createdAt: request.now,
    updatedAt: request.now,
    ...request.input,
  };
  const issues = validateProvenance(next, contextOf(next, memberIds));
  if (issues.length > 0) return fail("INVALID_PROVENANCE", "The new version needs changes before it can be submitted.", issues);

  return store({ ok: true, replayed: false, previous, provenance: next });
}

export type SupersedeProvenanceResult =
  | { ok: true; provenance: ProvenanceRecord }
  | { ok: false; code: "INVALID_SUPERSESSION"; message: string };

/** Mark an older published version superseded once the next published version exists. */
export function supersedeProvenance(previous: ProvenanceRecord, next: ProvenanceRecord, now: string): SupersedeProvenanceResult {
  if (
    previous.id !== next.id ||
    previous.outputId !== next.outputId ||
    previous.status !== "published" ||
    next.status !== "published" ||
    next.version !== previous.version + 1
  ) {
    return {
      ok: false,
      code: "INVALID_SUPERSESSION",
      message: "Only a published version can supersede the immediately previous published version of the same output.",
    };
  }
  return { ok: true, provenance: { ...previous, status: "superseded", revision: previous.revision + 1, updatedAt: now } };
}

export interface ProvenanceVersionSummary {
  version: number;
  status: ProvenanceStatus;
  kind: OutputKind;
  createdAt: string;
  publishedAt?: string;
  sourceCount: number;
  transformationCount: number;
  authorCount: number;
}

export function versionHistory(records: readonly ProvenanceRecord[]): ProvenanceVersionSummary[] {
  return [...records]
    .sort((a, b) => a.version - b.version)
    .map((record) => ({
      version: record.version,
      status: record.status,
      kind: record.kind,
      createdAt: record.createdAt,
      ...(record.publishedAt ? { publishedAt: record.publishedAt } : {}),
      sourceCount: record.sources.length,
      transformationCount: record.transformations.length,
      authorCount: record.authors.length,
    }));
}

export function latestVersion(records: readonly ProvenanceRecord[]): ProvenanceRecord | null {
  return records.reduce<ProvenanceRecord | null>((latest, record) => (!latest || record.version > latest.version ? record : latest), null);
}

export interface ProvenanceAuditEntry {
  eventType: string;
  provenanceId: string;
  projectId: string;
  outputId: string;
  version: number;
  revision: number;
  status: ProvenanceStatus;
  kind: OutputKind;
  sourceCount: number;
  methodCount: number;
  toolCount: number;
  commitCount: number;
  transformationCount: number;
  licenseCount: number;
  authorCount: number;
  integrityAlgorithms: IntegrityAlgorithm[];
  at: string;
}

/**
 * A privacy-safe audit entry. It deliberately omits author identities, source
 * names and locations, repository names, URLs and free-text notes.
 */
export function provenanceAuditEntry(record: ProvenanceRecord, eventType: string, at: string): ProvenanceAuditEntry {
  return {
    eventType,
    provenanceId: record.id,
    projectId: record.projectId,
    outputId: record.outputId,
    version: record.version,
    revision: record.revision,
    status: record.status,
    kind: record.kind,
    sourceCount: record.sources.length,
    methodCount: record.methods.length,
    toolCount: record.tools.length,
    commitCount: record.commits.length,
    transformationCount: record.transformations.length,
    licenseCount: record.licenses.length,
    authorCount: record.authors.length,
    integrityAlgorithms: [...new Set(record.integrity.map((commitment) => commitment.algorithm))],
    at,
  };
}

export interface ProvenanceAnalyticsSummary {
  total: number;
  byStatus: Record<ProvenanceStatus, number>;
  byKind: Array<{ kind: OutputKind; count: number }>;
  bySourceAccess: Array<{ access: SourceAccess; count: number }>;
  suppressedKinds: number;
  suppressedAccess: number;
}

/** Aggregate provenance counts with small groups suppressed; no identities or locations. */
export function summarizeProvenance(
  records: readonly ProvenanceRecord[],
  minGroupSize: number = ANALYTICS_MIN_GROUP,
): ProvenanceAnalyticsSummary {
  const byStatus = Object.fromEntries(PROVENANCE_STATUSES.map((status) => [status, 0])) as Record<ProvenanceStatus, number>;
  const kindCounts = new Map<OutputKind, number>();
  const accessCounts = new Map<SourceAccess, number>();

  for (const record of records) {
    byStatus[record.status] += 1;
    kindCounts.set(record.kind, (kindCounts.get(record.kind) ?? 0) + 1);
    for (const source of record.sources) {
      accessCounts.set(source.access, (accessCounts.get(source.access) ?? 0) + 1);
    }
  }

  const threshold = Math.max(1, minGroupSize);
  const byKind: ProvenanceAnalyticsSummary["byKind"] = [];
  let suppressedKinds = 0;
  for (const kind of OUTPUT_KINDS) {
    const count = kindCounts.get(kind) ?? 0;
    if (count === 0) continue;
    if (count < threshold) suppressedKinds += 1;
    else byKind.push({ kind, count });
  }

  const bySourceAccess: ProvenanceAnalyticsSummary["bySourceAccess"] = [];
  let suppressedAccess = 0;
  for (const access of SOURCE_ACCESS) {
    const count = accessCounts.get(access) ?? 0;
    if (count === 0) continue;
    if (count < threshold) suppressedAccess += 1;
    else bySourceAccess.push({ access, count });
  }

  return { total: records.length, byStatus, byKind, bySourceAccess, suppressedKinds, suppressedAccess };
}

/** The canonical portion covered by an output-scoped integrity commitment. */
export function provenanceDigestBody(record: ProvenanceRecord): unknown {
  return {
    id: record.id,
    organizationId: record.organizationId,
    projectId: record.projectId,
    outputId: record.outputId,
    kind: record.kind,
    version: record.version,
    sources: record.sources,
    methods: record.methods,
    tools: record.tools,
    commits: record.commits,
    transformations: record.transformations,
    licenses: record.licenses,
    authors: record.authors,
    createdAt: record.createdAt,
  };
}

export async function computeProvenanceDigest(record: ProvenanceRecord): Promise<string> {
  return sha256Hex(canonicalize(provenanceDigestBody(record)));
}

/** Build the output-scoped SHA-256 commitment for a version. */
export async function outputIntegrityCommitment(
  record: ProvenanceRecord,
  committedAt: string,
  covers: string[] = ["output"],
): Promise<IntegrityCommitment> {
  return {
    algorithm: "SHA-256",
    digest: await computeProvenanceDigest(record),
    scope: "output",
    covers,
    committedAt,
  };
}

export type VerifyProvenanceIntegrityResult =
  | { ok: true; digest: string }
  | { ok: false; code: "NO_OUTPUT_COMMITMENT" | "DIGEST_MISMATCH" };

/** Recompute the output digest and compare it with the recorded commitment. */
export async function verifyProvenanceIntegrity(record: ProvenanceRecord): Promise<VerifyProvenanceIntegrityResult> {
  const commitment = record.integrity.find((candidate) => candidate.scope === "output" && candidate.algorithm === "SHA-256");
  if (!commitment) return { ok: false, code: "NO_OUTPUT_COMMITMENT" };
  const digest = await computeProvenanceDigest(record);
  return digest === commitment.digest ? { ok: true, digest } : { ok: false, code: "DIGEST_MISMATCH" };
}
