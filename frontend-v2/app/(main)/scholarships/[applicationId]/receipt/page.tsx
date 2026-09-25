import { ScholarshipReceipt } from '@/src/features/scholarships';

export default async function ScholarshipReceiptRoute({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">Receipt</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Scholarship application receipt</h1>
        <p className="mt-2 text-sm text-slate-600">Application reference: {applicationId}</p>
        <div className="mt-6">
          <ScholarshipReceipt receipt={null} application={null} />
        </div>
      </div>
    </main>
  );
}
