import { ScholarshipFairnessReport } from '@/src/features/scholarships/fairness';

export default function ScholarshipFairnessPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">Equity</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Funnel and bias audit</h1>
          <p className="mt-3 text-base text-slate-600">
            Publish selection rates with a definition and a caveat, suppress cohorts smaller than ten,
            and require a named approver before a high-risk rule version ships.
          </p>
        </header>

        <ScholarshipFairnessReport programId="chainverse-scholarship" canManage={true} />
      </div>
    </main>
  );
}
