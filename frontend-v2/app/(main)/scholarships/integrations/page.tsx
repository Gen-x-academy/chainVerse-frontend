import type { Metadata } from 'next';
import { IntegrationsPage } from '@/src/features/scholarships/pages/IntegrationsPage';

export const metadata: Metadata = {
  title: 'Scholarships Integrations — ChainVerse',
  description:
    'Versioned scholarship API contracts, idempotent mutations, and signed sponsor webhooks with delivery history.',
};

export default function Page() {
  return <IntegrationsPage />;
}
