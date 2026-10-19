import { expect, test, type Page } from "@playwright/test";

const TENANT_ID = "tenant-mentor-067";
const SESSION_ID = "session-mentor-067";
const DISPUTE_ID = "dispute-mentor-067";

async function prepareParticipant(page: Page) {
  await page
    .context()
    .addCookies([
      {
        name: "session",
        value: "mentor-067-session",
        url: "http://localhost:3000",
      },
    ]);
  await page.addInitScript(
    ({ tenantId }) => {
      const user = { id: "student-mentor-067", role: "student", tenantId };
      localStorage.setItem("auth_user", JSON.stringify(user));
      localStorage.setItem(
        "auth-storage",
        JSON.stringify({
          state: { isAuthenticated: true, user, token: "e2e-token" },
          version: 0,
        }),
      );
    },
    { tenantId: TENANT_ID },
  );

  await page.route("**/mentorship/config**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ featureFlags: { disputes: true } }),
    }),
  );

  let disputeOpened = false;
  await page.route("**/mentorship/disputes**", async (route) => {
    if (route.request().method() === "POST") {
      disputeOpened = true;
      const body = route.request().postDataJSON();
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          publicId: DISPUTE_ID,
          sessionId: body.sessionId,
          isOpenedByCurrentUser: true,
          issue: body.issue,
          summary: body.summary,
          evidenceReferences: body.evidenceReferences,
          status: "awaiting-response",
          openedAt: "2030-06-01T10:00:00.000Z",
          responseDeadlineAt: "2030-06-02T10:00:00.000Z",
          settlementStatus: "paused",
          permissions: { canRespond: false, canResolve: false },
        }),
      });
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        tenantId: TENANT_ID,
        sessions: disputeOpened
          ? []
          : [
              {
                publicId: SESSION_ID,
                completedAt: "2030-06-01T09:00:00.000Z",
                settlementStatus: "pending",
                canOpenDispute: true,
              },
            ],
        disputes: disputeOpened
          ? [
              {
                publicId: DISPUTE_ID,
                sessionId: SESSION_ID,
                isOpenedByCurrentUser: true,
                issue: "attendance",
                summary: "The session did not take place.",
                evidenceReferences: ["evidence:call-log-mentor-067"],
                status: "awaiting-response",
                openedAt: "2030-06-01T10:00:00.000Z",
                responseDeadlineAt: "2030-06-02T10:00:00.000Z",
                settlementStatus: "paused",
                permissions: { canRespond: false, canResolve: false },
              },
            ]
          : [],
      }),
    });
  });
}

test("participant opens an accessible dispute and sees settlement paused", async ({
  page,
}) => {
  await prepareParticipant(page);
  await page.goto("/mentorship/disputes");

  await expect(
    page.getByRole("heading", { name: "Session disputes" }),
  ).toBeVisible();
  const session = page.getByLabel("Session");
  await session.focus();
  await session.press("ArrowDown");
  await session.press("Enter");
  const issue = page.getByLabel("What are you challenging?");
  await issue.focus();
  await issue.press("ArrowDown");
  await issue.press("Enter");
  const summary = page.getByLabel("Description");
  await summary.focus();
  await summary.pressSequentially("The session did not take place.");
  const evidence = page.getByLabel(/evidence references, one per line/i);
  await evidence.focus();
  await evidence.pressSequentially("evidence:call-log-mentor-067");
  await page
    .getByRole("button", { name: /open dispute and pause settlement/i })
    .focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("status")).toContainText(/settlement is paused/i);
  await expect(page.getByText("Settlement paused")).toBeVisible();
  await expect(page.getByText("evidence:call-log-mentor-067")).toBeVisible();
});

test("dispute workspace fits a narrow viewport without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareParticipant(page);
  await page.goto("/mentorship/disputes");
  await expect(
    page.getByRole("heading", { name: "Session disputes" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: /open dispute and pause settlement/i }),
  ).toBeVisible();
});
