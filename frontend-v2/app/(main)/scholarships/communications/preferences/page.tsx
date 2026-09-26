import { ScholarshipCommunicationPreferences } from '@/src/features/scholarships/communications';
import { emptyPreferenceMatrix } from '@/src/features/scholarships/communications/service';

export default function ScholarshipCommunicationPreferencesPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-center text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">
          Communications
        </p>
        <div className="mt-6">
          <ScholarshipCommunicationPreferences
            matrix={emptyPreferenceMatrix([{ scope: 'user', scopeId: 'current-user' }])}
            state="ready"
            canEdit={true}
          />
        </div>
      </div>
    </main>
  );
}
