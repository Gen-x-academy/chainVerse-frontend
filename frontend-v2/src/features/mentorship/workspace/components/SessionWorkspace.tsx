'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import {
  FOLLOW_UP_TITLE_MAX_LENGTH,
  toWorkspaceError,
  viewWorkspace,
  workspacePermissions,
  workspaceSections,
  type SessionWorkspaceData,
  type WorkspaceCommand,
  type WorkspaceCommandEnvelope,
  type WorkspaceSection,
  type WorkspaceViewer,
} from '../workspace';

export interface SessionWorkspaceProps {
  viewer: WorkspaceViewer;
  workspace: SessionWorkspaceData;
  /** Display names keyed by user id; ids are never shown. */
  labels: Readonly<Record<string, string>>;
  now?: Date;
  loading?: boolean;
  error?: string | null;
  onCommand?: (envelope: WorkspaceCommandEnvelope) => Promise<void> | void;
  onReload?: () => Promise<void> | void;
  /**
   * Private notes are rendered by a separate component supplied by the page.
   * The workspace never receives or stores note content.
   */
  privateNotesSlot?: ReactNode;
}

const SECTION_LABEL: Record<WorkspaceSection, string> = {
  overview: 'Overview',
  agenda: 'Agenda',
  goals: 'Shared goals',
  resources: 'Resources',
  attendance: 'Attendance',
  'follow-ups': 'Follow-up actions',
  'private-notes': 'My private notes',
};

const STATUS_LABEL = {
  scheduled: 'Scheduled',
  'in-progress': 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
} as const;

const ATTENDANCE_LABEL = {
  attended: 'Attended',
  partial: 'Partial attendance',
  absent: 'Absent',
  'pending-corroboration': 'Awaiting confirmation',
  'not-started': 'Not started',
} as const;

const READ_ONLY_COPY = {
  cancelled: 'This session was cancelled, so the workspace is read-only.',
  expired: 'This workspace is past its retention period. Its contents are no longer available.',
  staff: 'You have read-only access to this workspace.',
} as const;

let counter = 0;
function newCommandId(): string {
  counter += 1;
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '')
    : `cmd${counter}`;
}

export function SessionWorkspace({
  viewer,
  workspace,
  labels,
  now = new Date(),
  loading = false,
  error,
  onCommand,
  onReload,
  privateNotesSlot,
}: SessionWorkspaceProps) {
  const baseId = useId();
  const [title, setTitle] = useState('');
  const [ownerId, setOwnerId] = useState<string>('');
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const ids = useRef<Record<string, string>>({});

  const perms = workspacePermissions(viewer, workspace, now);
  const view = viewWorkspace(viewer, workspace, now);
  const sections = workspaceSections(viewer, workspace, now);
  const name = (id: string) => labels[id] ?? 'Participant';

  const send = async (key: string, success: string, command: WorkspaceCommand) => {
    setPending(key);
    setLocalError(null);
    setMessage(null);
    setConflict(false);
    const commandId = (ids.current[key] ??= newCommandId());
    try {
      await onCommand?.({ commandId, baseVersion: workspace.version, command });
      delete ids.current[key];
      setMessage(success);
      return true;
    } catch (caught) {
      const mapped = toWorkspaceError(caught);
      if (mapped.code === 'VERSION_CONFLICT') {
        setConflict(true);
        delete ids.current[key];
      }
      setLocalError(mapped.message);
      return false;
    } finally {
      setPending(null);
    }
  };

  const addFollowUp = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await send('add', 'Follow-up added.', {
      type: 'add-follow-up',
      title,
      ownerId: ownerId || workspace.participantIds[0],
    });
    if (ok) setTitle('');
  };

  const shell = (children: ReactNode) => (
    <section
      aria-labelledby={`${baseId}-title`}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <h2 id={`${baseId}-title`} className="text-lg font-semibold text-slate-900">
        Session workspace
      </h2>
      {children}
    </section>
  );

  if (!perms.canEnter || !view) {
    return shell(
      <p role="alert" className="mt-4 text-sm text-red-700">
        {toWorkspaceError({ status: 403 }).message}
      </p>,
    );
  }
  if (loading) {
    return shell(
      <p role="status" className="mt-4 text-sm text-slate-600">
        Loading workspace…
      </p>,
    );
  }

  const heading = 'mt-6 text-base font-semibold text-slate-900';
  const empty = 'mt-2 text-sm text-slate-600';
  const shownError = localError ?? error;

  return shell(
    <>
      <p className="mt-1 text-sm text-slate-600">
        Status: <strong>{STATUS_LABEL[workspace.status]}</strong> ·{' '}
        <time dateTime={workspace.scheduledStart}>
          {workspace.scheduledStart.slice(0, 16).replace('T', ' ')} UTC
        </time>
      </p>

      {perms.readOnlyReason && (
        <p role="status" className="mt-3 rounded-lg bg-slate-100 p-3 text-sm text-slate-800">
          {READ_ONLY_COPY[perms.readOnlyReason]}
        </p>
      )}

      <nav aria-label="Workspace sections" className="mt-4">
        <ul className="flex flex-wrap gap-2">
          {sections.map((section) => (
            <li key={section}>
              <a
                href={`#${baseId}-${section}`}
                className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {SECTION_LABEL[section]}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {!perms.expired && (
        <>
          <section id={`${baseId}-agenda`} aria-labelledby={`${baseId}-agenda-h`}>
            <h3 id={`${baseId}-agenda-h`} className={heading}>
              Agenda
            </h3>
            {view.agenda.length === 0 ? (
              <p className={empty}>No agenda items yet.</p>
            ) : (
              <ol aria-label="Agenda items" className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                {view.agenda.map((item) => (
                  <li key={item.id}>
                    {item.title}{' '}
                    <span className="text-xs text-slate-600">
                      ({item.state === 'open' ? 'open' : item.state})
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section id={`${baseId}-goals`} aria-labelledby={`${baseId}-goals-h`}>
            <h3 id={`${baseId}-goals-h`} className={heading}>
              Shared goals
            </h3>
            {view.goals.length === 0 ? (
              <p className={empty}>No shared goals yet.</p>
            ) : (
              <ul aria-label="Shared goals" className="mt-2 space-y-1 text-sm">
                {view.goals.map((goal) => (
                  <li key={goal.id}>
                    {goal.title} — {goal.done ? 'done' : 'in progress'}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id={`${baseId}-resources`} aria-labelledby={`${baseId}-resources-h`}>
            <h3 id={`${baseId}-resources-h`} className={heading}>
              Resources
            </h3>
            {view.resources.length === 0 ? (
              <p className={empty}>No resources have been shared with you.</p>
            ) : (
              <ul aria-label="Resources" className="mt-2 space-y-1 text-sm">
                {view.resources.map((r) => (
                  <li key={r.id}>
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-700 underline"
                      >
                        {r.title}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    ) : (
                      r.title
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id={`${baseId}-attendance`} aria-labelledby={`${baseId}-attendance-h`}>
            <h3 id={`${baseId}-attendance-h`} className={heading}>
              Attendance
            </h3>
            {view.attendance.length === 0 ? (
              <p className={empty}>Attendance will appear once the session starts.</p>
            ) : (
              <ul aria-label="Attendance" className="mt-2 space-y-1 text-sm">
                {view.attendance.map((a) => (
                  <li key={a.participantId}>
                    {name(a.participantId)}: {ATTENDANCE_LABEL[a.status]}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id={`${baseId}-follow-ups`} aria-labelledby={`${baseId}-fu-h`}>
            <h3 id={`${baseId}-fu-h`} className={heading}>
              Follow-up actions
            </h3>
            {view.followUps.length === 0 ? (
              <p className={empty}>No follow-up actions yet.</p>
            ) : (
              <ul aria-label="Follow-up actions" className="mt-2 space-y-2 text-sm">
                {view.followUps.map((f) => (
                  <li key={f.id} className="flex items-start gap-2">
                    <input
                      id={`${baseId}-fu-${f.id}`}
                      type="checkbox"
                      checked={f.done}
                      disabled={!perms.canEditFollowUps || pending !== null}
                      onChange={(e) =>
                        void send(`toggle-${f.id}`, 'Follow-up updated.', {
                          type: 'set-follow-up-done',
                          followUpId: f.id,
                          done: e.target.checked,
                        })
                      }
                      className="mt-1 h-5 w-5"
                    />
                    <label htmlFor={`${baseId}-fu-${f.id}`}>
                      {f.title}
                      <span className="block text-xs text-slate-600">
                        Owner: {name(f.ownerId)} · Added by {name(f.createdBy)}
                        {f.dueDate && ` · Due ${f.dueDate.slice(0, 10)}`}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}

            {perms.canEditFollowUps && (
              <form onSubmit={addFollowUp} className="mt-3 space-y-2">
                <label htmlFor={`${baseId}-new`} className="block text-sm font-medium text-slate-800">
                  Add a follow-up action
                </label>
                <input
                  id={`${baseId}-new`}
                  value={title}
                  maxLength={FOLLOW_UP_TITLE_MAX_LENGTH}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-base"
                />
                <label htmlFor={`${baseId}-owner`} className="block text-sm font-medium text-slate-800">
                  Owner
                </label>
                <select
                  id={`${baseId}-owner`}
                  value={ownerId || workspace.participantIds[0]}
                  onChange={(e) => setOwnerId(e.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-300 p-2 text-base"
                >
                  {workspace.participantIds.map((id) => (
                    <option key={id} value={id}>
                      {name(id)}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={pending !== null}
                  className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {pending === 'add' ? 'Adding…' : 'Add follow-up'}
                </button>
              </form>
            )}
          </section>

          {perms.role === 'participant' && (
            <section id={`${baseId}-private-notes`} aria-labelledby={`${baseId}-pn-h`}>
              <h3 id={`${baseId}-pn-h`} className={heading}>
                My private notes
              </h3>
              <p className={empty}>
                Private notes are kept separate from this workspace. Only you can see them.
              </p>
              {privateNotesSlot}
            </section>
          )}
        </>
      )}

      {message && (
        <p role="status" className="mt-3 text-sm text-green-800">
          {message}
        </p>
      )}
      {shownError && (
        <div role="alert" className="mt-3 text-sm text-red-700">
          <p>{shownError}</p>
          {conflict && onReload && (
            <button
              type="button"
              onClick={() => void onReload()}
              className="mt-2 min-h-11 rounded-lg border border-red-700 px-3 py-2 text-sm font-semibold"
            >
              Reload workspace
            </button>
          )}
        </div>
      )}
    </>,
  );
}

export default SessionWorkspace;
