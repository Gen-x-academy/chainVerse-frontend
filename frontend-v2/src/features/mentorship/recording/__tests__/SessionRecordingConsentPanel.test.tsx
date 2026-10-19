import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionRecordingConsentPanel } from "../components/SessionRecordingConsentPanel";
import { RecordingConsentError, sessionRecordingService } from "../service";
import type { SessionRecordingConsent } from "../types";

vi.mock("../service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../service")>();
  return {
    ...actual,
    sessionRecordingService: {
      get: vi.fn(),
      recordConsent: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    },
  };
});

vi.mock("../../analytics", () => ({
  buildMentorshipEvent: vi.fn(() => ({})),
  trackMentorshipEvent: vi.fn(),
}));

const fixture: SessionRecordingConsent = {
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
      participantId: "mentee-001",
      role: "mentee",
      isCurrentUser: true,
      isMinor: false,
      consent: "pending",
      guardianConsentRequired: false,
      guardianConsent: "not_required",
    },
    {
      participantId: "mentor-001",
      role: "mentor",
      isCurrentUser: false,
      isMinor: false,
      consent: "pending",
      guardianConsentRequired: false,
      guardianConsent: "not_required",
    },
  ],
  providerReference: "provider-ref-opaque-001",
  permissions: { canConsent: true, canStart: true, canStop: false },
};

const service = vi.mocked(sessionRecordingService);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SessionRecordingConsentPanel", () => {
  it("announces loading, shows policy and retention, and gates start until all participants consent", async () => {
    service.get.mockResolvedValue(fixture);
    render(
      <SessionRecordingConsentPanel
        sessionId={fixture.sessionId}
        actorId="user-private-1"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      /loading recording settings/i,
    );
    expect(
      await screen.findByRole("heading", { name: /session recording/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/retention: 30 days/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /start recording/i }),
    ).toBeDisabled();
    expect(
      screen.getByText(/waiting for explicit consent from every participant/i),
    ).toBeInTheDocument();
  });

  it("records a clear keyboard-accessible participant choice and does not start recording early", async () => {
    const user = userEvent.setup();
    service.get.mockResolvedValue(fixture);
    service.recordConsent.mockResolvedValue({
      ...fixture,
      participants: fixture.participants.map((participant) =>
        participant.isCurrentUser
          ? { ...participant, consent: "granted" }
          : participant,
      ),
    });
    render(
      <SessionRecordingConsentPanel
        sessionId={fixture.sessionId}
        actorId="user-private-1"
      />,
    );
    const consentButton = await screen.findByRole("button", {
      name: /i consent to recording/i,
    });
    consentButton.focus();
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(service.recordConsent).toHaveBeenCalledWith(
        fixture.sessionId,
        "grant",
        "participant",
        expect.any(String),
      ),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      /your recording choice was saved/i,
    );
    expect(
      screen.getByRole("button", { name: /start recording/i }),
    ).toBeDisabled();
    expect(service.start).not.toHaveBeenCalled();
  });

  it("reuses the same idempotency key after a failed consent request is retried", async () => {
    const user = userEvent.setup();
    service.get.mockResolvedValue(fixture);
    service.recordConsent
      .mockRejectedValueOnce(new RecordingConsentError("REQUEST_FAILED"))
      .mockResolvedValueOnce(fixture);
    render(
      <SessionRecordingConsentPanel
        sessionId={fixture.sessionId}
        actorId="user-private-1"
      />,
    );
    const button = await screen.findByRole("button", {
      name: /i consent to recording/i,
    });
    await user.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent(/retry safely/i);
    await user.click(button);

    await waitFor(() => expect(service.recordConsent).toHaveBeenCalledTimes(2));
    expect(service.recordConsent.mock.calls[0][3]).toBe(
      service.recordConsent.mock.calls[1][3],
    );
  });

  it("does not expose consent controls when authorization is denied", async () => {
    service.get.mockResolvedValue({
      ...fixture,
      participants: fixture.participants.map((participant) => ({
        ...participant,
        consent: "granted",
      })),
      permissions: { canConsent: false, canStart: false, canStop: false },
    });
    render(
      <SessionRecordingConsentPanel
        sessionId={fixture.sessionId}
        actorId="user-private-1"
      />,
    );

    expect(
      await screen.findByRole("button", { name: /start recording/i }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /i consent to recording/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/not authorized to start this recording/i),
    ).toBeInTheDocument();
  });

  it("renders stable actionable load errors and a retry control", async () => {
    service.get.mockRejectedValueOnce(new Error("secret provider detail"));
    service.get.mockResolvedValueOnce(fixture);
    const user = userEvent.setup();
    render(
      <SessionRecordingConsentPanel
        sessionId={fixture.sessionId}
        actorId="user-private-1"
      />,
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/request could not be completed/i);
    expect(alert).not.toHaveTextContent(/secret provider detail/i);
    await user.click(screen.getByRole("button", { name: /retry loading/i }));
    expect(
      await screen.findByRole("heading", { name: /session recording/i }),
    ).toBeInTheDocument();
  });

  it("shows the empty state and never renders the provider reference", async () => {
    service.get.mockResolvedValue({ ...fixture, participants: [] });
    render(
      <SessionRecordingConsentPanel
        sessionId={fixture.sessionId}
        actorId="user-private-1"
      />,
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      /no recording details/i,
    );
    expect(
      screen.queryByText("provider-ref-opaque-001"),
    ).not.toBeInTheDocument();
  });

  it("offers a separate guardian consent decision for a minor", async () => {
    service.get.mockResolvedValue({
      ...fixture,
      participants: [
        {
          ...fixture.participants[0],
          isCurrentUser: false,
          isMinor: true,
          guardianConsentRequired: true,
          guardianConsent: "pending",
        },
        {
          ...fixture.participants[1],
          isCurrentUser: true,
          role: "guardian",
          consent: "granted",
        },
      ],
    });
    service.recordConsent.mockResolvedValue(fixture);
    const user = userEvent.setup();
    render(
      <SessionRecordingConsentPanel
        sessionId={fixture.sessionId}
        actorId="guardian-private-1"
      />,
    );
    const guardianConsent = await screen.findByRole("button", {
      name: /i consent as guardian/i,
    });
    guardianConsent.focus();
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(service.recordConsent).toHaveBeenCalledWith(
        fixture.sessionId,
        "grant",
        "guardian",
        expect.any(String),
      ),
    );
  });
});
