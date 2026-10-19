import { expect, test } from "@playwright/test";

const sessionId = "session-mentor-mentee-001";
const apiSession = {
  sessionId,
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
      consent: "granted",
      guardianConsentRequired: false,
      guardianConsent: "not_required",
    },
  ],
  providerReference: "opaque-provider-reference-test-only",
  permissions: { canConsent: true, canStart: true, canStop: false },
};

test("participant consents and starts recording at mobile and desktop widths", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "session", value: "recording-e2e", domain: "localhost", path: "/" },
  ]);
  await page.addInitScript(() => {
    localStorage.setItem(
      "auth-storage",
      JSON.stringify({
        state: {
          isAuthenticated: true,
          user: { id: "student-private-id", role: "student" },
          token: "e2e-token",
        },
        version: 0,
      }),
    );
  });

  await page.route(
    "**/mentorship/sessions/session-mentor-mentee-001/recording**",
    async (route) => {
      const request = route.request();
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(apiSession),
        });
        return;
      }
      const body = request.postDataJSON() as {
        decision?: string;
        idempotencyKey?: string;
      };
      if (request.url().endsWith("/consents")) {
        expect(body.idempotencyKey).toBeTruthy();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...apiSession,
            participants: apiSession.participants.map((person) =>
              person.isCurrentUser
                ? {
                    ...person,
                    consent:
                      body.decision === "grant" ? "granted" : body.decision,
                  }
                : person,
            ),
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...apiSession,
          status: "recording",
          permissions: { ...apiSession.permissions, canStop: true },
        }),
      });
    },
  );
  await page.route("**/mentorship/analytics/events", async (route) => {
    const event = route.request().postData() ?? "";
    expect(event).not.toContain("student-private-id");
    expect(event).not.toContain("opaque-provider-reference-test-only");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/mentorship/sessions/${sessionId}/recording`);
  await expect(
    page.getByRole("heading", { name: /session recording consent/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /start recording/i }),
  ).toBeDisabled();
  expect(
    await page
      .locator("main")
      .evaluate((main) => main.scrollWidth <= main.clientWidth),
  ).toBe(true);

  const consentButton = page.getByRole("button", {
    name: /i consent to recording/i,
  });
  await consentButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText(
    /your recording choice was saved/i,
  );
  await expect(
    page.getByRole("button", { name: /start recording/i }),
  ).toBeEnabled();

  await page.setViewportSize({ width: 1280, height: 720 });
  expect(
    await page
      .locator("main")
      .evaluate((main) => main.scrollWidth <= main.clientWidth),
  ).toBe(true);
  await page.getByRole("button", { name: /start recording/i }).click();
  await expect(page.getByRole("status")).toContainText(/recording is active/i);
  await expect(
    page.getByText("opaque-provider-reference-test-only"),
  ).toHaveCount(0);
});
