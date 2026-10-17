/**
 * MENTOR-103: reliable lifecycle notification delivery.
 *
 * Domain transitions enqueue notifications into an outbox instead of calling a
 * provider directly, so commits never depend on provider uptime. Deduplication
 * keys guarantee at most one send per channel policy, transient failures retry
 * with exponential backoff, and exhausted entries land in a dead-letter queue
 * for inspection. Templates are localized and reject unsafe payloads.
 */

/** Payload keys that must never reach a notification provider. */
export const UNSAFE_PAYLOAD_KEYS = [
  'providerToken',
  'identityRef',
  'privateNote',
  'preciseLocation',
  'evidenceKey',
  'payoutDetails',
  'secret',
  'password',
] as const;

export type NotificationLocale = string;

export interface NotificationTemplate {
  id: string;
  category: 'application' | 'proposal' | 'session' | 'task' | 'payment' | 'safety';
  /** Localized subject/body by locale. */
  messages: Record<NotificationLocale, { subject: string; body: string }>;
}

export type OutboxStatus = 'pending' | 'sent' | 'dead_letter';

export interface OutboxEntry {
  id: string;
  /** Stable key: one send per (event, recipient, channel) policy. */
  dedupeKey: string;
  templateId: string;
  locale: NotificationLocale;
  channel: string;
  recipientId: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  lastError?: string;
  createdAt: string;
  sentAt?: string;
}

export interface OutboxState {
  entries: OutboxEntry[];
}

export interface EnqueueInput {
  eventId: string;
  templateId: string;
  locale: NotificationLocale;
  channel: string;
  recipientId: string;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
}

export const BASE_BACKOFF_MS = 1_000;

export function assertSafePayload(payload: Record<string, unknown>): void {
  const unsafe = Object.keys(payload).filter((key) =>
    (UNSAFE_PAYLOAD_KEYS as readonly string[]).includes(key),
  );
  if (unsafe.length > 0) throw new Error(`Payload contains sensitive keys: ${unsafe.join(', ')}`);
}

export function enqueue(
  state: OutboxState,
  input: EnqueueInput,
  now: Date = new Date(),
): { state: OutboxState; entry: OutboxEntry; duplicate: boolean } {
  assertSafePayload(input.payload ?? {});
  const dedupeKey = `${input.eventId}:${input.recipientId}:${input.channel}`;
  const existing = state.entries.find((entry) => entry.dedupeKey === dedupeKey);
  if (existing) return { state, entry: existing, duplicate: true };
  const entry: OutboxEntry = {
    id: `out-${dedupeKey}`,
    dedupeKey,
    templateId: input.templateId,
    locale: input.locale,
    channel: input.channel,
    recipientId: input.recipientId,
    payload: input.payload ?? {},
    status: 'pending',
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 3,
    nextAttemptAt: now.toISOString(),
    createdAt: now.toISOString(),
  };
  return { state: { entries: [...state.entries, entry] }, entry, duplicate: false };
}

export function dueEntries(state: OutboxState, now: Date = new Date()): OutboxEntry[] {
  return state.entries.filter((entry) => entry.status === 'pending' && Date.parse(entry.nextAttemptAt) <= now.getTime());
}

export function markSent(state: OutboxState, entryId: string, now: Date = new Date()): OutboxState {
  return {
    entries: state.entries.map((entry) =>
      entry.id === entryId && entry.status === 'pending'
        ? { ...entry, status: 'sent' as const, sentAt: now.toISOString(), lastError: undefined }
        : entry,
    ),
  };
}

export function markFailed(
  state: OutboxState,
  entryId: string,
  error: string,
  now: Date = new Date(),
): OutboxState {
  return {
    entries: state.entries.map((entry) => {
      if (entry.id !== entryId || entry.status !== 'pending') return entry;
      const attempts = entry.attempts + 1;
      if (attempts >= entry.maxAttempts) {
        return { ...entry, attempts, status: 'dead_letter' as const, lastError: error };
      }
      return {
        ...entry,
        attempts,
        lastError: error,
        nextAttemptAt: new Date(now.getTime() + BASE_BACKOFF_MS * 2 ** (attempts - 1)).toISOString(),
      };
    }),
  };
}

export type OutboxSender = (entry: OutboxEntry) => Promise<void>;

export interface ProcessResult {
  state: OutboxState;
  delivered: number;
  failed: number;
  deadLettered: number;
}

/** Drains due entries through a provider sender. Safe to call repeatedly. */
export async function processOutbox(
  state: OutboxState,
  sender: OutboxSender,
  now: Date = new Date(),
): Promise<ProcessResult> {
  let next = state;
  let delivered = 0;
  let failed = 0;
  let deadLettered = 0;
  for (const entry of dueEntries(state, now)) {
    try {
      await sender(entry);
      next = markSent(next, entry.id, now);
      delivered += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const before = next.entries.find((candidate) => candidate.id === entry.id);
      next = markFailed(next, entry.id, message, now);
      const after = next.entries.find((candidate) => candidate.id === entry.id);
      if (after?.status === 'dead_letter') deadLettered += 1;
      else if (before?.status === 'pending') failed += 1;
    }
  }
  return { state: next, delivered, failed, deadLettered };
}
