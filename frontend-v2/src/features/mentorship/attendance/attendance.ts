/**
 * MENTOR-063: privacy-aware session attendance.
 *
 * Attendance is derived from a small allowlist of signals (join, leave,
 * check-in) with a verification method. Location, device, network and
 * biometric data are never accepted. When policy requires corroboration a
 * participant's own claim cannot award attendance, corrections are append-only
 * and auditable, and raw signals expire by policy while the derived summary is
 * kept.
 */

export type AttendanceSignalKind = 'join' | 'leave' | 'check-in';
export type VerificationMethod =
  | 'platform-presence'
  | 'calendar-link'
  | 'counterpart-confirmation'
  | 'self-report';
export type AttendanceStatus = 'attended' | 'partial' | 'absent' | 'pending-corroboration';

export type AttendanceErrorCode =
  | 'NOT_AUTHORIZED'
  | 'INVALID_SIGNAL'
  | 'OUTSIDE_WINDOW'
  | 'PRIVACY_VIOLATION'
  | 'INVALID_CORRECTION'
  | 'SELF_APPROVAL'
  | 'ALREADY_DECIDED'
  | 'NOT_FOUND';

/** Stable, actionable messages. They never include signal or reason text. */
export const ATTENDANCE_ERROR_MESSAGES: Record<AttendanceErrorCode, string> = {
  NOT_AUTHORIZED: 'You do not have access to this session’s attendance.',
  INVALID_SIGNAL: 'This attendance signal is not valid. Refresh the session and try again.',
  OUTSIDE_WINDOW: 'Attendance can only be recorded shortly before, during or after the session.',
  PRIVACY_VIOLATION: 'Attendance cannot include location, device or biometric data.',
  INVALID_CORRECTION: 'Describe the correction in 1 to 500 characters and pick a valid outcome.',
  SELF_APPROVAL: 'You cannot approve your own correction request. Ask the other participant.',
  ALREADY_DECIDED: 'This correction was already decided differently.',
  NOT_FOUND: 'We could not find that session or correction. Refresh and try again.',
};

export class AttendanceError extends Error {
  readonly code: AttendanceErrorCode;
  constructor(code: AttendanceErrorCode) {
    super(ATTENDANCE_ERROR_MESSAGES[code]);
    this.name = 'AttendanceError';
    this.code = code;
  }
}

export interface AttendancePolicy {
  /** When true, a participant's own claim never awards attendance. */
  requireCorroboration: boolean;
  /** Share of the session (0–1) needed for `attended`. */
  fullAttendanceRatio: number;
  /** Share of the session (0–1) needed for `partial`. */
  partialAttendanceRatio: number;
  /** A join with no leave counts for at most this long. */
  maxUnclosedMinutes: number;
  /** Raw signals are purged after this many days; summaries are kept. */
  rawSignalRetentionDays: number;
  /** Signals are accepted this many minutes before start / after end. */
  windowGraceMinutes: number;
}

export const DEFAULT_ATTENDANCE_POLICY: AttendancePolicy = {
  requireCorroboration: true,
  fullAttendanceRatio: 0.8,
  partialAttendanceRatio: 0.25,
  maxUnclosedMinutes: 5,
  rawSignalRetentionDays: 30,
  windowGraceMinutes: 15,
};

export interface AttendanceSession {
  id: string;
  scheduledStart: string;
  scheduledEnd: string;
  participantIds: readonly string[];
}

export interface AttendanceSignal {
  id: string;
  sessionId: string;
  participantId: string;
  kind: AttendanceSignalKind;
  method: VerificationMethod;
  /** When the event happened. */
  at: string;
  /** When the server received it; drives retention. */
  receivedAt: string;
  /** Participant who confirmed it (counterpart-confirmation only). */
  attestedBy?: string;
}

export interface AttendanceViewer {
  userId: string | null | undefined;
  /** Coordinators/administrators may view and decide, never record. */
  isCoordinator?: boolean;
}

const ALLOWED_INPUT_KEYS = new Set(['kind', 'method', 'at', 'attestedBy']);
const FORBIDDEN_KEY_PATTERN =
  /^(lat|latitude|lng|lon|longitude|geo|geolocation|location|gps|address|ip|ipaddress|device|deviceid|fingerprint|biometric|biometrics|faceid|voiceprint|camera|useragent)$/i;

const MINUTE = 60_000;

/** Participants may view; coordinators may view; everyone else is denied. */
export function canViewAttendance(viewer: AttendanceViewer, session: AttendanceSession): boolean {
  if (!viewer.userId) return false;
  return Boolean(viewer.isCoordinator) || session.participantIds.includes(viewer.userId);
}

export interface SignalInput {
  kind: AttendanceSignalKind;
  method: VerificationMethod;
  at: string;
  attestedBy?: string;
}

/**
 * Validates a recording request. Only participants can record, only for
 * themselves (or a counterpart confirmation about the other participant),
 * only inside the session window, and only allowlisted fields are accepted.
 */
export function validateSignalInput(
  viewer: AttendanceViewer,
  session: AttendanceSession,
  subjectId: string,
  input: Record<string, unknown>,
  policy: AttendancePolicy = DEFAULT_ATTENDANCE_POLICY,
): SignalInput {
  if (!viewer.userId || !session.participantIds.includes(viewer.userId)) {
    throw new AttendanceError('NOT_AUTHORIZED');
  }
  for (const key of Object.keys(input)) {
    if (FORBIDDEN_KEY_PATTERN.test(key)) throw new AttendanceError('PRIVACY_VIOLATION');
    if (!ALLOWED_INPUT_KEYS.has(key)) throw new AttendanceError('INVALID_SIGNAL');
  }
  const { kind, method, at, attestedBy } = input as Partial<SignalInput>;
  if (!kind || !['join', 'leave', 'check-in'].includes(kind)) {
    throw new AttendanceError('INVALID_SIGNAL');
  }
  if (
    !method ||
    !['platform-presence', 'calendar-link', 'counterpart-confirmation', 'self-report'].includes(
      method,
    )
  ) {
    throw new AttendanceError('INVALID_SIGNAL');
  }
  const time = typeof at === 'string' ? Date.parse(at) : Number.NaN;
  if (Number.isNaN(time)) throw new AttendanceError('INVALID_SIGNAL');

  if (method === 'counterpart-confirmation') {
    // Confirms someone else; the confirmer must be a different participant.
    if (
      attestedBy !== viewer.userId ||
      subjectId === viewer.userId ||
      !session.participantIds.includes(subjectId)
    ) {
      throw new AttendanceError('NOT_AUTHORIZED');
    }
  } else if (subjectId !== viewer.userId || attestedBy !== undefined) {
    throw new AttendanceError('NOT_AUTHORIZED');
  }

  const start = Date.parse(session.scheduledStart) - policy.windowGraceMinutes * MINUTE;
  const end = Date.parse(session.scheduledEnd) + policy.windowGraceMinutes * MINUTE;
  if (time < start || time > end) throw new AttendanceError('OUTSIDE_WINDOW');

  return { kind, method, at: new Date(time).toISOString(), ...(attestedBy ? { attestedBy } : {}) };
}

/** True when the signal is independent of the participant's own claim. */
export function isCorroborated(signal: AttendanceSignal): boolean {
  if (signal.method === 'platform-presence' || signal.method === 'calendar-link') return true;
  if (signal.method === 'counterpart-confirmation') {
    return Boolean(signal.attestedBy) && signal.attestedBy !== signal.participantId;
  }
  return false;
}

export type CorrectionState = 'requested' | 'approved' | 'rejected';

export interface CorrectionAuditEntry {
  action: 'requested' | 'approved' | 'rejected';
  actorId: string;
  at: string;
}

export interface AttendanceCorrection {
  id: string;
  sessionId: string;
  participantId: string;
  requestedBy: string;
  /** Free text; excluded from logs and analytics. */
  reason: string;
  proposedStatus: Exclude<AttendanceStatus, 'pending-corroboration'>;
  proposedMinutes?: number;
  state: CorrectionState;
  /** Append-only. */
  audit: readonly CorrectionAuditEntry[];
}

export const CORRECTION_REASON_MAX_LENGTH = 500;

export function createCorrectionRequest(
  viewer: AttendanceViewer,
  session: AttendanceSession,
  input: {
    id: string;
    participantId: string;
    reason: string;
    proposedStatus: AttendanceCorrection['proposedStatus'];
    proposedMinutes?: number;
  },
  at: Date,
): AttendanceCorrection {
  if (!viewer.userId || !session.participantIds.includes(viewer.userId)) {
    throw new AttendanceError('NOT_AUTHORIZED');
  }
  if (!session.participantIds.includes(input.participantId)) {
    throw new AttendanceError('NOT_AUTHORIZED');
  }
  const reason = input.reason.trim();
  const minutesOk =
    input.proposedMinutes === undefined ||
    (Number.isInteger(input.proposedMinutes) && input.proposedMinutes >= 0);
  if (
    reason.length === 0 ||
    reason.length > CORRECTION_REASON_MAX_LENGTH ||
    !['attended', 'partial', 'absent'].includes(input.proposedStatus) ||
    !minutesOk
  ) {
    throw new AttendanceError('INVALID_CORRECTION');
  }
  return {
    id: input.id,
    sessionId: session.id,
    participantId: input.participantId,
    requestedBy: viewer.userId,
    reason,
    proposedStatus: input.proposedStatus,
    ...(input.proposedMinutes !== undefined ? { proposedMinutes: input.proposedMinutes } : {}),
    state: 'requested',
    audit: [{ action: 'requested', actorId: viewer.userId, at: at.toISOString() }],
  };
}

/**
 * Decides a correction. The requester can never decide their own request.
 * Repeating the same decision returns the same record (retry-safe); a
 * different decision after the first is `ALREADY_DECIDED`.
 */
export function decideCorrection(
  viewer: AttendanceViewer,
  session: AttendanceSession,
  correction: AttendanceCorrection,
  decision: 'approved' | 'rejected',
  at: Date,
): AttendanceCorrection {
  if (!canViewAttendance(viewer, session) || !viewer.userId) {
    throw new AttendanceError('NOT_AUTHORIZED');
  }
  if (viewer.userId === correction.requestedBy) throw new AttendanceError('SELF_APPROVAL');
  if (correction.state !== 'requested') {
    if (correction.state === decision) return correction;
    throw new AttendanceError('ALREADY_DECIDED');
  }
  return {
    ...correction,
    state: decision,
    audit: [...correction.audit, { action: decision, actorId: viewer.userId, at: at.toISOString() }],
  };
}

export interface ParticipantAttendance {
  participantId: string;
  status: AttendanceStatus;
  /** Minutes present within the scheduled window. */
  presentMinutes: number;
  /** Share of the scheduled session (0–1), for partial attendance. */
  ratio: number;
  methods: VerificationMethod[];
  corrected: boolean;
}

function mergedMinutes(intervals: Array<[number, number]>): number {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cursor = -Infinity;
  for (const [from, to] of sorted) {
    const start = Math.max(from, cursor);
    if (to > start) {
      total += to - start;
      cursor = to;
    }
  }
  return total;
}

/**
 * Derives attendance from signals. Deterministic: signals are ordered by time
 * then id. Only corroborated signals count when policy requires it, a
 * participant with only self-reports is `pending-corroboration`, and approved
 * corrections (latest wins) override the derived result.
 */
export function computeAttendance(
  session: AttendanceSession,
  signals: readonly AttendanceSignal[],
  corrections: readonly AttendanceCorrection[] = [],
  policy: AttendancePolicy = DEFAULT_ATTENDANCE_POLICY,
): ParticipantAttendance[] {
  const start = Date.parse(session.scheduledStart);
  const end = Date.parse(session.scheduledEnd);
  const scheduledMinutes = Math.max(1, (end - start) / MINUTE);

  return [...session.participantIds].sort().map((participantId) => {
    const own = signals
      .filter((s) => s.sessionId === session.id && s.participantId === participantId)
      .sort((a, b) => (a.at === b.at ? a.id.localeCompare(b.id) : a.at.localeCompare(b.at)));
    const counted = policy.requireCorroboration ? own.filter(isCorroborated) : own;

    const intervals: Array<[number, number]> = [];
    let open: number | null = null;
    for (const signal of counted) {
      const t = Date.parse(signal.at);
      if (signal.kind === 'leave') {
        if (open !== null) {
          intervals.push([open, t]);
          open = null;
        }
      } else if (open === null) {
        open = t;
      }
    }
    if (open !== null) intervals.push([open, open + policy.maxUnclosedMinutes * MINUTE]);

    const clipped = intervals
      .map(([from, to]): [number, number] => [Math.max(from, start), Math.min(to, end)])
      .filter(([from, to]) => to > from);
    let presentMinutes = Math.floor(mergedMinutes(clipped) / MINUTE);
    let ratio = Math.min(1, presentMinutes / scheduledMinutes);

    let status: AttendanceStatus;
    if (counted.length === 0 && own.length > 0 && policy.requireCorroboration) {
      status = 'pending-corroboration';
    } else if (ratio >= policy.fullAttendanceRatio) status = 'attended';
    else if (ratio >= policy.partialAttendanceRatio) status = 'partial';
    else status = 'absent';

    let corrected = false;
    const approved = corrections
      .filter(
        (c) =>
          c.state === 'approved' && c.sessionId === session.id && c.participantId === participantId,
      )
      .sort((a, b) => a.audit[a.audit.length - 1].at.localeCompare(b.audit[b.audit.length - 1].at))
      .pop();
    if (approved) {
      corrected = true;
      status = approved.proposedStatus;
      if (approved.proposedMinutes !== undefined) {
        presentMinutes = Math.min(approved.proposedMinutes, scheduledMinutes);
        ratio = Math.min(1, presentMinutes / scheduledMinutes);
      }
    }

    return {
      participantId,
      status,
      presentMinutes,
      ratio: Math.round(ratio * 1000) / 1000,
      methods: [...new Set(own.map((s) => s.method))].sort(),
      corrected,
    };
  });
}

/**
 * Splits signals into those still inside the retention window and those due
 * for purge. Derived summaries must be persisted before purging raw signals.
 */
export function partitionExpiredSignals(
  signals: readonly AttendanceSignal[],
  policy: AttendancePolicy,
  now: Date,
): { kept: AttendanceSignal[]; expired: AttendanceSignal[] } {
  const cutoff = now.getTime() - policy.rawSignalRetentionDays * 24 * 60 * MINUTE;
  const kept: AttendanceSignal[] = [];
  const expired: AttendanceSignal[] = [];
  for (const signal of signals) {
    (Date.parse(signal.receivedAt) < cutoff ? expired : kept).push(signal);
  }
  return { kept, expired };
}

/** Log-safe view: ids and kinds only, never free text. */
export function redactCorrectionForLog(correction: AttendanceCorrection): {
  id: string;
  sessionId: string;
  state: CorrectionState;
  reasonLength: number;
} {
  return {
    id: correction.id,
    sessionId: correction.sessionId,
    state: correction.state,
    reasonLength: correction.reason.length,
  };
}

export function toAttendanceError(error: unknown): AttendanceError {
  if (error instanceof AttendanceError) return error;
  const status = (error as { status?: number } | null)?.status;
  if (status === 404) return new AttendanceError('NOT_FOUND');
  if (status === 409) return new AttendanceError('ALREADY_DECIDED');
  if (status === 400 || status === 422) return new AttendanceError('INVALID_SIGNAL');
  return new AttendanceError('NOT_AUTHORIZED');
}
