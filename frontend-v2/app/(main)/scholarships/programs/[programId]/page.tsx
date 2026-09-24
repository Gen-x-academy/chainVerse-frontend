import { PublishedProgramTerms } from '@/src/features/scholarships/programs';

export default async function ScholarshipProgramDetailPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;

  const labels: Record<string, string> = {
    'chainverse-scholarship': 'ChainVerse Scholarship',
    'women-in-stem': 'Women in STEM Bursary',
    'community-impact': 'Community Impact Sponsorship',
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <PublishedProgramTerms
          programId={programId}
          programName={labels[programId] ?? 'Scholarship Program'}
          canReview={true}
          applicationId={`application-${programId}-001`}
        />
      </div>
    </main>
  );
}
