import { CONTRACT_ADDRESSES } from './stellar';

export async function getCertificate(wallet: string, courseId: string) {
  // Build and simulate a Soroban transaction calling certificates.get_certificate
}

export async function getChvBalance(publicKey: string): Promise<bigint> {
  // Call chv_token.balance
}

export async function claimReward(courseId: string, signer: WalletSigner): Promise<string> {
  // Build, sign, and submit a reward claim transaction
  // Returns transaction hash
}

/* -------------------------------------------------------------------------- */
/* Workspace domain contracts (CAPSTONE-070, -071, -073, -075)                */
/* -------------------------------------------------------------------------- */

/**
 * Shared primitives for the workspace domain.
 *
 * Privacy boundary: these shapes intentionally exclude provider access tokens,
 * refresh tokens, webhook secrets, private proposal/research payloads, identity
 * data, and financial details. Only opaque identifiers and minimized metadata
 * are exchanged with the frontend.
 */

export type IsoDateTimeString = string;

export type WorkspaceId = string;

/** Optimistic-concurrency token. Every mutable aggregate carries a version. */
export type EntityVersion = number;

/** Idempotency key for side-effecting mutations (create/update/transition). */
export type IdempotencyKey = string;

/** Opaque cursor for paginated collections. */
export type PageCursor = string | null;

/** Stable, actionable error codes shared across workspace features. */
export const WORKSPACE_ERROR_CODES = {
  /** Request payload failed validation. */
  VALIDATION_FAILED: 'WORKSPACE_VALIDATION_FAILED',
  /** Caller is not authorized (deny-by-default). */
  FORBIDDEN: 'WORKSPACE_FORBIDDEN',
  /** Resource does not exist within the caller's tenant boundary. */
  NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  /** Resource belongs to a different tenant. */
  TENANT_MISMATCH: 'WORKSPACE_TENANT_MISMATCH',
  /** The entity version supplied is stale; refetch and retry. */
  STALE_VERSION: 'WORKSPACE_STALE_VERSION',
  /** The requested lifecycle transition is not allowed from current state. */
  INVALID_TRANSITION: 'WORKSPACE_INVALID_TRANSITION',
  /** A conflicting record already exists (e.g. duplicate decision/review). */
  CONFLICT: 'WORKSPACE_CONFLICT',
  /** A reviewer conflict of interest blocks the action. */
  CONFLICT_OF_INTEREST: 'WORKSPACE_CONFLICT_OF_INTEREST',
  /** Duplicate submission detected via idempotency key. */
  DUPLICATE_REQUEST: 'WORKSPACE_DUPLICATE_REQUEST',
  /** Provider connection is revoked or otherwise unusable. */
  PROVIDER_UNAVAILABLE: 'WORKSPACE_PROVIDER_UNAVAILABLE',
  /** Rate limited; retry after the indicated delay. */
  RATE_LIMITED: 'WORKSPACE_RATE_LIMITED',
  /** Unexpected server failure. */
  INTERNAL: 'WORKSPACE_INTERNAL',
} as const;

export type WorkspaceErrorCode =
  (typeof WORKSPACE_ERROR_CODES)[keyof typeof WORKSPACE_ERROR_CODES];

/** Field-level validation detail; never contains private payloads. */
export interface WorkspaceFieldError {
  field: string;
  code: string;
  message: string;
}

/** Stable, actionable error envelope returned by workspace endpoints. */
export interface WorkspaceError {
  code: WorkspaceErrorCode;
  message: string;
  /** Correlation id for support; safe to display. */
  requestId?: string;
  /** Present for STALE_VERSION / CONFLICT responses. */
  currentVersion?: EntityVersion;
  /** Present for VALIDATION_FAILED responses. */
  fieldErrors?: WorkspaceFieldError[];
  /** Present for RATE_LIMITED responses (seconds). */
  retryAfterSeconds?: number;
}

/** Generic success envelope. */
export interface WorkspaceResponse<T> {
  data: T;
  requestId?: string;
}

/** Generic failure envelope. */
export interface WorkspaceErrorResponse {
  error: WorkspaceError;
  requestId?: string;
}

export type WorkspaceResult<T> = WorkspaceResponse<T> | WorkspaceErrorResponse;

/** Type guard for error envelopes. */
export function isWorkspaceError<T>(
  result: WorkspaceResult<T>,
): result is WorkspaceErrorResponse {
  return typeof (result as WorkspaceErrorResponse).error !== 'undefined';
}

/** Paginated collection envelope. */
export interface WorkspacePage<T> {
  items: T[];
  nextCursor: PageCursor;
  total?: number;
}

/** Common mutation metadata for idempotent, versioned writes. */
export interface WorkspaceMutationMeta {
  idempotencyKey: IdempotencyKey;
  expectedVersion?: EntityVersion;
}

/* -------------------------------------------------------------------------- */
/* CAPSTONE-070 — Project decisions                                           */
/* -------------------------------------------------------------------------- */

export type DecisionStatus =
  | 'draft'
  | 'proposed'
  | 'approved'
  | 'rejected'
  | 'superseded'
  | 'withdrawn';

/** Allowed decision lifecycle transitions (deny-by-default). */
export const DECISION_TRANSITIONS: Readonly<
  Record<DecisionStatus, readonly DecisionStatus[]>
> = {
  draft: ['proposed', 'withdrawn'],
  proposed: ['approved', 'rejected', 'withdrawn'],
  approved: ['superseded'],
  rejected: [],
  superseded: [],
  withdrawn: [],
};

export function canTransitionDecision(
  from: DecisionStatus,
  to: DecisionStatus,
): boolean {
  return DECISION_TRANSITIONS[from]?.includes(to) ?? false;
}

/** A single approver reference; identity data is minimized to an opaque id. */
export interface DecisionApprover {
  memberId: WorkspaceId;
  displayName: string;
  approvedAt?: IsoDateTimeString;
}

/** Link to supporting evidence; only a reference and label are exposed. */
export interface DecisionEvidenceLink {
  id: WorkspaceId;
  label: string;
  /** Safe, non-sensitive URL (no signed tokens or private payloads). */
  url?: string;
  kind: 'document' | 'review' | 'source-control' | 'external';
}

export interface Decision {
  id: WorkspaceId;
  tenantId: WorkspaceId;
  projectId: WorkspaceId;
  statement: string;
  context: string;
  alternatives: string[];
  approvers: DecisionApprover[];
  effectiveDate: IsoDateTimeString;
  evidenceLinks: DecisionEvidenceLink[];
  /** Id of the decision this record supersedes, if any. */
  supersedesId: WorkspaceId | null;
  /** Id of the decision that superseded this record, if any. */
  supersededById: WorkspaceId | null;
  version: EntityVersion;
  status: DecisionStatus;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface CreateDecisionRequest {
  projectId: WorkspaceId;
  statement: string;
  context: string;
  alternatives: string[];
  approverIds: WorkspaceId[];
  effectiveDate: IsoDateTimeString;
  evidenceLinkIds: WorkspaceId[];
  supersedesId?: WorkspaceId | null;
}

export interface UpdateDecisionRequest extends WorkspaceMutationMeta {
  decisionId: WorkspaceId;
  statement?: string;
  context?: string;
  alternatives?: string[];
  approverIds?: WorkspaceId[];
  effectiveDate?: IsoDateTimeString;
  evidenceLinkIds?: WorkspaceId[];
}

export interface TransitionDecisionRequest extends WorkspaceMutationMeta {
  decisionId: WorkspaceId;
  to: DecisionStatus;
  /** Required when transitioning to 'superseded'. */
  supersededById?: WorkspaceId;
}

export type DecisionListResponse = WorkspaceResult<WorkspacePage<Decision>>;
export type DecisionResponse = WorkspaceResult<Decision>;

/* -------------------------------------------------------------------------- */
/* CAPSTONE-071 — Source-control references                                   */
/* -------------------------------------------------------------------------- */

export type SourceControlProvider = 'github' | 'gitlab' | 'bitbucket';

export type SourceControlConnectionStatus =
  | 'pending'
  | 'active'
  | 'revoked'
  | 'error';

/** Minimized scopes; never includes tokens or secrets. */
export type SourceControlScope =
  | 'repo:read'
  | 'repo:metadata'
  | 'commits:read'
  | 'releases:read'
  | 'webhooks:manage';

export interface SourceControlConnection {
  id: WorkspaceId;
  tenantId: WorkspaceId;
  projectId: WorkspaceId;
  provider: SourceControlProvider;
  /** Human-readable account/org label; no credentials. */
  accountLabel: string;
  scopes: SourceControlScope[];
  status: SourceControlConnectionStatus;
  createdAt: IsoDateTimeString;
  revokedAt: IsoDateTimeString | null;
  version: EntityVersion;
}

export interface CreateSourceControlConnectionRequest {
  projectId: WorkspaceId;
  provider: SourceControlProvider;
  scopes: SourceControlScope[];
  /** Provider OAuth handshake reference; the token itself never reaches the client. */
  authorizationCode: string;
}

export interface RevokeSourceControlConnectionRequest extends WorkspaceMutationMeta {
  connectionId: WorkspaceId;
}

export interface SourceControlContributionMetadata {
  authorDisplayName: string;
  /** Opaque author id; no email or identity payloads. */
  authorId: string;
  additions?: number;
  deletions?: number;
  filesChanged?: number;
}

export interface SourceControlReference {
  id: WorkspaceId;
  tenantId: WorkspaceId;
  projectId: WorkspaceId;
  connectionId: WorkspaceId;
  provider: SourceControlProvider;
  repository: string;
  branch: string;
  commit: string;
  release: string | null;
  contribution: SourceControlContributionMetadata | null;
  createdAt: IsoDateTimeString;
  version: EntityVersion;
}

export interface CreateSourceControlReferenceRequest {
  projectId: WorkspaceId;
  connectionId: WorkspaceId;
  repository: string;
  branch: string;
  commit: string;
  release?: string | null;
}

export type SourceControlConnectionResponse = WorkspaceResult<SourceControlConnection>;
export type SourceControlConnectionListResponse = WorkspaceResult<
  WorkspacePage<SourceControlConnection>
>;
export type SourceControlReferenceResponse = WorkspaceResult<SourceControlReference>;
export type SourceControlReferenceListResponse = WorkspaceResult<
  WorkspacePage<SourceControlReference>
>;

/* -------------------------------------------------------------------------- */
/* CAPSTONE-073 — Proposal review queues                                      */
/* -------------------------------------------------------------------------- */

export type ReviewPriority = 'low' | 'normal' | 'high' | 'urgent';

export type ReviewQueueItemStatus =
  | 'unassigned'
  | 'assigned'
  | 'in_review'
  | 'completed'
  | 'reassigned';

export type ExpertiseFit = 'none' | 'partial' | 'strong';

export interface ReviewWorkloadIndicator {
  /** Number of active assignments for the reviewer. */
  activeAssignments: number;
  /** Configured capacity ceiling. */
  capacity: number;
  /** Derived utilization ratio in [0, 1+]. */
  utilization: number;
}

export interface ReviewQueueItem {
  id: WorkspaceId;
  tenantId: WorkspaceId;
  projectId: WorkspaceId;
  proposalId: WorkspaceId;
  proposalTitle: string;
  status: ReviewQueueItemStatus;
  /** Assigned reviewer, if any. */
  assigneeId: WorkspaceId | null;
  assigneeDisplayName: string | null;
  expertiseFit: ExpertiseFit;
  priority: ReviewPriority;
  conflictDeclared: boolean;
  dueDate: IsoDateTimeString;
  workload: ReviewWorkloadIndicator;
  version: EntityVersion;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface ReviewQueueFilters {
  status?: ReviewQueueItemStatus[];
  priority?: ReviewPriority[];
  expertiseFit?: ExpertiseFit[];
  assigneeId?: WorkspaceId;
  dueBefore?: IsoDateTimeString;
  conflictDeclared?: boolean;
  cursor?: PageCursor;
  limit?: number;
}

export interface AssignReviewQueueItemRequest extends WorkspaceMutationMeta {
  queueItemId: WorkspaceId;
  assigneeId: WorkspaceId;
}

export interface DeclareReviewConflictRequest extends WorkspaceMutationMeta {
  queueItemId: WorkspaceId;
  /** Reason category only; free-text rationale stays private. */
  reason: 'employment' | 'financial' | 'personal' | 'other';
}

export type ReviewQueueItemResponse = WorkspaceResult<ReviewQueueItem>;
export type ReviewQueueListResponse = WorkspaceResult<WorkspacePage<ReviewQueueItem>>;

/* -------------------------------------------------------------------------- */
/* CAPSTONE-075 — Independent proposal reviews                                */
/* -------------------------------------------------------------------------- */

export type ReviewRecommendation =
  | 'strong_accept'
  | 'accept'
  | 'neutral'
  | 'reject'
  | 'strong_reject';

export type ReviewConfidence = 'low' | 'medium' | 'high';

export type ReviewConflictKind =
  | 'employment'
  | 'financial'
  | 'personal'
  | 'other';

export interface ReviewCriterionScore {
  criterionId: WorkspaceId;
  criterionLabel: string;
  /** Integer score within the criterion's configured range. */
  score: number;
  maxScore: number;
}

export interface IndependentReview {
  id: WorkspaceId;
  tenantId: WorkspaceId;
  projectId: WorkspaceId;
  proposalId: WorkspaceId;
  /** Immutable linkage to the exact submission version reviewed. */
  submissionVersionId: WorkspaceId;
  reviewerId: WorkspaceId;
  criterionScores: ReviewCriterionScore[];
  comments: string;
  confidence: ReviewConfidence;
  recommendation: ReviewRecommendation;
  conflicts: ReviewConflictKind[];
  version: EntityVersion;
  submittedAt: IsoDateTimeString;
}

export interface SubmitIndependentReviewRequest extends WorkspaceMutationMeta {
  proposalId: WorkspaceId;
  submissionVersionId: WorkspaceId;
  criterionScores: ReviewCriterionScore[];
  comments: string;
  confidence: ReviewConfidence;
  recommendation: ReviewRecommendation;
  conflicts: ReviewConflictKind[];
}

export interface UpdateIndependentReviewRequest extends WorkspaceMutationMeta {
  reviewId: WorkspaceId;
  criterionScores?: ReviewCriterionScore[];
  comments?: string;
  confidence?: ReviewConfidence;
  recommendation?: ReviewRecommendation;
  conflicts?: ReviewConflictKind[];
}

export type IndependentReviewResponse = WorkspaceResult<IndependentReview>;
export type IndependentReviewListResponse = WorkspaceResult<
  WorkspacePage<IndependentReview>
>;