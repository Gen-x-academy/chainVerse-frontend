"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildMentorshipEvent, trackMentorshipEvent } from "../../analytics";
import type { MentorshipAnalyticsStage } from "../../analytics";
import {
  canStartRecording,
  currentParticipant,
  hasAllRequiredConsent,
} from "../domain";
import {
  RecordingConsentError,
  recordingErrorMessage,
  sessionRecordingService,
} from "../service";
import type {
  RecordingConsentDecision,
  RecordingConsentScope,
  RecordingErrorCode,
  SessionRecordingConsent,
} from "../types";

type Props = {
  sessionId: string;
  actorId: string;
};

const newIdempotencyKey = () => globalThis.crypto.randomUUID();

function opaqueActorKey(actorId: string): string {
  let hash = 5381;
  for (let index = 0; index < actorId.length; index += 1)
    hash = (hash * 33) ^ actorId.charCodeAt(index);
  return `actor-${(hash >>> 0).toString(36)}`;
}

function roleLabel(role: string): string {
  return role === "mentor"
    ? "Mentor"
    : role === "mentee"
      ? "Mentee"
      : "Guardian";
}

function consentLabel(status: string): string {
  return status.replaceAll("_", " ");
}

export function SessionRecordingConsentPanel({ sessionId, actorId }: Props) {
  const [session, setSession] = useState<SessionRecordingConsent | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<RecordingErrorCode | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const retryKeys = useRef(new Map<string, string>());
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSession(await sessionRecordingService.get(sessionId));
    } catch (caught) {
      setError(
        caught instanceof RecordingConsentError
          ? caught.code
          : "REQUEST_FAILED",
      );
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (
    action: string,
    operation: (idempotencyKey: string) => Promise<SessionRecordingConsent>,
    success: string,
  ) => {
    if (!session || busyRef.current) return;
    busyRef.current = true;
    const key = `${sessionId}:${action}`;
    const idempotencyKey = retryKeys.current.get(key) ?? newIdempotencyKey();
    retryKeys.current.set(key, idempotencyKey);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await operation(idempotencyKey);
      setSession(updated);
      retryKeys.current.delete(key);
      setNotice(success);
      const [, scope, decision] = action.split("-");
      let stage: MentorshipAnalyticsStage;
      if (action.startsWith("consent-")) {
        const granted = decision === "grant";
        const declined = decision === "decline";
        stage =
          scope === "guardian"
            ? granted
              ? "session_guardian_recording_consent_granted"
              : declined
                ? "session_guardian_recording_consent_declined"
                : "session_guardian_recording_consent_revoked"
            : granted
              ? "session_recording_consent_granted"
              : declined
                ? "session_recording_consent_declined"
                : "session_recording_consent_revoked";
      } else {
        stage =
          action === "start-recording"
            ? "session_recording_started"
            : "session_recording_stopped";
      }
      const actorKey = opaqueActorKey(actorId);
      trackMentorshipEvent(
        buildMentorshipEvent(stage, `${sessionId}:${actorKey}`, actorKey),
      );
    } catch (caught) {
      setError(
        caught instanceof RecordingConsentError
          ? caught.code
          : "REQUEST_FAILED",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (loading)
    return (
      <p role="status" className="text-sm text-slate-600">
        Loading recording settings...
      </p>
    );
  if (error && !session) {
    return (
      <div
        role="alert"
        className="space-y-3 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800"
      >
        <p>{recordingErrorMessage(error)}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="min-h-11 rounded border border-red-300 px-3 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Retry loading
        </button>
      </div>
    );
  }
  if (!session || session.participants.length === 0) {
    return (
      <p
        role="status"
        className="rounded border border-slate-200 p-4 text-sm text-slate-700"
      >
        No recording details are available for this session.
      </p>
    );
  }

  const participant = currentParticipant(session);
  if (!participant) {
    return (
      <p
        role="alert"
        className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
      >
        Your participant access could not be verified. Recording controls are
        unavailable.
      </p>
    );
  }

  const canStart = canStartRecording(session);
  const allConsent = hasAllRequiredConsent(session);
  const decision = (
    scope: RecordingConsentScope,
    value: RecordingConsentDecision,
    text: string,
  ) => (
    <button
      type="button"
      disabled={busy || !session.permissions.canConsent}
      onClick={() =>
        void run(
          `consent-${scope}-${value}`,
          (key) =>
            sessionRecordingService.recordConsent(sessionId, value, scope, key),
          "Your recording choice was saved.",
        )
      }
      className="min-h-11 rounded border border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
    >
      {text}
    </button>
  );

  return (
    <section aria-labelledby="recording-heading" className="space-y-5">
      <div className="space-y-2">
        <h2
          id="recording-heading"
          className="text-lg font-semibold text-slate-950"
        >
          Session recording
        </h2>
        <p className="text-sm text-slate-700">
          Recording policy: <strong>{session.policy.mode}</strong>.{" "}
          {session.policy.mode === "prohibited"
            ? "Recording is not allowed for this session."
            : "Recording cannot start until every participant has explicitly consented."}
        </p>
        <p className="text-sm text-slate-700">
          If consent is withdrawn:{" "}
          {session.policy.revocationPolicy === "stop_immediately"
            ? "recording stops immediately."
            : "recording stops when the session ends."}
        </p>
        <p className="text-sm text-slate-700">
          Retention: {session.policy.retentionDays} days from session
          completion.
        </p>
        <p className="text-sm text-slate-700">
          Access: {session.policy.accessRoles.map(roleLabel).join(", ")} only.
          Raw media is private and is never published.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {recordingErrorMessage(error)}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-emerald-800">
          {notice}
        </p>
      )}

      <ul
        aria-label="Participant consent status"
        className="divide-y divide-slate-200 border-y border-slate-200"
      >
        {session.participants.map((person) => (
          <li
            key={person.participantId}
            className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="font-medium text-slate-900">
              {person.isCurrentUser ? "You" : roleLabel(person.role)}
            </span>
            <span className="text-slate-700">
              Consent: {consentLabel(person.consent)}
            </span>
            {person.isMinor && (
              <span className="text-amber-800">
                Minor safeguards apply. Guardian consent:{" "}
                {consentLabel(person.guardianConsent)}.
              </span>
            )}
          </li>
        ))}
      </ul>

      {session.policy.mode !== "prohibited" &&
        session.permissions.canConsent && (
          <div className="space-y-3">
            <fieldset className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <legend className="mb-2 w-full text-sm font-medium text-slate-900 sm:basis-full">
                Your consent
              </legend>
              {participant.consent === "granted" ? (
                decision("participant", "revoke", "Withdraw consent")
              ) : (
                <>
                  {decision(
                    "participant",
                    "grant",
                    participant.consent === "pending"
                      ? "I consent to recording"
                      : "Give consent",
                  )}
                  {participant.consent === "pending" &&
                    decision("participant", "decline", "I do not consent")}
                </>
              )}
            </fieldset>
            {participant.role === "guardian" &&
              session.participants.some(
                (person) => person.isMinor && person.guardianConsentRequired,
              ) && (
                <fieldset className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <legend className="mb-2 w-full text-sm font-medium text-slate-900 sm:basis-full">
                    Consent for the minor in your care
                  </legend>
                  {session.participants.some(
                    (person) =>
                      person.isMinor && person.guardianConsent === "granted",
                  ) ? (
                    decision("guardian", "revoke", "Withdraw guardian consent")
                  ) : (
                    <>
                      {decision("guardian", "grant", "I consent as guardian")}
                      {decision(
                        "guardian",
                        "decline",
                        "I do not consent as guardian",
                      )}
                    </>
                  )}
                </fieldset>
              )}
          </div>
        )}

      {session.status === "recording" ? (
        session.policy.mode === "prohibited" ? (
          <p role="alert" className="font-medium text-red-800">
            This session prohibits recording, but the service reports an active
            recording. Stop it and contact support.
          </p>
        ) : (
          <p role="status" className="font-medium text-emerald-800">
            Recording is active. Provider reference is private.
          </p>
        )
      ) : session.status === "stopped" ? (
        <p role="status" className="text-sm text-slate-700">
          Recording has stopped.
        </p>
      ) : (
        <div className="space-y-2">
          {session.policy.mode !== "prohibited" && (
            <button
              type="button"
              disabled={busy || !canStart}
              onClick={() =>
                void run(
                  "start-recording",
                  (key) => sessionRecordingService.start(sessionId, key),
                  "Recording started.",
                )
              }
              className="min-h-11 rounded bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
              aria-describedby="recording-start-help"
            >
              Start recording
            </button>
          )}
          <p id="recording-start-help" className="text-sm text-slate-600">
            {session.policy.mode === "prohibited"
              ? "The session policy prohibits recording."
              : !allConsent
                ? "Waiting for explicit consent from every participant and any required guardian."
                : !session.permissions.canStart
                  ? "You are not authorized to start this recording."
                  : "All required consent is recorded."}
          </p>
        </div>
      )}

      {session.status === "recording" && session.permissions.canStop && (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run(
              "stop-recording",
              (key) => sessionRecordingService.stop(sessionId, key),
              "Recording stopped.",
            )
          }
          className="min-h-11 rounded border border-slate-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Stop recording
        </button>
      )}
    </section>
  );
}
