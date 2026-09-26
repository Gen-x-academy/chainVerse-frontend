import { StudentScholarshipDashboard } from '@/src/features/scholarships/dashboards/student';

export default function StudentScholarshipDashboardPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-indigo-600">Student</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Your scholarship journey</h1>
          <p className="mt-3 text-base text-slate-600">
            One tile per step of the journey. Every count carries the moment it was measured, so an empty tile
            never hides a failed query.
          </p>
        </header>

        <StudentScholarshipDashboard studentId="student-001" allowed />
      </div>
    </main>
  );
}
