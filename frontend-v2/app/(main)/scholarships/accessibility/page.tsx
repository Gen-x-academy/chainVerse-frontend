import { ScholarshipAccessibilityAudit } from '@/src/features/scholarships/accessibility';

export default function ScholarshipAccessibilityPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-indigo-600">Accessibility</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">WCAG audit by journey</h1>
          <p className="mt-3 text-base text-slate-600">
            Track perceivable, operable, understandable, and robust criteria across discovery, forms,
            review, financial tables, and status updates.
          </p>
        </header>

        <ScholarshipAccessibilityAudit programId="chainverse-scholarship" canManage={true} />
      </div>
    </main>
  );
}
