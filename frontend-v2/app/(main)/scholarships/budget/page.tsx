import { ProgramAwardInventory } from '@/src/features/scholarships/budget';

export default function ScholarshipBudgetPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">Budgeting</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Award inventory and capacity</h1>
          <p className="mt-3 text-base text-slate-600">
            Set the maximum recipients, per-award amount, total budget, and reserve rules while keeping remaining capacity authoritative.
          </p>
        </header>

        <ProgramAwardInventory
          programId="chainverse-scholarship"
          programName="ChainVerse Scholarship"
          canManage={true}
        />
      </div>
    </main>
  );
}
