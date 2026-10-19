import { apiClient } from '@/src/lib/api-client';
import { buildMentorshipEvent, trackMentorshipEvent } from '../analytics';
import type { MentorshipSession, RescheduleProposal } from './session-core';
import type { RescheduleDecision } from './session-reschedule';

const SESSIONS = '/mentorship/sessions';
const REQUESTS = '/mentorship/reschedule-requests';

export interface ProposeRescheduleRequest {
  proposedStartsAt: string;
  reason: string;
  /** The fee from the preview the requester confirmed, in minor units. */
  acknowledgedFeeMinor: number;
  idempotencyKey: string;
}

export interface ApplyRescheduleRequest {
  proposedStartsAt: string;
  reason: string;
  idempotencyKey: string;
}

export interface RescheduleResponse {
  proposal: RescheduleProposal;
  session: Pick<MentorshipSession, 'sessionId' | 'startsAt' | 'endsAt' | 'revision'>;
  /** True when the API recognised a repeat and returned the original result. */
  replayed: boolean;
}

export type RescheduleOutcome = 'proposed' | 'approved' | 'declined' | 'withdrawn' | 'applied';

export const sessionRescheduleService = {
  propose: (sessionId: string, request: ProposeRescheduleRequest): Promise<RescheduleResponse> =>
    apiClient.post<RescheduleResponse>(
      `${SESSIONS}/${encodeURIComponent(sessionId)}/reschedule-requests`,
      request,
      { headers: { 'Idempotency-Key': request.idempotencyKey } },
    ),

  /** Coordinators and administrators only; the API enforces it. */
  apply: (sessionId: string, request: ApplyRescheduleRequest): Promise<RescheduleResponse> =>
    apiClient.post<RescheduleResponse>(
      `${SESSIONS}/${encodeURIComponent(sessionId)}/reschedule`,
      request,
      { headers: { 'Idempotency-Key': request.idempotencyKey } },
    ),

  /** Answering twice is safe: the API returns the original answer. */
  decide: (proposalId: string, decision: RescheduleDecision): Promise<RescheduleResponse> =>
    apiClient.post<RescheduleResponse>(`${REQUESTS}/${encodeURIComponent(proposalId)}/${decision}`, {}),
};

export function trackSessionReschedule(
  proposalId: string,
  outcome: RescheduleOutcome,
  actorKey: string,
  occurredAt: Date = new Date(),
): void {
  trackMentorshipEvent(
    buildMentorshipEvent('session_reschedule', `${proposalId}:${outcome}`, actorKey, occurredAt),
  );
}

const DECISION_OUTCOME: Record<RescheduleDecision, RescheduleOutcome> = {
  approve: 'approved',
  decline: 'declined',
  withdraw: 'withdrawn',
};

/** Records one analytics event per new fact; a replay is never counted again. */
export async function submitReschedule(
  sessionId: string,
  request: ProposeRescheduleRequest,
  actorKey: string,
): Promise<RescheduleResponse> {
  const response = await sessionRescheduleService.propose(sessionId, request);
  if (!response.replayed) trackSessionReschedule(response.proposal.proposalId, 'proposed', actorKey);
  return response;
}

export async function submitRescheduleApply(
  sessionId: string,
  request: ApplyRescheduleRequest,
  actorKey: string,
): Promise<RescheduleResponse> {
  const response = await sessionRescheduleService.apply(sessionId, request);
  if (!response.replayed) trackSessionReschedule(response.proposal.proposalId, 'applied', actorKey);
  return response;
}

export async function submitRescheduleDecision(
  proposalId: string,
  decision: RescheduleDecision,
  actorKey: string,
): Promise<RescheduleResponse> {
  const response = await sessionRescheduleService.decide(proposalId, decision);
  if (!response.replayed) trackSessionReschedule(proposalId, DECISION_OUTCOME[decision], actorKey);
  return response;
}
