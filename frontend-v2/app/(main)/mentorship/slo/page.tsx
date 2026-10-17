import type { Metadata } from 'next';
import { MentorshipSloPanel } from '@/src/features/mentorship/slo';

export const metadata: Metadata = {
  title: 'Mentorship Service-Level Objectives — ChainVerse',
  description: 'Mentorship SLO dashboard with owners, alert thresholds, burn rate, and error budget.',
};

export default function Page() {
  return <MentorshipSloPanel />;
}
