import type { Metadata } from 'next';
import { AuditPage } from '@/src/features/scholarships/pages/AuditPage';

export const metadata: Metadata = {
  title: 'Scholarships Audit & Privacy — ChainVerse',
  description:
    'Immutable hash-chained scholarship audit trail, applicant data access and export, correction and erasure handling, and scoped sponsor/regulator audit exports.',
};

export default function Page() {
  return <AuditPage />;
}
