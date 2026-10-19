import { apiClient } from '@/src/lib/api-client';
import { buildMentorshipEvent, trackMentorshipEvent } from '../analytics';
import type { NoShowEvidence, NoShowOutcome, NoShowReport, NoShowType } from './session-core';

const SESSIONS = '/mentorship/sessions';
const REPORTS = '/mentorship/no-show-reports';

export interface CreateNoShowReportRequest {
  type: NoShowType;
  statement: string;
  evidence: readonly NoShowEvidence[];
  idempotencyKey: string;
}

export interface RespondToNoShowRequest {
  statement: string;
  evidence: readonly NoShowEvidence[];
}

export interface ResolveNoShowRequest {
  outcome: NoShowOutcome;
  note?: string;
}

export interface NoShowReportResponse {
  /** Already redacted for the viewer by the API; attachment references are restricted. */
  report: NoShowReport;
  /** True when the claim joined a report another participant opened. */
  merged: boolean;
  /** True when the API recognised a repeat and returned the original result. */
  replayed: boolean;
}

export const noShowReportService = {
  create: (sessionId: string, request: CreateNoShowReportRequest): Promise<NoShowReportResponse> =>
    apiClient.post<NoShowReportResponse>(
      `${SESSIONS}/${encodeURIComponent(sessionId)}/no-show-reports`,
      request,
      { headers: { 'Idempotency-Key': request.idempotencyKey } },
    ),

  respond: (reportId: string, request: RespondToNoShowRequest): Promise<NoShowReportResponse> =>
    apiClient.post<NoShowReportResponse>(`${REPORTS}/${encodeURIComponent(reportId)}/responses`, request),

  /** Coordinators and administrators only; the API enforces it. */
  resolve: (reportId: string, request: ResolveNoShowRequest): Promise<NoShowReportResponse> =>
    apiClient.post<NoShowReportResponse>(`${REPORTS}/${encodeURIComponent(reportId)}/resolution`, request),
};

export type NoShowStep = 'reported' | 'responded' | 'resolved';

export function trackNoShow(
  reportId: string,
  step: NoShowStep,
  actorKey: string,
  occurredAt: Date = new Date(),
): void {
  trackMentorshipEvent(buildMentorshipEvent('session_no_show', `${reportId}:${step}`, actorKey, occurredAt));
}

/** Records one analytics event per new fact. A replay is never counted again. */
export async function submitNoShowReport(
  sessionId: string,
  request: CreateNoShowReportRequest,
  actorKey: string,
): Promise<NoShowReportResponse> {
  const response = await noShowReportService.create(sessionId, request);
  if (!response.replayed) trackNoShow(response.report.reportId, 'reported', actorKey);
  return response;
}

export async function submitNoShowResponse(
  reportId: string,
  request: RespondToNoShowRequest,
  actorKey: string,
): Promise<NoShowReportResponse> {
  const response = await noShowReportService.respond(reportId, request);
  if (!response.replayed) trackNoShow(reportId, 'responded', actorKey);
  return response;
}

export async function submitNoShowResolution(
  reportId: string,
  request: ResolveNoShowRequest,
  actorKey: string,
): Promise<NoShowReportResponse> {
  const response = await noShowReportService.resolve(reportId, request);
  if (!response.replayed) trackNoShow(reportId, 'resolved', actorKey);
  return response;
}
