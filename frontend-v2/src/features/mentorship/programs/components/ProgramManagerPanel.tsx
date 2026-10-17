'use client';

import { useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import { useProgramStore } from './store';
import type { MentorshipProgram } from '../types';
import { ProgramDraftForm } from './ProgramDraftForm';
import { ProgramStatusBadge } from './ProgramStatusBadge';

/**
 * Staff-facing program manager.
 *
 * Drafts are private; only staff can publish them. Students get the published
 * programs through `PublishedProgramList`, which the route renders instead.
 */
export function ProgramManagerPanel() {
  const state = useProgramStore();
  const programs = state.programs;
  const status = state.status;
  const error = state.error;
  const load = state.load;
  const createDraft = state.createDraft;
  const publish = state.publish;

  useEffect(() => {
    void load();
    // Run once per mount; reloads are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-10">
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <header className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-gray-500" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-gray-900">Organization programs</h2>
        </header>
        <div className="p-6">
          {error ? (
            <p role="alert" className="text-sm text-red-600">{error}</p>
          ) : status === 'loading' ? (
            <p className="text-sm text-gray-500">Loading programs...</p>
          ) : programs.length === 0 ? (
            <p className="text-sm text-gray-500">No programs yet.</p>
          ) : (
            <ul className="space-y-4">
              {programs.map((program) => (
                <ProgramRow
                  key={program.internalId}
                  program={program}
                  onPublish={() => void publish(program.internalId)}
                />
              ))}
            </ul>
          )}
        </div>
      </section>
      <ProgramDraftForm onCreate={(payload) => createDraft(payload)} />
    </div>
  );
}

function ProgramRow({
  program,
  onPublish,
}: {
  program: MentorshipProgram;
  onPublish: () => void;
}) {
  return (
    <li className="rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-gray-900">{program.name}</p>
          <p className="text-sm text-gray-500">{program.organizationId}</p>
        </div>
        <div className="flex items-center gap-2">
          <ProgramStatusBadge status={program.status} />
          {program.status === 'draft' ? (
            <button
              type="button"
              onClick={onPublish}
              className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              Publish
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
