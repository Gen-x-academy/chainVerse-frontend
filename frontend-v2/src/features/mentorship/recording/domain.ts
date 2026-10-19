import type { RecordingParticipant, SessionRecordingConsent } from "./types";

export function currentParticipant(
  session: SessionRecordingConsent,
): RecordingParticipant | undefined {
  const current = session.participants.filter(
    (participant) => participant.isCurrentUser,
  );
  return current.length === 1 ? current[0] : undefined;
}

export function hasAllRequiredConsent(
  session: SessionRecordingConsent,
): boolean {
  return (
    session.participants.length > 0 &&
    session.participants.every(
      (participant) =>
        participant.consent === "granted" &&
        (!participant.isMinor ||
          (participant.guardianConsentRequired &&
            participant.guardianConsent === "granted")),
    )
  );
}

export function canStartRecording(session: SessionRecordingConsent): boolean {
  return (
    session.policy.mode !== "prohibited" &&
    session.status === "not_started" &&
    session.permissions.canStart &&
    hasAllRequiredConsent(session)
  );
}

export function providerReferenceIsOpaque(reference: string | null): boolean {
  return (
    reference === null ||
    (reference.length > 0 &&
      reference.length <= 256 &&
      !/^https?:\/\//i.test(reference) &&
      !/[\\/?#]/.test(reference))
  );
}
