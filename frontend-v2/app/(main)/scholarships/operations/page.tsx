import type { Metadata } from 'next';
import { OperationsPage } from '@/src/features/scholarships/pages/OperationsPage';

export const metadata: Metadata = {
  title: 'Scholarships Operations — ChainVerse',
  description:
    'Domain event outbox, on-chain settlement reconciliation, legacy financial-aid migration, and scholarship administration configuration.',
};

export default function Page() {
  return <OperationsPage />;
}
