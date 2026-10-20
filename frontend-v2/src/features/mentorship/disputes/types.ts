export const SESSION_DISPUTE_ISSUES = [
  "attendance",
  "completion",
  "duration",
  "outcome",
] as const;

export type SessionDisputeIssue = (typeof SESSION_DISPUTE_ISSUES)[number];
export type SessionDisputeStatus =
  | "awaiting-response"
  | "under-review"
  | "escalated"
  | "resolved";
export type SessionSettlementStatus =
  | "pending"
  | "paused"
  | "settled"
  | "refunded";
export type SessionDisputeDecision =
  | "confirm-completion"
  | "refund"
  | "partial-refund";

export interface DisputableSession {
  publicId: string;
  completedAt: string;
  settlementStatus: "pending";
  canOpenDispute: boolean;
}

export interface SessionDisputeResponse {
  submittedAt: string;
  summary: string;
  evidenceReferences: string[];
}

export interface SessionDisputeResolution {
  decision: SessionDisputeDecision;
  rationale: string;
  resolvedAt: string;
  auditEventId: string;
}

export interface SessionDispute {
  publicId: string;
  sessionId: string;
  isOpenedByCurrentUser: boolean;
  issue: SessionDisputeIssue;
  summary: string;
  evidenceReferences: string[];
  status: SessionDisputeStatus;
  openedAt: string;
  responseDeadlineAt: string;
  response?: SessionDisputeResponse;
  settlementStatus: SessionSettlementStatus;
  permissions: {
    canRespond: boolean;
    canResolve: boolean;
  };
  resolution?: SessionDisputeResolution;
}

export interface SessionDisputeSnapshot {
  tenantId: string;
  sessions: DisputableSession[];
  disputes: SessionDispute[];
}

export interface OpenSessionDisputeInput {
  sessionId: string;
  issue: SessionDisputeIssue;
  summary: string;
  evidenceReferences: string[];
}
