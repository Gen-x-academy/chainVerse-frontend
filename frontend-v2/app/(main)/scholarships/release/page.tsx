import type { Metadata } from 'next';
import { ReleasePage } from '@/src/features/scholarships/pages/ReleasePage';

export const metadata: Metadata = {
  title: 'Scholarships Launch Readiness — ChainVerse',
  description: 'Go-live checklist, named owner sign-off, rollback planning that preserves applications and funds, and scheduled post-launch review.',
};

export default function Page() {
  return <ReleasePage />;
}