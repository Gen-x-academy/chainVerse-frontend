import { EthicsScreeningPanel } from '@/src/features/capstone/integrity/EthicsScreeningPanel';

export default async function EthicsScreeningPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const params = await searchParams;
  return <EthicsScreeningPanel projectId={params.projectId ?? ''} />;
}
