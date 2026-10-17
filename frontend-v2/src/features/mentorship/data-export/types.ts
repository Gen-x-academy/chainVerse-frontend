/**
 * Mentorship data export (MENTOR-108).
 */

export type MentorshipExportRequest = {
  userId: string;
  requestedAt: string;
  status: 'pending' | 'ready' | 'expired' | 'failed';
  downloadUrl?: string;
  expiresAt?: string;
};

export type MentorshipExportBundle = {
  includes: string[];
  generatedAt: string;
  expiresAt: string;
};
