import { expect, test } from "@playwright/test";

const SESSION_ID = "session-mentor-065-fixture";
const SUMMARY_ID = "summary-mentor-065-fixture";

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

test.describe("MENTOR-065 shared session summary", () => {
  test("supports participant draft, explicit confirmation, and responsive keyboard access", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      {
        name: "session",
        value: "mentor-065-session",
        url: "http://localhost:3000",
      },
    ]);
    await page.addInitScript(() => {
      const user = { id: "mentor-065-user", role: "instructor" };
      localStorage.setItem("auth_user", JSON.stringify(user));
      localStorage.setItem("accessToken", "mentor-065-token");
      localStorage.setItem(
        "auth-storage",
        JSON.stringify({
          state: {
            isAuthenticated: true,
            user,
            token: "mentor-065-token",
            walletPublicKey: null,
          },
          version: 0,
        }),
      );
    });

    let currentState: "missing" | "draft" | "confirmed" = "missing";
    let saveAttempts = 0;
    let confirmAttempts = 0;
    const sessionRecord = () => ({
      sessionId: SESSION_ID,
      mentorId: "mentor-065-user",
      menteeId: "student-065-user",
      summary:
        currentState === "missing"
          ? null
          : {
              id: SUMMARY_ID,
              sessionId: SESSION_ID,
              state: currentState,
              authorId: "mentor-065-user",
              updatedBy: "mentor-065-user",
              revision: 1,
              createdAt: "2026-10-20T10:00:00.000Z",
              updatedAt: "2026-10-20T10:05:00.000Z",
              ...(currentState === "confirmed"
                ? {
                    confirmedBy: "student-065-user",
                    confirmedAt: "2026-10-20T10:10:00.000Z",
                  }
                : {}),
              summaryText: "Reviewed wallet access controls.",
              decisions: ["Use a multisig wallet."],
              resources: [
                {
                  label: "Security guide",
                  url: "https://example.test/security",
                },
              ],
              nextSteps: ["Review signer recovery."],
            },
    });

    await page.route(/\/mentorship\/sessions\?status=completed$/, (route) =>
      route.fulfill(
        json([
          {
            sessionId: SESSION_ID,
            startsAt: "2026-10-20T10:00:00.000Z",
            counterpartName: "Student Fixture",
            summaryState: currentState,
          },
        ]),
      ),
    );
    await page.route(`**/mentorship/sessions/${SESSION_ID}/summary`, (route) =>
      route.fulfill(json(sessionRecord())),
    );
    await page.route(
      `**/mentorship/sessions/${SESSION_ID}/summary/draft`,
      async (route) => {
        saveAttempts += 1;
        expect(route.request().headers()["idempotency-key"]).toBe(
          `summary-draft-${SESSION_ID}-0`,
        );
        currentState = "draft";
        return route.fulfill(json(sessionRecord()));
      },
    );
    await page.route(
      `**/mentorship/sessions/${SESSION_ID}/summary/confirm`,
      async (route) => {
        confirmAttempts += 1;
        expect(route.request().headers()["idempotency-key"]).toBe(
          `summary-confirm-${SESSION_ID}-1`,
        );
        currentState = "confirmed";
        return route.fulfill(json(sessionRecord()));
      },
    );
    await page.route("**/mentorship/analytics/events", (route) =>
      route.fulfill(json({ ok: true })),
    );

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 390, height: 844 },
    ]) {
      currentState = "missing";
      await page.setViewportSize(viewport);
      await page.goto("/mentorship/sessions");
      await page
        .getByRole("link", {
          name: /create summary for session with student fixture/i,
        })
        .click();
      await expect(
        page.getByRole("textbox", { name: "Summary" }),
      ).toBeVisible();
      await expect(page.getByText("Unconfirmed")).toBeVisible();

      await page
        .getByRole("textbox", { name: "Summary" })
        .fill("Reviewed wallet access controls.");
      await page
        .getByRole("textbox", { name: "Decisions" })
        .fill("Use a multisig wallet.");
      await page
        .getByRole("textbox", { name: "Resources" })
        .fill("Security guide | https://example.test/security");
      await page
        .getByRole("textbox", { name: "Next steps" })
        .fill("Review signer recovery.");
      await page.getByRole("textbox", { name: "Summary" }).focus();
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("textbox", { name: "Decisions" }),
      ).toBeFocused();
      await page.getByRole("button", { name: "Save draft" }).click();
      await expect(page.getByText(/draft saved/i)).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Confirm summary" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Confirm summary" }).click();
      await expect(page.getByText("Confirmed")).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Security guide" }),
      ).toHaveAttribute("rel", "noopener noreferrer");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }

    expect(saveAttempts).toBe(2);
    expect(confirmAttempts).toBe(2);
  });
});
