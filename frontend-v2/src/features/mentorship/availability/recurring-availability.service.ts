import { apiClient } from '@/src/lib/api-client';
import { buildMentorshipEvent, trackMentorshipEvent } from '../analytics';
import type {
  AvailabilitySlot,
  RecurringAvailability,
} from './recurring-availability';

const BASE = '/mentorship/availability/recurring';

export interface RecurringAvailabilityUpdateRequest {
  schedule: RecurringAvailability;
  expectedVersion: number;
  idempotencyKey: string;
  acknowledgeConflicts?: boolean;
}

export interface RecurringAvailabilityPreview {
  slots: AvailabilitySlot[];
}

export const recurringAvailabilityService = {
  get: (mentorId: string): Promise<RecurringAvailability> =>
    apiClient.get<RecurringAvailability>(
      `${BASE}/${encodeURIComponent(mentorId)}`,
    ),

  update: (
    mentorId: string,
    input: RecurringAvailabilityUpdateRequest,
  ): Promise<RecurringAvailability> =>
    apiClient.put<RecurringAvailability>(
      `${BASE}/${encodeURIComponent(mentorId)}`,
      input,
    ),

  preview: (
    mentorId: string,
    from: string,
    to: string,
  ): Promise<RecurringAvailabilityPreview> => {
    const query = new URLSearchParams({ from, to });
    return apiClient.get<RecurringAvailabilityPreview>(
      `${BASE}/${encodeURIComponent(mentorId)}/preview?${query.toString()}`,
    );
  },
};

export function trackRecurringAvailabilityUpdated(
  schedule: RecurringAvailability,
  actorKey: string,
  occurredAt: Date = new Date(),
): void {
  trackMentorshipEvent(
    buildMentorshipEvent(
      'mentor_availability',
      schedule.id,
      actorKey,
      occurredAt,
    ),
  );
}
