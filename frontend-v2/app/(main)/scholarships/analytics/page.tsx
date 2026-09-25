import type { Metadata } from 'next';
import { AnalyticsPage } from '@/src/features/scholarships/pages/AnalyticsPage';

export const metadata: Metadata = {
  title: 'Scholarships Analytics — ChainVerse',
  description:
    'Versioned scholarship funnel metrics, privacy-safe sponsor impact reporting, and operational service-level indicators.',
};

export default function Page() {
  return <AnalyticsPage />;
}
