import type { Metadata } from 'next';
import { StagingPage } from '@/src/features/scholarships/pages/StagingPage';

export const metadata: Metadata = {
  title: 'Scholarships Staging & Testnet Seed — ChainVerse',
  description: 'Deterministic synthetic seed runs for staging and testnet with rollback manifests and one-call revoke.',
};

export default function Page() {
  return <StagingPage />;
}