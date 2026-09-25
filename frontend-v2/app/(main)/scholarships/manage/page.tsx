'use client';

import { useAuthStore } from '@/src/store/authStore';
import {
  canAccessScholarshipArea,
  ScholarshipPageShell,
} from '@/src/features/scholarships';
import { useScholarshipPrograms, useScholarshipRounds } from '@/src/features/scholarships';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/manage', label: 'Manage' },
];

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(cents / 100);
}

export default function ScholarshipsManagePage() {
  const user = useAuthStore((state) => state.user);
  const allowed = canAccessScholarshipArea(user?.role, 'manage');

  const programsQuery = useScholarshipPrograms();
  const roundsQuery = useScholarshipRounds();
  const isLoading = allowed && (programsQuery.isLoading || roundsQuery.isLoading);
  const isError = allowed && (programsQuery.isError || roundsQuery.isError);

  return (
    <ScholarshipPageShell
      allowed={allowed}
      title="Manage Scholarships"
      description="Configure programs and rounds. Mutations are queued for the administration API."
      activeHref="/scholarships/manage"
      navItems={NAV_ITEMS}
    >
      {isLoading && (
        <div className="space-y-3" aria-busy="true" aria-label="Loading scholarship configuration">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg border bg-gray-100" />
          ))}
        </div>
      )}

      {isError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="font-medium">Unable to load scholarship configuration</p>
          <p className="mt-1 text-sm">
            {programsQuery.error instanceof Error
              ? programsQuery.error.message
              : 'Please try again.'}
          </p>
        </div>
      )}

      {!isLoading && !isError && (
        <div className="space-y-8">
          <section aria-label="Programs">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Programs</h2>
            {programsQuery.data && programsQuery.data.length === 0 ? (
              <p className="py-8 text-center text-gray-500" role="status">
                No programs configured yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {(programsQuery.data ?? []).map((program) => (
                  <li
                    key={program.id}
                    className="rounded-lg border border-gray-200 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900">{program.name}</p>
                        <p className="text-sm text-gray-500">{program.description}</p>
                      </div>
                      <p className="text-sm text-gray-600">
                        Pool left: {formatCurrency(program.remainingPoolCents, program.currency)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Rounds">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Rounds</h2>
            {roundsQuery.data && roundsQuery.data.length === 0 ? (
              <p className="py-8 text-center text-gray-500" role="status">
                No rounds configured yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {(roundsQuery.data ?? []).map((round) => (
                  <li
                    key={round.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-4"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{round.name}</p>
                      <p className="text-sm text-gray-500">
                        Deadline{' '}
                        <time dateTime={round.applicationDeadline}>
                          {round.applicationDeadline}
                        </time>
                      </p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                      {round.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </ScholarshipPageShell>
  );
}