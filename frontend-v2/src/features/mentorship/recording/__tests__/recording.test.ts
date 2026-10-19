import { describe, expect, it } from "vitest";
import {
  canStartRecording,
  currentParticipant,
  hasAllRequiredConsent,
  providerReferenceIsOpaque,
} from "../domain";
import type { SessionRecordingConsent } from "../types";

const sessionFixture: SessionRecordingConsent = {
  sessionId: "session-mentor-mentee-001",
  policy: {
    mode: "optional",
    revocationPolicy: "stop_immediately",
    retentionDays: 30,
    accessRoles: ["mentor", "mentee"],
  },
  status: "not_started",
  participants: [
    {
      participantId: "participant-mentee-001",
      role: "mentee",
      isCurrentUser: true,
      isMinor: true,
      consent: "granted",
      guardianConsentRequired: true,
      guardianConsent: "pending",
    },
    {
      participantId: "participant-mentor-001",
      role: "mentor",
      isCurrentUser: false,
      isMinor: false,
      consent: "granted",
      guardianConsentRequired: false,
      guardianConsent: "not_required",
    },
    {
      participantId: "participant-guardian-001",
      role: "guardian",
      isCurrentUser: false,
      isMinor: false,
      consent: "granted",
      guardianConsentRequired: false,
      guardianConsent: "not_required",
    },
  ],
  providerReference: "provider-ref-opaque-001",
  permissions: { canConsent: true, canStart: true, canStop: false },
};

describe("MENTOR-068 session recording policy", () => {
  it("requires each participant and a minor participant guardian to consent", () => {
    expect(hasAllRequiredConsent(sessionFixture)).toBe(false);
    expect(canStartRecording(sessionFixture)).toBe(false);
    const consented = {
      ...sessionFixture,
      participants: sessionFixture.participants.map((participant) => ({
        ...participant,
        guardianConsent: participant.isMinor
          ? ("granted" as const)
          : participant.guardianConsent,
      })),
    };
    expect(hasAllRequiredConsent(consented)).toBe(true);
    expect(canStartRecording(consented)).toBe(true);
  });

  it("fails closed for prohibited policy, active recording, or missing permission", () => {
    const consented = {
      ...sessionFixture,
      participants: sessionFixture.participants.map((participant) => ({
        ...participant,
        guardianConsent: participant.isMinor
          ? ("granted" as const)
          : participant.guardianConsent,
      })),
    };
    expect(
      canStartRecording({
        ...consented,
        policy: { ...consented.policy, mode: "prohibited" },
      }),
    ).toBe(false);
    expect(canStartRecording({ ...consented, status: "recording" })).toBe(
      false,
    );
    expect(
      canStartRecording({
        ...consented,
        permissions: { ...consented.permissions, canStart: false },
      }),
    ).toBe(false);
  });

  it("does not infer an actor when participant identity is ambiguous", () => {
    expect(currentParticipant(sessionFixture)?.participantId).toBe(
      "participant-mentee-001",
    );
    expect(
      currentParticipant({ ...sessionFixture, participants: [] }),
    ).toBeUndefined();
    expect(
      currentParticipant({
        ...sessionFixture,
        participants: sessionFixture.participants.map((participant) => ({
          ...participant,
          isCurrentUser: true,
        })),
      }),
    ).toBeUndefined();
  });

  it("accepts opaque provider references but rejects public media links", () => {
    expect(providerReferenceIsOpaque("provider-ref-opaque-001")).toBe(true);
    expect(providerReferenceIsOpaque(null)).toBe(true);
    expect(
      providerReferenceIsOpaque("https://media.example/private/recording.mp4"),
    ).toBe(false);
    expect(providerReferenceIsOpaque("provider/ref?token=secret")).toBe(false);
  });
});
