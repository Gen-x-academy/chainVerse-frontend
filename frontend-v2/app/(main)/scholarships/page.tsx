import { ScholarshipsPage } from '@/src/features/scholarships';

export default function ScholarshipsRoute() {
import type { Metadata } from 'next';
import { ScholarshipsPage } from '@/src/features/scholarships/pages/ScholarshipsPage';

export const metadata: Metadata = {
  title: 'Scholarships Eligibility — ChainVerse',
  description: 'Configure and evaluate scholarship eligibility rules with deterministic checks and privacy-aware evidence collection.',
};

export default function Page() {
  return <ScholarshipsPage />;
}
