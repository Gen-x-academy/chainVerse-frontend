import type { Metadata } from 'next';
import { MentorshipProgramAnalyticsPanel } from '@/src/features/mentorship/analytics';

export const metadata: Metadata = {
  title: 'Mentorship Program Analytics — ChainVerse',
  description: 'Privacy-safe mentorship program analytics with scoped access and suppression thresholds.',
};

export default function Page() {
  return <MentorshipProgramAnalyticsPanel />;
}
