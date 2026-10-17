import type { Metadata } from 'next';
import { MentorshipAuditLogPanel } from '@/src/features/mentorship/audit';

export const metadata: Metadata = {
  title: 'Mentorship Audit Log — ChainVerse',
  description: 'Tamper-evident mentorship audit log with role-aware filtering and export.',
};

export default function Page() {
  return <MentorshipAuditLogPanel />;
}
