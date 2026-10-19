import { apiClient } from '@/src/lib/api-client';
import { buildMentorshipEvent, trackMentorshipEvent } from '../analytics';
import type {
  CancellationReasonCode,
  MentorshipSession,
  SessionCancellation,
} from './session-core';

const SESSIONS = '/mentorship/sessions';

export interface CancelSessionRequest {
  reasonCode: CancellationReasonCode;
  note?: string;
  /** The refund from the preview the user confirmed, in minor units. */
  acknowledgedRefundMinor: number;
  idempotencyKey: string;
}

export interface CancelSessionResponse {
  session: Pick<MentorshipSession, 'sessionId' | 'status' | 'revision'>;
  cancellation: SessionCancellation;
  /** True when the API recognised a repeat and returned the original cancellation. */
  replayed: boolean;
}

export const sessionCancellationService = {
  /** The key travels in the body and in the standard header. A repeat is always safe. */
  cancel: (sessionId: string, request: CancelSessionRequest): Promise<CancelSessionResponse> =>
    apiClient.post<CancelSessionResponse>(
      `${SESSIONS}/${encodeURIComponent(sessionId)}/cancellation`,
      request,
      { headers: { 'Idempotency-Key': request.idempotencyKey } },
    ),
};

export function trackSessionCancelled(
  sessionId: string,
  actorKey: string,
  occurredAt: Date = new Date(),
): void {
  trackMentorshipEvent(buildMentorshipEvent('session_cancellation', sessionId, actorKey, occurredAt));
}

/** Cancels a session and counts it once. A replay is the same cancellation seen again. */
export async function submitSessionCancellation(
  sessionId: string,
  request: CancelSessionRequest,
  actorKey: string,
): Promise<CancelSessionResponse> {
  const response = await sessionCancellationService.cancel(sessionId, request);
  if (!response.replayed) trackSessionCancelled(response.session.sessionId, actorKey);
  return response;
}
