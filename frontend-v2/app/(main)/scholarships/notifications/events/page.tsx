import { ScholarshipNotificationEventLog } from '@/src/features/scholarships/notification-events';

export default function ScholarshipNotificationEventsPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-sm font-semibold uppercase tracking-[0.22em] text-indigo-600">
          Notifications
        </p>
        <div className="mt-6">
          <ScholarshipNotificationEventLog events={[]} state="ready" canView={true} />
        </div>
      </div>
    </main>
  );
}
