import { PublishedProgramTerms } from '@/src/features/scholarships/programs';

export default function ScholarshipProgramsPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">Programs</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Published scholarship terms</h1>
          <p className="mt-3 text-base text-slate-600">
            Every published revision is immutable and remains retrievable for applicant history and audit review.
          </p>
        </header>

        <PublishedProgramTerms
          programId="chainverse-scholarship"
          programName="ChainVerse Scholarship"
          canReview={true}
          applicationId="application-demo-001"
        />
      </div>
    </main>
  );
}
