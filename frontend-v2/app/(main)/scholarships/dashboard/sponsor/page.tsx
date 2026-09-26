import { SponsorProgramDashboard } from '@/src/features/scholarships/dashboards/sponsor';

export default function SponsorProgramDashboardPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">Sponsor reporting</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Sponsor program dashboard</h1>
          <p className="mt-3 text-base text-slate-600">
            Budget, funnel, and impact for the programs you fund — scoped to your sponsor account and reconciled
            against the ledger.
          </p>
        </header>

        <SponsorProgramDashboard sponsorId="sponsor-acme" programId="chainverse-scholarship" allowed />
      </div>
    </main>
  );
}
