/** MENTOR-072: assign and track participant-owned action items with due dates, reminders and completion evidence. */
export type ActionItemStatus = 'open' | 'acknowledged' | 'completed' | 'cancelled';
export type ActionItemPriority = 'low' | 'normal' | 'high' | 'urgent';

/** A file, link or commit reference proving an item was completed. */
export interface ActionItemEvidence {
  ref: string;
  note?: string;
}

/** A scheduled reminder for an item that is still open. */
export interface ActionItemReminder {
  at: string;
  sent: boolean;
}

export type ActionItemEventType =
  | 'created'
  | 'acknowledged'
  | 'reminder-scheduled'
  | 'completed'
  | 'reopened'
  | 'cancelled';

/** One entry in an item's append-only audit trail. */
export interface ActionItemEvent {
  at: string;
  actorId: string;
  type: ActionItemEventType;
  note?: string;
}

export interface ActionItem {
  id: string;
  title: string;
  /** Participant the item is assigned to. */
  assigneeId: string;
  /** Participant or coordinator who created the assignment. */
  createdById: string;
  /** Session the item was raised in, when applicable. */
  sourceSessionId?: string;
  status: ActionItemStatus;
  priority: ActionItemPriority;
  dueDate?: string;
  /** When true the assignee must acknowledge before the item counts as accepted. */
  requiresAcknowledgement: boolean;
  acknowledgedAt?: string;
  reminders: ActionItemReminder[];
  evidence?: ActionItemEvidence;
  completedAt?: string;
  /** Append-only history, retained in full even after completion. */
  history: ActionItemEvent[];
}

export const ACTION_ITEM_TITLE_MAX = 200;
export const MAX_ACTION_ITEM_REMINDERS = 10;

export interface AssignActionItemInput {
  id: string;
  title: string;
  assigneeId: string;
  createdById: string;
  priority?: ActionItemPriority;
  dueDate?: string;
  sourceSessionId?: string;
  /** Defaults to true: assignees acknowledge before the item is accepted. */
  requiresAcknowledgement?: boolean;
}

const isFutureDate = (value: string, now: Date): boolean => {
  const time = Date.parse(value);
  return Number.isFinite(time) && time > now.getTime();
};

const append = (item: ActionItem, event: ActionItemEvent): ActionItem => ({
  ...item,
  history: [...item.history, event],
});

/** Creates a new open item. The creator is recorded as the first assigner. */
export function assignActionItem(input: AssignActionItemInput, now: Date = new Date()): ActionItem {
  const title = input.title.trim();
  if (!title) throw new Error('An action item needs a title');
  if (title.length > ACTION_ITEM_TITLE_MAX) {
    throw new Error(`The title must be at most ${ACTION_ITEM_TITLE_MAX} characters`);
  }
  if (!input.assigneeId) throw new Error('An action item needs an assignee');
  if (!input.createdById) throw new Error('An action item needs a creator');
  if (input.dueDate && !Number.isFinite(Date.parse(input.dueDate))) {
    throw new Error('The due date is not a valid date');
  }

  return {
    id: input.id,
    title,
    assigneeId: input.assigneeId,
    createdById: input.createdById,
    sourceSessionId: input.sourceSessionId,
    status: 'open',
    priority: input.priority ?? 'normal',
    dueDate: input.dueDate,
    requiresAcknowledgement: input.requiresAcknowledgement ?? true,
    reminders: [],
    history: [{ at: now.toISOString(), actorId: input.createdById, type: 'created' }],
  };
}

/** Only the assignee may acknowledge; acknowledging twice is a no-op. */
export function acknowledgeActionItem(item: ActionItem, actorId: string, now: Date = new Date()): ActionItem {
  if (actorId !== item.assigneeId) throw new Error('Only the assignee can acknowledge this action item');
  if (item.status === 'cancelled' || item.status === 'completed') {
    throw new Error('A closed action item cannot be acknowledged');
  }
  if (item.acknowledgedAt) return item;
  return append(
    { ...item, status: 'acknowledged', acknowledgedAt: now.toISOString() },
    { at: now.toISOString(), actorId, type: 'acknowledged' },
  );
}

/** Schedules a reminder for a still-open item. */
export function scheduleReminder(item: ActionItem, at: string, actorId: string, now: Date = new Date()): ActionItem {
  if (item.status === 'completed' || item.status === 'cancelled') {
    throw new Error('A closed action item cannot take new reminders');
  }
  if (!isFutureDate(at, now)) throw new Error('A reminder must be scheduled in the future');
  if (item.reminders.length >= MAX_ACTION_ITEM_REMINDERS) {
    throw new Error(`An action item holds at most ${MAX_ACTION_ITEM_REMINDERS} reminders`);
  }
  return append(
    { ...item, reminders: [...item.reminders, { at, sent: false }] },
    { at: now.toISOString(), actorId, type: 'reminder-scheduled' },
  );
}

/** Completes an item. Completion evidence is required and the audit trail is preserved. */
export function completeActionItem(
  item: ActionItem,
  actorId: string,
  evidence: ActionItemEvidence,
  now: Date = new Date(),
): ActionItem {
  if (item.status === 'completed') return item;
  if (item.status === 'cancelled') throw new Error('A cancelled action item cannot be completed');
  if (item.requiresAcknowledgement && !item.acknowledgedAt) {
    throw new Error('The assignee must acknowledge the item before it can be completed');
  }
  const ref = evidence.ref.trim();
  if (!ref) throw new Error('Completion evidence is required');
  return append(
    {
      ...item,
      status: 'completed',
      evidence: { ref, note: evidence.note },
      completedAt: now.toISOString(),
    },
    { at: now.toISOString(), actorId, type: 'completed', note: ref },
  );
}

/** Reopens a completed item without discarding its history or previous evidence. */
export function reopenActionItem(item: ActionItem, actorId: string, now: Date = new Date()): ActionItem {
  if (item.status !== 'completed') throw new Error('Only a completed action item can be reopened');
  return append(
    { ...item, status: item.acknowledgedAt ? 'acknowledged' : 'open', completedAt: undefined },
    { at: now.toISOString(), actorId, type: 'reopened' },
  );
}

export function cancelActionItem(item: ActionItem, actorId: string, now: Date = new Date()): ActionItem {
  if (item.status === 'completed') throw new Error('A completed action item cannot be cancelled');
  if (item.status === 'cancelled') return item;
  return append(
    { ...item, status: 'cancelled' },
    { at: now.toISOString(), actorId, type: 'cancelled' },
  );
}

/** An item is overdue while it is open or acknowledged and its due date has passed. */
export function isOverdue(item: ActionItem, now: Date = new Date()): boolean {
  if (item.status !== 'open' && item.status !== 'acknowledged') return false;
  return !!item.dueDate && now.getTime() > Date.parse(item.dueDate);
}

/** Items that still need work, optionally filtered to one assignee. */
export function listOpenActionItems(items: ActionItem[], assigneeId?: string): ActionItem[] {
  return items.filter(
    (item) =>
      (item.status === 'open' || item.status === 'acknowledged') &&
      (assigneeId === undefined || item.assigneeId === assigneeId),
  );
}
