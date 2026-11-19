/**
 * Clone, archive and sunset project calls (CAPSTONE-024).
 *
 * Cloning copies only safe configuration into a new draft. Participants,
 * decisions, evidence and financial records are never copied: they are not even
 * read, because the clone is built by picking an allow-list of fields.
 * Archiving and sunsetting stop a call from taking new applications without
 * touching its history.
 */

export type CallStatus = "draft" | "published" | "sunset" | "archived";

export interface CallRecord {
  id: string;
  status: CallStatus;
  title: string;
  theme: string;
  problemStatement: string;
  outcomes: string[];
  eligibilityRule: unknown;
  termsTemplate: string;
  capacity: number;
  deliveryMode: string;
  cohortId?: string;
  /** Applications stop being accepted from this date (YYYY-MM-DD) when set. */
  sunsetOn?: string;
  archivedOn?: string;
  version: number;
  // Everything below is history and is never copied by a clone.
  participants?: unknown[];
  applications?: unknown[];
  decisions?: unknown[];
  evidence?: unknown[];
  budget?: unknown;
  payments?: unknown[];
  auditLog?: unknown[];
}

/** The only fields a clone carries over. Adding a field here is a deliberate review decision. */
export const CLONEABLE_FIELDS = ["theme", "problemStatement", "outcomes", "eligibilityRule", "termsTemplate", "capacity", "deliveryMode"] as const;

export function cloneCall(source: CallRecord, newId: string, overrides: { title?: string; cohortId?: string } = {}): CallRecord {
  const copy: Record<string, unknown> = {};
  for (const field of CLONEABLE_FIELDS) copy[field] = structuredClone(source[field]);
  return {
    ...(copy as Pick<CallRecord, (typeof CLONEABLE_FIELDS)[number]>),
    id: newId,
    status: "draft",
    title: overrides.title?.trim() || `${source.title} (copy)`,
    ...(overrides.cohortId ? { cohortId: overrides.cohortId } : {}),
    version: 1,
  };
}

export type LifecycleError = "NOT_PUBLISHED" | "ALREADY_ARCHIVED" | "INVALID_DATE" | "SUNSET_IN_PAST" | "NOT_ARCHIVABLE";

export type LifecycleResult = { ok: true; call: CallRecord } | { ok: false; error: LifecycleError };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Schedule a sunset: from `sunsetOn` the call accepts no new applications. */
export function sunsetCall(call: CallRecord, sunsetOn: string, today: string): LifecycleResult {
  if (!DATE.test(sunsetOn) || !DATE.test(today)) return { ok: false, error: "INVALID_DATE" };
  if (call.status !== "published" && call.status !== "sunset") return { ok: false, error: "NOT_PUBLISHED" };
  if (sunsetOn < today) return { ok: false, error: "SUNSET_IN_PAST" };
  return { ok: true, call: { ...call, status: "sunset", sunsetOn, version: call.version + 1 } };
}

/** Archive a call: allowed for drafts, published and sunset calls; idempotent date handling. */
export function archiveCall(call: CallRecord, today: string): LifecycleResult {
  if (!DATE.test(today)) return { ok: false, error: "INVALID_DATE" };
  if (call.status === "archived") return { ok: false, error: "ALREADY_ARCHIVED" };
  return { ok: true, call: { ...call, status: "archived", archivedOn: today, version: call.version + 1 } };
}

/** Whether a call accepts new applications on `today`. */
export function acceptsApplications(call: CallRecord, today: string): boolean {
  if (call.status === "published") return true;
  if (call.status === "sunset") return call.sunsetOn !== undefined && today < call.sunsetOn;
  return false;
}

/** Calls whose sunset date has arrived should move to archived by a scheduled job. */
export function dueForArchive(calls: readonly CallRecord[], today: string): string[] {
  return calls.filter((c) => c.status === "sunset" && c.sunsetOn !== undefined && c.sunsetOn <= today).map((c) => c.id);
}
