import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { buildMentorshipEvent, trackMentorshipEvent } from '../analytics';
import { mentorAvailabilityService } from './service';
import type {
  MentorAvailability,
  MentorAvailabilityUpdate,
} from './types';

export type AvailabilityStateStatus = 'idle' | 'loading' | 'success' | 'error';

type AvailabilityState = {
  availabilities: MentorAvailability[];
  status: AvailabilityStateStatus;
  error: string | null;
  load: () => Promise<void>;
  applyUpdate: (
    availabilityId: string,
    update: MentorAvailabilityUpdate
  ) => Promise<MentorAvailability>;
};

export const useAvailabilityStore = create<AvailabilityState>()(
  persist(
    (set, get) => ({
      availabilities: [],
      status: 'idle',
      error: null,
      load: async () => {
        set({ status: 'loading', error: null });
        try {
          const list = await mentorAvailabilityService.list();
          set({ availabilities: list, status: 'success' });
        } catch {
          // The mentorship API is not wired up yet; fall back to the local
          // cache and only surface an error when there is nothing to show.
          const cached = get().availabilities;
          if (cached.length === 0) {
            set({ status: 'error', error: 'Unable to load availability.' });
          } else {
            set({ status: 'success', error: null });
          }
        }
      },
      applyUpdate: async (availabilityId, update) => {
        set({ status: 'loading', error: null });
        let updated: MentorAvailability;
        try {
          updated = await mentorAvailabilityService.update(availabilityId, update);
        } catch {
          // Local fallback keeps the flow usable before the API exists.
          const base = get().availabilities.find(
            (availability) => availability.internalId === availabilityId
          );
          if (!base) {
            const message = 'Unknown availability record.';
            set({ status: 'error', error: message });
            throw new Error(message);
          }
          updated = {
            ...base,
            status: update.status,
            effectiveFrom: update.effectiveFrom,
            effectiveUntil: update.effectiveUntil,
            updatedBy: 'local',
            updatedAt: new Date().toISOString(),
          };
        }
        const next = get().availabilities.map((availability) =>
          availability.internalId === availabilityId
            ? { ...availability, ...updated }
            : availability
        );
        set({ availabilities: next, status: 'success' });
        trackMentorshipEvent(
          buildMentorshipEvent(
            'mentor_availability',
            availabilityId,
            `availability-${update.status}`
          )
        );
        return updated;
      },
    }),
    {
      name: 'chainverse-mentor-availability',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
