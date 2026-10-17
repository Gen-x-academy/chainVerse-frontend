import type { Metadata } from 'next';
import { MentorOperationsDashboardPanel } from '@/src/features/mentorship/dashboard';

export const metadata: Metadata = {
  title: 'Mentor Operations Dashboard — ChainVerse',
  description: 'Role-scoped mentor operations dashboard with sessions, applications, tasks, and earnings.',
};

export default function Page() {
  return <MentorOperationsDashboardPanel />;
}
