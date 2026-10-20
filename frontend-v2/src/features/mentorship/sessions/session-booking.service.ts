import { apiClient } from '@/src/lib/api-client';
import { buildMentorshipEvent, trackMentorshipEvent } from '../analytics';
import type { MentorshipSession, SessionMode } from './session-core';

const BASE = '/mentorship/agreements';

export interface BookSessionRequest {
  startsAt: string;
  durationMinutes: number;
  mode: SessionMode;
  locationRef?: string;
  agenda?: string;
  idempotencyKey: string;
  timeZone: string;
}

export interface BookSessionResponse {
  session: Pick<
    MentorshipSession,
    'sessionId' | 'startsAt' | 'endsAt' | 'mode' | 'durationMinutes'
  >;
  /** True when the API recognised the key and returned the original booking. */
  replayed: boolean;
}

export const sessionBookingService = {
  /**
   * The key travels in the body and in the standard header so gateways and the
   * API can both dedupe. Sending the same key again is always safe.
   */
  book: (agreementId: string, request: BookSessionRequest): Promise<BookSessionResponse> =>
    apiClient.post<BookSessionResponse>(
      `${BASE}/${encodeURIComponent(agreementId)}/sessions`,
      request,
      { headers: { 'Idempotency-Key': request.idempotencyKey } },
    ),
};

export function trackSessionBooked(
  sessionId: string,
  actorKey: string,
  occurredAt: Date = new Date(),
): void {
  trackMentorshipEvent(buildMentorshipEvent('session_booking', sessionId, actorKey, occurredAt));
}

/**
 * Books a session and records one analytics event for the booking. A replayed
 * response is the same booking seen again, so it is never counted twice.
 */
export async function submitSessionBooking(
  agreementId: string,
  request: BookSessionRequest,
  actorKey: string,
): Promise<BookSessionResponse> {
  const response = await sessionBookingService.book(agreementId, request);
  if (!response.replayed) trackSessionBooked(response.session.sessionId, actorKey);
  return response;
}
