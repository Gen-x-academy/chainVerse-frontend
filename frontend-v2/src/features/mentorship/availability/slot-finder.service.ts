import { apiClient } from '@/src/lib/api-client';
import { buildMentorshipEvent, trackMentorshipEvent } from '../analytics';
import type { SessionSlotCandidate, SlotSearchPage } from './slot-finder';

const BASE = '/mentorship/programs';

export interface FindSessionSlotsRequest {
  rangeStart: string;
  rangeEnd: string;
  limit?: number;
  cursor?: string;
}

export interface RevalidateSessionSlotRequest {
  candidate: SessionSlotCandidate;
  rangeStart: string;
  rangeEnd: string;
}

export const sessionSlotService = {
  find: (programId: string, input: FindSessionSlotsRequest): Promise<SlotSearchPage> => {
    const query = new URLSearchParams({
      rangeStart: input.rangeStart,
      rangeEnd: input.rangeEnd,
    });
    if (input.limit !== undefined) query.set('limit', String(input.limit));
    if (input.cursor) query.set('cursor', input.cursor);
    return apiClient.get<SlotSearchPage>(
      `${BASE}/${encodeURIComponent(programId)}/slots?${query.toString()}`,
    );
  },

  revalidate: (
    programId: string,
    input: RevalidateSessionSlotRequest,
  ): Promise<SessionSlotCandidate> =>
    apiClient.post<SessionSlotCandidate>(
      `${BASE}/${encodeURIComponent(programId)}/slots/revalidate`,
      input,
    ),
};

export function trackSessionSlotSearch(
  programId: string,
  actorKey: string,
  resultCount: number,
  occurredAt: Date = new Date(),
): void {
  trackMentorshipEvent(
    buildMentorshipEvent(
      'session_slot_search',
      `${programId}:${resultCount}`,
      actorKey,
      occurredAt,
    ),
  );
}
