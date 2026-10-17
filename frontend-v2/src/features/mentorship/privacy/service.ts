/**
 * Field-level mentorship privacy controls (MENTOR-106).
 */

import { apiClient } from '@/lib/api-client';
import type { MentorshipPrivacyPreferences, MentorshipPrivacySetting } from './types';

const PATH = '/mentorship/privacy';

export const mentorshipPrivacyService = {
  get: (userId: string): Promise<MentorshipPrivacyPreferences> =>
    apiClient.get<MentorshipPrivacyPreferences>(`${PATH}/${encodeURIComponent(userId)}`),

  update: (userId: string, settings: MentorshipPrivacySetting[]): Promise<MentorshipPrivacyPreferences> =>
    apiClient.put<MentorshipPrivacyPreferences>(`${PATH}/${encodeURIComponent(userId)}`, { settings }),
};
