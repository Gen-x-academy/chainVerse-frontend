import { ScholarshipReminderSchedule } from '@/src/features/scholarships/reminders';

export default function ScholarshipRemindersPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-center text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">
          Reminders
        </p>
        <div className="mt-6">
          <ScholarshipReminderSchedule schedules={[]} state="ready" canManage={true} />
        </div>
      </div>
    </main>
  );
}
