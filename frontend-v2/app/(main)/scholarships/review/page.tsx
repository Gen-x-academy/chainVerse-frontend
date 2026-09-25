import type { Metadata } from 'next';
import { ReviewPage } from '@/src/features/scholarships/pages/ReviewPage';

export const metadata: Metadata = {
  title: 'Scholarship Review — ChainVerse',
  description:
    'Define versioned scoring rubrics, save private review drafts, submit and lock completed reviews, and request additional applicant information.',
};

export default function Page() {
  return <ReviewPage />;
}
