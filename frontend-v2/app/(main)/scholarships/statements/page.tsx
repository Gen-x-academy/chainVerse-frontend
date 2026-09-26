import { ScholarshipStatementExport } from '@/src/features/scholarships/statements';

export default function ScholarshipStatementsPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-indigo-600">Sponsor finance</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Sponsor financial statements</h1>
          <p className="mt-3 text-base text-slate-600">
            Period statements where every line traces to a ledger entry. Large exports run as a background job so
            the request is never held open.
          </p>
        </header>

        <ScholarshipStatementExport
          sponsorId="sponsor-acme"
          programId="chainverse-scholarship"
          initialPeriod={{ from: '2026-01-01', to: '2026-03-31' }}
        />
      </div>
    </main>
  );
}
