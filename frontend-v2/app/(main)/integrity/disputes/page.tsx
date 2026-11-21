import { DisputePanel } from '@/src/features/capstone/integrity/DisputePanel';

export default async function ProjectDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const params = await searchParams;
  return <DisputePanel projectId={params.projectId ?? ''} />;
}
