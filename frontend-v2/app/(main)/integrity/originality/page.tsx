import { OriginalityCheckPanel } from '@/src/features/capstone/integrity/OriginalityCheckPanel';

export default async function OriginalityChecksPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; submissionVersionId?: string }>;
}) {
  const params = await searchParams;
  return (
    <OriginalityCheckPanel
      projectId={params.projectId ?? ''}
      submissionVersionId={params.submissionVersionId ?? ''}
    />
  );
}
