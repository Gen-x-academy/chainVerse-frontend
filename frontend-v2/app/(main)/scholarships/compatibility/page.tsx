import type { Metadata } from 'next';
import { CompatibilityPage } from '@/src/features/scholarships/pages/CompatibilityPage';

export const metadata: Metadata = {
  title: 'Scholarships Compatibility Gate — ChainVerse',
  description: 'Contract, event, database schema, and Stellar ABI change review against the approved baseline.',
};

export default function Page() {
  return <CompatibilityPage />;
}