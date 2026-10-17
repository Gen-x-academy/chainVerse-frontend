/**
 * Field-level mentorship privacy controls (MENTOR-106).
 */

export type MentorshipFieldName =
  | 'profile'
  | 'goals'
  | 'availability'
  | 'achievements'
  | 'contact';

export type MentorshipAudience = 'public' | 'mentors' | 'mentees' | 'staff' | 'private';

export type MentorshipPrivacySetting = {
  field: MentorshipFieldName;
  audience: MentorshipAudience;
  visible: boolean;
  updatedAt: string;
  version: number;
};

export type MentorshipPrivacyPreferences = {
  userId: string;
  settings: MentorshipPrivacySetting[];
  version: number;
  updatedAt: string;
};
