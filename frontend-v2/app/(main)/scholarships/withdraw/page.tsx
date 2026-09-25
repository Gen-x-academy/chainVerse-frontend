import { WithdrawalPanel } from '@/src/features/scholarships/withdrawal';

export default function ScholarshipWithdrawalPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">Withdrawal</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Withdraw from the program</h1>
          <p className="mt-3 text-base text-slate-600">
            Submission records are kept for audit purposes, while policy rules determine when capacity is released.
          </p>
        </header>

        <WithdrawalPanel
          applicationId="application-demo-001"
          programId="chainverse-scholarship"
          canWithdraw={true}
        />
      </div>
    </main>
  );
}
