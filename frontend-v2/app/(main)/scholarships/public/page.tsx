import Link from 'next/link';
import { formatAwardAmount, publicProgramService } from '@/src/features/scholarships/public-pages/service';
import type { PublicProgramSummary } from '@/src/features/scholarships/public-pages/types';

export default async function PublicProgramsDirectoryPage() {
  let programs: PublicProgramSummary[] = [];
  let loadError: string | null = null;

  try {
    programs = await publicProgramService.list();
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'The program list could not be loaded.';
  }

  const published = programs.filter((program) => program.visibility === 'public');

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">
            Public programs
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">
            Published scholarship programs
          </h1>
          <p className="mt-3 text-base text-slate-600">
            Every program below is published publicly. Invitation-only and unpublished programs
            never appear in this list.
          </p>
        </header>

        {loadError && (
          <div
            className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800"
            role="alert"
          >
            <h2 className="text-xl font-bold text-slate-900">Program list unavailable</h2>
            <p className="mt-2">{loadError}</p>
            <p className="mt-3">Next step: retry the request in a few minutes.</p>
          </div>
        )}

        {!loadError && published.length === 0 && (
          <div
            className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600"
            role="status"
            aria-live="polite"
          >
            <h2 className="text-xl font-bold text-slate-900">No published programs yet</h2>
            <p className="mt-2">
              Nothing has been published publicly right now. Next step: check back once the program
              team publishes a round.
            </p>
          </div>
        )}

        {published.length > 0 && (
          <ul className="mt-8 space-y-4">
            {published.map((program) => (
              <li
                key={program.slug}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <h2 className="text-xl font-bold text-slate-900">
                  <Link
                    href={`/scholarships/public/${program.slug}`}
                    className="rounded focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  >
                    {program.title}
                  </Link>
                </h2>
                <p className="mt-2 text-sm text-slate-600">{program.summary}</p>
                <p className="mt-3 text-sm font-semibold text-emerald-700">
                  {formatAwardAmount(program)}
                  {program.applicationDeadline ? ` \u00b7 apply by ${program.applicationDeadline}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
