import { ScholarshipRecoveryPanel } from '@/src/features/scholarships/recovery';

export default function ScholarshipRecoveryPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">Finance</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Recoveries and clawbacks</h1>
          <p className="mt-3 text-base text-slate-600">
            Reclaim funds from awarded scholarships with a recorded legal basis, an approved claim, and an
            explicit authorization id. No recovery debits a wallet silently.
          </p>
        </header>

        <ScholarshipRecoveryPanel programId="chainverse-scholarship" canManage />
      </div>
    </main>
  );
}
