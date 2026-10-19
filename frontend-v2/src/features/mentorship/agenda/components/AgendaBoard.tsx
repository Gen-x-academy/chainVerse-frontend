'use client';

import { useId, useRef, useState } from 'react';
import {
  NOTES_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  canViewAgenda,
  isAgendaLocked,
  toAgendaError,
  type Agenda,
  type AgendaCommand,
  type AgendaCommandEnvelope,
  type AgendaItem,
  type AgendaOutcome,
  type AgendaPolicy,
  type AgendaViewer,
  DEFAULT_AGENDA_POLICY,
} from '../agenda';

export interface AgendaBoardProps {
  viewer: AgendaViewer;
  agenda: Agenda;
  /** Display names keyed by user id; ids are never shown. */
  labels: Readonly<Record<string, string>>;
  now?: Date;
  policy?: AgendaPolicy;
  loading?: boolean;
  error?: string | null;
  onCommand?: (envelope: AgendaCommandEnvelope) => Promise<void> | void;
  onReload?: () => Promise<void> | void;
  onExport?: () => Promise<void> | void;
}

let counter = 0;
function newCommandId(): string {
  counter += 1;
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '')
    : `cmd${counter}`;
}

const OUTCOME_LABEL: Record<AgendaOutcome, string> = {
  covered: 'Covered',
  deferred: 'Deferred',
  dropped: 'Dropped',
};

export function AgendaBoard({
  viewer,
  agenda,
  labels,
  now = new Date(),
  policy = DEFAULT_AGENDA_POLICY,
  loading = false,
  error,
  onCommand,
  onReload,
  onExport,
}: AgendaBoardProps) {
  const baseId = useId();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<AgendaOutcome>('covered');
  const ids = useRef<Record<string, string>>({});

  const allowed = canViewAgenda(viewer, agenda);
  const participant = Boolean(viewer.userId) && agenda.participantIds.includes(viewer.userId!);
  const locked = isAgendaLocked(agenda, now, policy);
  const name = (id?: string) => (id ? labels[id] ?? 'Participant' : 'Unassigned');

  const send = async (key: string, success: string, command: AgendaCommand) => {
    setPending(key);
    setLocalError(null);
    setMessage(null);
    setConflict(false);
    const commandId = (ids.current[key] ??= newCommandId());
    try {
      await onCommand?.({ commandId, baseVersion: agenda.version, command });
      delete ids.current[key];
      setMessage(success);
      return true;
    } catch (caught) {
      const mapped = toAgendaError(caught);
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

  const propose = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await send('propose', 'Agenda item proposed.', {
      type: 'propose',
      title,
      ...(notes.trim() ? { notes } : {}),
    });
    if (ok) {
      setTitle('');
      setNotes('');
    }
  };

  const renderItem = (item: AgendaItem, index: number) => {
    const open = item.state === 'open';
    const mine = item.authorId === viewer.userId;
    const busy = pending !== null;
    const itemLabel = `item ${index + 1}: ${item.title}`;
    return (
      <li key={item.id} className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <p className={`font-medium ${open ? 'text-slate-900' : 'text-slate-600 line-through'}`}>
            {index + 1}. {item.title}
          </p>
          <p className="text-xs font-semibold text-slate-700">
            {item.state === 'resolved' && item.resolution
              ? `Resolved: ${OUTCOME_LABEL[item.resolution.outcome]}`
              : item.state === 'withdrawn'
                ? 'Withdrawn'
                : 'Open'}
          </p>
        </div>
        {item.notes && (
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">{item.notes}</p>
        )}
        <p className="mt-1 text-xs text-slate-600">
          Proposed by {name(item.authorId)} · Assigned to {name(item.assigneeId)}
          {item.resolution && ` · Resolved by ${name(item.resolution.resolvedBy)}`}
        </p>
        {item.resolution?.note && (
          <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-600">
            {item.resolution.note}
          </p>
        )}

        {participant && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {open && !locked && (
              <>
                <button
                  type="button"
                  disabled={busy || index === 0}
                  onClick={() => void send(`up-${item.id}`, 'Agenda reordered.', { type: 'reorder', itemId: item.id, toIndex: index - 1 })}
                  aria-label={`Move ${itemLabel} up`}
                  className="min-h-11 min-w-11 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={busy || index === agenda.items.length - 1}
                  onClick={() => void send(`down-${item.id}`, 'Agenda reordered.', { type: 'reorder', itemId: item.id, toIndex: index + 1 })}
                  aria-label={`Move ${itemLabel} down`}
                  className="min-h-11 min-w-11 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
                >
                  ↓
                </button>
                <label className="text-sm text-slate-800">
                  <span className="sr-only">Assignee for {itemLabel}</span>
                  <select
                    value={item.assigneeId ?? ''}
                    disabled={busy}
                    onChange={(e) =>
                      void send(`assign-${item.id}`, 'Assignee updated.', {
                        type: 'assign',
                        itemId: item.id,
                        assigneeId: e.target.value || null,
                      })
                    }
                    className="min-h-11 rounded-lg border border-slate-300 p-2 text-sm"
                  >
                    <option value="">Unassigned</option>
                    {agenda.participantIds.map((id) => (
                      <option key={id} value={id}>
                        {name(id)}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {open && resolvingId !== item.id && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setResolvingId(item.id)}
                aria-label={`Resolve ${itemLabel}`}
                className="min-h-11 rounded-lg border border-indigo-600 px-3 py-2 text-sm font-semibold text-indigo-700"
              >
                Resolve
              </button>
            )}
            {open && mine && !locked && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void send(`withdraw-${item.id}`, 'Agenda item withdrawn.', { type: 'withdraw', itemId: item.id })}
                aria-label={`Withdraw ${itemLabel}`}
                className="min-h-11 rounded-lg border border-red-700 px-3 py-2 text-sm text-red-700"
              >
                Withdraw
              </button>
            )}
            {item.state === 'resolved' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void send(`reopen-${item.id}`, 'Agenda item reopened.', { type: 'reopen', itemId: item.id })}
                aria-label={`Reopen ${itemLabel}`}
                className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                Reopen
              </button>
            )}
          </div>
        )}

        {resolvingId === item.id && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-sm font-medium text-slate-800">
              Outcome
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as AgendaOutcome)}
                className="ml-2 min-h-11 rounded-lg border border-slate-300 p-2 text-sm"
              >
                {(Object.keys(OUTCOME_LABEL) as AgendaOutcome[]).map((o) => (
                  <option key={o} value={o}>
                    {OUTCOME_LABEL[o]}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (await send(`resolve-${item.id}`, 'Agenda item resolved.', { type: 'resolve', itemId: item.id, outcome })) {
                  setResolvingId(null);
                }
              }}
              className="min-h-11 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
            >
              Confirm resolve
            </button>
            <button
              type="button"
              onClick={() => setResolvingId(null)}
              className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        )}
      </li>
    );
  };

  return (
    <section
      aria-labelledby={`${baseId}-title`}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 id={`${baseId}-title`} className="text-lg font-semibold text-slate-900">
          Session agenda
        </h2>
        {allowed && onExport && (
          <button
            type="button"
            onClick={() => void onExport()}
            className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            Export agenda
          </button>
        )}
      </div>

      {!allowed ? (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {toAgendaError({ status: 403 }).message}
        </p>
      ) : loading ? (
        <p role="status" className="mt-4 text-sm text-slate-600">
          Loading agenda…
        </p>
      ) : (
        <>
          {locked && (
            <p role="status" className="mt-3 text-sm text-amber-800">
              The agenda is locked for changes ahead of the session. You can still resolve and
              reopen items.
            </p>
          )}

          <div className="mt-4" aria-live="polite">
            {agenda.items.length === 0 ? (
              <p role="status" className="text-sm text-slate-600">
                No agenda items yet. Propose the first topic to discuss.
              </p>
            ) : (
              <ol aria-label="Agenda items" className="space-y-3">
                {agenda.items.map(renderItem)}
              </ol>
            )}
          </div>

          {participant && !locked && (
            <form onSubmit={propose} className="mt-5 space-y-2">
              <label htmlFor={`${baseId}-new`} className="block text-sm font-medium text-slate-800">
                Propose an agenda item
              </label>
              <input
                id={`${baseId}-new`}
                value={title}
                maxLength={TITLE_MAX_LENGTH}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-base"
              />
              <label htmlFor={`${baseId}-notes`} className="block text-sm font-medium text-slate-800">
                Notes (optional)
              </label>
              <textarea
                id={`${baseId}-notes`}
                value={notes}
                rows={2}
                maxLength={NOTES_MAX_LENGTH}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-base"
              />
              <button
                type="submit"
                disabled={pending !== null}
                className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pending === 'propose' ? 'Proposing…' : 'Propose item'}
              </button>
            </form>
          )}

          {agenda.history.length > 0 && (
            <details className="mt-5">
              <summary className="cursor-pointer text-sm font-medium text-slate-800">
                Revision history ({agenda.history.length})
              </summary>
              <ol aria-label="Revision history" className="mt-2 space-y-1 text-xs text-slate-600">
                {agenda.history.map((entry) => (
                  <li key={entry.commandId}>
                    v{entry.version}: {name(entry.actorId)} {entry.action} an item on{' '}
                    <time dateTime={entry.at}>{entry.at.slice(0, 16).replace('T', ' ')}</time>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </>
      )}

      {message && (
        <p role="status" className="mt-3 text-sm text-green-800">
          {message}
        </p>
      )}
      {allowed && (localError ?? error) && (
        <div role="alert" className="mt-3 text-sm text-red-700">
          <p>{localError ?? error}</p>
          {conflict && onReload && (
            <button
              type="button"
              onClick={() => void onReload()}
              className="mt-2 min-h-11 rounded-lg border border-red-700 px-3 py-2 text-sm font-semibold"
            >
              Reload agenda
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export default AgendaBoard;
