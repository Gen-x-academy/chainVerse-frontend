'use client';

import type { MentorshipProgram } from '../types';
import { ProgramStatusBadge } from './ProgramStatusBadge';

/**
 * Published mentorship programs only.
 *
 * Drafts are never passed in by the caller, so the student-facing directory
 * cannot accidentally leak unpublished work. Draft visibility is also
 * re-checked at render time as a defense in depth measure.
 */
export function PublishedProgramList({
  programs,
}: {
  programs: readonly MentorshipProgram[];
}) {
  const published = programs.filter(
    (program) => program.status === 'published'
  );

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <header className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Published programs</h2>
      </header>
      <div className="p-6">
        {published.length === 0 ? (
          <p className="text-sm text-gray-500">No published programs yet.</p>
        ) : (
          <ul className="space-y-4">
            {published.map((program) => (
              <ProgramRow key={program.internalId} program={program} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ProgramRow({ program }: { program: MentorshipProgram }) {
  return (
    <li className="rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-gray-900">{program.name}</p>
          <p className="text-sm text-gray-500">{program.organizationId}</p>
        </div>
        <ProgramStatusBadge status={program.status} />
      </div>
    </li>
  );
}
