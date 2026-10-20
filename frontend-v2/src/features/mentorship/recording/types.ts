export type RecordingMode = "prohibited" | "optional" | "required";
export type RecordingRevocationPolicy =
  | "stop_immediately"
  | "stop_at_session_end";
export type RecordingConsentStatus =
  | "pending"
  | "granted"
  | "declined"
  | "revoked";

export interface RecordingParticipant {
  participantId: string;
  role: "mentor" | "mentee" | "guardian";
  isCurrentUser: boolean;
  isMinor: boolean;
  consent: RecordingConsentStatus;
  guardianConsentRequired: boolean;
  guardianConsent: RecordingConsentStatus | "not_required";
}

export interface SessionRecordingConsent {
  sessionId: string;
  policy: {
    mode: RecordingMode;
    revocationPolicy: RecordingRevocationPolicy;
    retentionDays: number;
    accessRoles: Array<"mentor" | "mentee" | "guardian" | "moderator">;
  };
  status: "not_started" | "recording" | "stopped";
  participants: RecordingParticipant[];
  /** Opaque provider identifier only. This must never contain a URL or media. */
  providerReference: string | null;
  permissions: {
    canConsent: boolean;
    canStart: boolean;
    canStop: boolean;
  };
}

export type RecordingConsentDecision = "grant" | "decline" | "revoke";
export type RecordingConsentScope = "participant" | "guardian";

export type RecordingErrorCode =
  | "ACCESS_DENIED"
  | "STATE_CONFLICT"
  | "REQUEST_FAILED";
