export type SessionSummaryState = "draft" | "confirmed";

export interface SessionSummaryResource {
  label: string;
  url: string;
}

export interface SessionSummaryContent {
  summaryText: string;
  decisions: string[];
  resources: SessionSummaryResource[];
  nextSteps: string[];
}

export interface SessionSummary extends SessionSummaryContent {
  id: string;
  sessionId: string;
  state: SessionSummaryState;
  authorId: string;
  updatedBy: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  confirmedBy?: string;
  confirmedAt?: string;
}

export interface SessionSummaryRecord {
  sessionId: string;
  mentorId: string;
  menteeId: string;
  summary: SessionSummary | null;
}

export interface SessionSummaryListItem {
  sessionId: string;
  startsAt: string;
  counterpartName: string;
  summaryState: SessionSummaryState | "missing";
}

export interface SessionSummaryDraftPayload extends SessionSummaryContent {
  expectedRevision: number;
}
