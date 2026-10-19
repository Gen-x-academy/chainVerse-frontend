/**
 * MENTOR-062: collaborative session agendas.
 *
 * Participants propose, edit, reorder, assign, resolve and withdraw agenda
 * items. Every change is a versioned command: a stale `baseVersion` is a
 * conflict, a repeated `commandId` is a no-op, and each applied command appends
 * to a revision history. Resolved and withdrawn items stay in the list so they
 * remain traceable, and exports keep the agenda order.
 */

export type AgendaItemState = 'open' | 'resolved' | 'withdrawn';
export type AgendaOutcome = 'covered' | 'deferred' | 'dropped';

export type AgendaErrorCode =
  | 'NOT_AUTHORIZED'
  | 'CUTOFF_PASSED'
  | 'VERSION_CONFLICT'
  | 'UNSAFE_CONTENT'
  | 'INVALID_ITEM'
  | 'ITEM_LOCKED'
  | 'LIMIT_REACHED'
  | 'NOT_FOUND';

/** Stable, actionable messages. They never include agenda text. */
export const AGENDA_ERROR_MESSAGES: Record<AgendaErrorCode, string> = {
  NOT_AUTHORIZED: 'You do not have permission to change this agenda item.',
  CUTOFF_PASSED: 'The agenda is locked because the pre-session cutoff has passed.',
  VERSION_CONFLICT: 'Someone else changed the agenda. Reload it and try again.',
  UNSAFE_CONTENT: 'Agenda text cannot contain markup, links to scripts or control characters.',
  INVALID_ITEM: 'Check the agenda item and try again.',
  ITEM_LOCKED: 'This item is resolved or withdrawn. Reopen it to make changes.',
  LIMIT_REACHED: 'This agenda has reached its maximum number of items.',
  NOT_FOUND: 'That agenda item no longer exists. Reload the agenda.',
};

export class AgendaError extends Error {
  readonly code: AgendaErrorCode;
  constructor(code: AgendaErrorCode) {
    super(AGENDA_ERROR_MESSAGES[code]);
    this.name = 'AgendaError';
    this.code = code;
  }
}

export interface AgendaPolicy {
  /** Structural edits lock this many minutes before the session starts. */
  cutoffMinutesBeforeStart: number;
  maxItems: number;
}

export const DEFAULT_AGENDA_POLICY: AgendaPolicy = { cutoffMinutesBeforeStart: 60, maxItems: 30 };

export const TITLE_MAX_LENGTH = 120;
export const NOTES_MAX_LENGTH = 1000;

export interface AgendaResolution {
  outcome: AgendaOutcome;
  resolvedBy: string;
  resolvedAt: string;
  note?: string;
}

export interface AgendaItem {
  id: string;
  title: string;
  notes?: string;
  authorId: string;
  assigneeId?: string;
  state: AgendaItemState;
  resolution?: AgendaResolution;
  createdAt: string;
  updatedAt: string;
}

export type AgendaAction =
  | 'proposed'
  | 'edited'
  | 'reordered'
  | 'assigned'
  | 'resolved'
  | 'reopened'
  | 'withdrawn';

export interface AgendaRevision {
  version: number;
  commandId: string;
  action: AgendaAction;
  itemId: string;
  actorId: string;
  at: string;
}

export interface Agenda {
  sessionId: string;
  sessionStart: string;
  participantIds: readonly string[];
  /** Increments by one for every applied command. */
  version: number;
  /** Display order; never re-sorted. */
  items: readonly AgendaItem[];
  /** Append-only. */
  history: readonly AgendaRevision[];
}

export type AgendaCommand =
  | { type: 'propose'; title: string; notes?: string; assigneeId?: string }
  | { type: 'edit'; itemId: string; title?: string; notes?: string }
  | { type: 'reorder'; itemId: string; toIndex: number }
  | { type: 'assign'; itemId: string; assigneeId: string | null }
  | { type: 'resolve'; itemId: string; outcome: AgendaOutcome; note?: string }
  | { type: 'reopen'; itemId: string }
  | { type: 'withdraw'; itemId: string };

export interface AgendaCommandEnvelope {
  /** Stable across retries of the same user action. */
  commandId: string;
  /** The agenda version the user was looking at. */
  baseVersion: number;
  command: AgendaCommand;
}

export interface AgendaViewer {
  userId: string | null | undefined;
  isCoordinator?: boolean;
}

export function canViewAgenda(viewer: AgendaViewer, agenda: Pick<Agenda, 'participantIds'>): boolean {
  if (!viewer.userId) return false;
  return Boolean(viewer.isCoordinator) || agenda.participantIds.includes(viewer.userId);
}

function isParticipant(viewer: AgendaViewer, agenda: Pick<Agenda, 'participantIds'>): boolean {
  return Boolean(viewer.userId) && agenda.participantIds.includes(viewer.userId!);
}

/** Structural edits (propose, edit, reorder, assign, withdraw) lock at the cutoff. */
export function isAgendaLocked(
  agenda: Pick<Agenda, 'sessionStart'>,
  now: Date,
  policy: AgendaPolicy = DEFAULT_AGENDA_POLICY,
): boolean {
  return now.getTime() >= Date.parse(agenda.sessionStart) - policy.cutoffMinutesBeforeStart * 60_000;
}

const MARKUP = /[<>]/;
const SCRIPT_URL = /(javascript|data|vbscript)\s*:/i;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/;

/** Rejects (never silently rewrites) unsafe text; returns the trimmed value. */
export function sanitizeAgendaText(value: unknown, max: number, required: boolean): string {
  if (typeof value !== 'string') throw new AgendaError('INVALID_ITEM');
  const text = value.trim();
  if (required && text.length === 0) throw new AgendaError('INVALID_ITEM');
  if (text.length > max) throw new AgendaError('INVALID_ITEM');
  if (MARKUP.test(text) || SCRIPT_URL.test(text) || CONTROL.test(text)) {
    throw new AgendaError('UNSAFE_CONTENT');
  }
  return text;
}

function findItem(agenda: Agenda, itemId: string): number {
  const index = agenda.items.findIndex((item) => item.id === itemId);
  if (index === -1) throw new AgendaError('NOT_FOUND');
  return index;
}

function requireOpen(item: AgendaItem): void {
  if (item.state !== 'open') throw new AgendaError('ITEM_LOCKED');
}

/**
 * Applies one command and returns the next agenda (the input is not mutated).
 * Order of checks: authorization, idempotent replay, conflict, cutoff, rules.
 */
export function applyAgendaCommand(
  agenda: Agenda,
  viewer: AgendaViewer,
  envelope: AgendaCommandEnvelope,
  now: Date,
  policy: AgendaPolicy = DEFAULT_AGENDA_POLICY,
): Agenda {
  if (!isParticipant(viewer, agenda)) throw new AgendaError('NOT_AUTHORIZED');
  const actorId = viewer.userId!;

  if (agenda.history.some((entry) => entry.commandId === envelope.commandId)) return agenda;
  if (envelope.baseVersion !== agenda.version) throw new AgendaError('VERSION_CONFLICT');

  const { command } = envelope;
  const during = command.type === 'resolve' || command.type === 'reopen';
  if (!during && isAgendaLocked(agenda, now, policy)) throw new AgendaError('CUTOFF_PASSED');

  const at = now.toISOString();
  const items = [...agenda.items];
  let action: AgendaAction;
  let itemId: string;

  switch (command.type) {
    case 'propose': {
      if (items.length >= policy.maxItems) throw new AgendaError('LIMIT_REACHED');
      const title = sanitizeAgendaText(command.title, TITLE_MAX_LENGTH, true);
      const notes = sanitizeAgendaText(command.notes ?? '', NOTES_MAX_LENGTH, false);
      if (command.assigneeId !== undefined && !agenda.participantIds.includes(command.assigneeId)) {
        throw new AgendaError('INVALID_ITEM');
      }
      itemId = `itm_${envelope.commandId}`;
      items.push({
        id: itemId,
        title,
        ...(notes ? { notes } : {}),
        authorId: actorId,
        ...(command.assigneeId ? { assigneeId: command.assigneeId } : {}),
        state: 'open',
        createdAt: at,
        updatedAt: at,
      });
      action = 'proposed';
      break;
    }
    case 'edit': {
      const index = findItem(agenda, command.itemId);
      const item = items[index];
      requireOpen(item);
      if (item.authorId !== actorId) throw new AgendaError('NOT_AUTHORIZED');
      const title =
        command.title === undefined ? item.title : sanitizeAgendaText(command.title, TITLE_MAX_LENGTH, true);
      const notes =
        command.notes === undefined ? item.notes : sanitizeAgendaText(command.notes, NOTES_MAX_LENGTH, false);
      const { notes: _drop, ...rest } = item;
      void _drop;
      items[index] = { ...rest, title, ...(notes ? { notes } : {}), updatedAt: at };
      itemId = item.id;
      action = 'edited';
      break;
    }
    case 'reorder': {
      const index = findItem(agenda, command.itemId);
      requireOpen(items[index]);
      if (!Number.isInteger(command.toIndex) || command.toIndex < 0 || command.toIndex >= items.length) {
        throw new AgendaError('INVALID_ITEM');
      }
      const [moved] = items.splice(index, 1);
      items.splice(command.toIndex, 0, { ...moved, updatedAt: at });
      itemId = moved.id;
      action = 'reordered';
      break;
    }
    case 'assign': {
      const index = findItem(agenda, command.itemId);
      requireOpen(items[index]);
      if (command.assigneeId !== null && !agenda.participantIds.includes(command.assigneeId)) {
        throw new AgendaError('INVALID_ITEM');
      }
      const { assigneeId: _old, ...rest } = items[index];
      void _old;
      items[index] = { ...rest, ...(command.assigneeId ? { assigneeId: command.assigneeId } : {}), updatedAt: at };
      itemId = rest.id;
      action = 'assigned';
      break;
    }
    case 'resolve': {
      const index = findItem(agenda, command.itemId);
      requireOpen(items[index]);
      if (!['covered', 'deferred', 'dropped'].includes(command.outcome)) {
        throw new AgendaError('INVALID_ITEM');
      }
      const note = sanitizeAgendaText(command.note ?? '', NOTES_MAX_LENGTH, false);
      items[index] = {
        ...items[index],
        state: 'resolved',
        resolution: { outcome: command.outcome, resolvedBy: actorId, resolvedAt: at, ...(note ? { note } : {}) },
        updatedAt: at,
      };
      itemId = items[index].id;
      action = 'resolved';
      break;
    }
    case 'reopen': {
      const index = findItem(agenda, command.itemId);
      if (items[index].state !== 'resolved') throw new AgendaError('ITEM_LOCKED');
      // The previous resolution stays in the revision history.
      const { resolution: _res, ...rest } = items[index];
      void _res;
      items[index] = { ...rest, state: 'open', updatedAt: at };
      itemId = rest.id;
      action = 'reopened';
      break;
    }
    case 'withdraw': {
      const index = findItem(agenda, command.itemId);
      requireOpen(items[index]);
      if (items[index].authorId !== actorId) throw new AgendaError('NOT_AUTHORIZED');
      items[index] = { ...items[index], state: 'withdrawn', updatedAt: at };
      itemId = items[index].id;
      action = 'withdrawn';
      break;
    }
    default:
      throw new AgendaError('INVALID_ITEM');
  }

  const version = agenda.version + 1;
  return {
    ...agenda,
    version,
    items,
    history: [...agenda.history, { version, commandId: envelope.commandId, action, itemId, actorId, at }],
  };
}

export interface AgendaExportEntry {
  position: number;
  title: string;
  notes?: string;
  authorId: string;
  assigneeId?: string;
  state: AgendaItemState;
  resolution?: AgendaResolution;
}

export interface AgendaExport {
  sessionId: string;
  version: number;
  exportedAt: string;
  items: AgendaExportEntry[];
}

/** Participant/coordinator-only export. Order and resolved items are preserved. */
export function exportAgenda(viewer: AgendaViewer, agenda: Agenda, exportedAt: Date): AgendaExport {
  if (!canViewAgenda(viewer, agenda)) throw new AgendaError('NOT_AUTHORIZED');
  return {
    sessionId: agenda.sessionId,
    version: agenda.version,
    exportedAt: exportedAt.toISOString(),
    items: agenda.items.map((item, index) => ({
      position: index + 1,
      title: item.title,
      ...(item.notes ? { notes: item.notes } : {}),
      authorId: item.authorId,
      ...(item.assigneeId ? { assigneeId: item.assigneeId } : {}),
      state: item.state,
      ...(item.resolution ? { resolution: item.resolution } : {}),
    })),
  };
}

/** Plain-text rendering of an export, in agenda order. */
export function agendaExportToText(exported: AgendaExport): string {
  return exported.items
    .map((entry) => {
      const status =
        entry.state === 'resolved' ? `resolved: ${entry.resolution?.outcome}` : entry.state;
      return `${entry.position}. ${entry.title} [${status}]`;
    })
    .join('\n');
}

/** Log-safe view: ids and counts, never titles or notes. */
export function redactAgendaForLog(agenda: Agenda): {
  sessionId: string;
  version: number;
  itemCount: number;
} {
  return { sessionId: agenda.sessionId, version: agenda.version, itemCount: agenda.items.length };
}

export function toAgendaError(error: unknown): AgendaError {
  if (error instanceof AgendaError) return error;
  const status = (error as { status?: number } | null)?.status;
  if (status === 404) return new AgendaError('NOT_FOUND');
  if (status === 409) return new AgendaError('VERSION_CONFLICT');
  if (status === 423) return new AgendaError('CUTOFF_PASSED');
  if (status === 400 || status === 422) return new AgendaError('INVALID_ITEM');
  return new AgendaError('NOT_AUTHORIZED');
}
