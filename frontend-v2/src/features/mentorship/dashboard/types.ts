/**
 * Mentor operations dashboard (issue #1362).
 *
 * Shows authorized mentors upcoming sessions, applications/proposals, active
 * mentees, tasks, milestones, availability gaps, earnings summary, and alerts.
 * Data is role-scoped; private counterpart information is minimized.
 */

export type MentorSession = {
  id: string;
  title: string;
  startsAt: string;
  menteeAlias: string; // minimal counterpart info
  status: 'scheduled' | 'completed' | 'cancelled';
};

export type MentorApplication = {
  id: string;
  menteeAlias: string;
  programId: string;
  submittedAt: string;
  status: 'pending' | 'accepted' | 'declined';
};

export type MentorTask = {
  id: string;
  title: string;
  dueAt: string;
  milestoneId?: string;
  done: boolean;
};

export type MentorMilestone = {
  id: string;
  title: string;
  dueAt: string;
  completed: boolean;
};

export type MentorEarningsSummary = {
  currency: string;
  pending: number;
  settled: number;
  period: string;
};

export type MentorAlert = {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  href?: string;
};

export type MentorDashboardData = {
  mentorId: string;
  tenantId: string;
  sessions: MentorSession[];
  applications: MentorApplication[];
  activeMentees: number;
  tasks: MentorTask[];
  milestones: MentorMilestone[];
  availabilityGaps: string[];
  earnings: MentorEarningsSummary;
  alerts: MentorAlert[];
  generatedAt: string;
};
