import { apiClient } from '@/src/lib/api-client';
import { buildMentorshipEvent, trackMentorshipEvent } from '../analytics';
import type {
  AttendanceCorrection,
  AttendanceSession,
  AttendanceSignal,
  ParticipantAttendance,
  SignalInput,
} from './attendance';

const BASE = '/mentorship/sessions';

export interface SessionAttendance {
  session: AttendanceSession;
  attendance: ParticipantAttendance[];
  corrections: AttendanceCorrection[];
  /** Policy-driven notice, e.g. when raw signals are purged. */
  rawSignalsExpireAt?: string;
}

export const attendanceService = {
  get: (sessionId: string): Promise<SessionAttendance> =>
    apiClient.get<SessionAttendance>(`${BASE}/${encodeURIComponent(sessionId)}/attendance`),

  /** The same `idempotencyKey` on retry records the signal once. */
  record: (
    sessionId: string,
    participantId: string,
    input: SignalInput,
    idempotencyKey: string,
  ): Promise<AttendanceSignal> =>
    apiClient.post<AttendanceSignal>(`${BASE}/${encodeURIComponent(sessionId)}/attendance/signals`, {
      ...input,
      participantId,
      idempotencyKey,
    }),

  requestCorrection: (
    sessionId: string,
    input: {
      participantId: string;
      reason: string;
      proposedStatus: AttendanceCorrection['proposedStatus'];
      proposedMinutes?: number;
      idempotencyKey: string;
    },
  ): Promise<AttendanceCorrection> =>
    apiClient.post<AttendanceCorrection>(
      `${BASE}/${encodeURIComponent(sessionId)}/attendance/corrections`,
      input,
    ),

  /** Repeating the same decision is a no-op; a different one conflicts. */
  decideCorrection: (
    sessionId: string,
    correctionId: string,
    decision: 'approved' | 'rejected',
  ): Promise<AttendanceCorrection> =>
    apiClient.post<AttendanceCorrection>(
      `${BASE}/${encodeURIComponent(sessionId)}/attendance/corrections/${encodeURIComponent(
        correctionId,
      )}/decision`,
      { decision },
    ),
};

export type AttendanceAnalyticsAction =
  | 'recorded'
  | 'correction_requested'
  | 'correction_decided';

/** Events carry the action and ids only; never reasons or signal detail. */
export function trackAttendanceEvent(
  action: AttendanceAnalyticsAction,
  sessionId: string,
  actorKey: string,
  occurredAt: Date = new Date(),
): void {
  trackMentorshipEvent(
    buildMentorshipEvent('attendance', `${sessionId}:${action}`, actorKey, occurredAt),
  );
}
