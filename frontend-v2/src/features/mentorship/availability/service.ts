import { apiClient } from '@/src/lib/api-client';
import type { MentorAvailability, MentorAvailabilityUpdate } from './types';

const BASE = '/mentorship/availability';

/** Availability is read-only for mentors and updatable by staff. */
export const mentorAvailabilityService = {
  list: () => apiClient.get<MentorAvailability[]>(`${BASE}`),

  get: (availabilityId: string) =>
    apiClient.get<MentorAvailability>(`${BASE}/${availabilityId}`),

  update: (availabilityId: string, payload: MentorAvailabilityUpdate) =>
    apiClient.patch<MentorAvailability>(`${BASE}/${availabilityId}`, payload),
};
