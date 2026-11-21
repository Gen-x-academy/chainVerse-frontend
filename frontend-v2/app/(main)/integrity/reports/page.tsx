import { ConcernReportPanel } from '@/src/features/capstone/integrity/ConcernReportPanel';

export default async function IntegrityReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const params = await searchParams;
  return <ConcernReportPanel projectId={params.projectId ?? ''} />;
}
