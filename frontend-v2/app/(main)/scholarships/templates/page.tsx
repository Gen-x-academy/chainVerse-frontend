import { ScholarshipTemplateStudio } from '@/src/features/scholarships/templates';

export default function ScholarshipTemplatesPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">Communications</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Versioned templates</h1>
          <p className="mt-3 text-base text-slate-600">
            Author award, disbursement, and review-outcome copy once. Validation, approval, and
            rollback are recorded per version.
          </p>
        </header>

        <ScholarshipTemplateStudio programId="chainverse-scholarship" canManage={true} />
      </div>
    </main>
  );
}
