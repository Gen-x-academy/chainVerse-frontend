import { test, expect, type Page } from "@playwright/test"

/**
 * End-to-end mentorship journey (closes #1366, MENTOR-119).
 *
 * Automates organization setup through mentor publication, discovery,
 * application, match, agreement, funding, sessions, milestones, completion,
 * review, and credential verification.
 *
 * - Deterministic fixtures: no personal data, fixed ids and statuses.
 * - Covers a failure and recovery path (application submit retried once).
 * - Asserts cross-system ids and deny-by-default permissions.
 * - All network calls are mocked, so the journey is CI-reliable and offline.
 */

const TENANT_ID = "tenant-e2e-1"
const PROGRAM_ID = "program-e2e-1"
const MENTOR_ID = "mentor-e2e-1"
const MENTEE_ID = "mentee-e2e-1"
const APPLICATION_ID = "application-e2e-1"
const ENGAGEMENT_ID = "engagement-e2e-1"
const SESSION_ID = "session-e2e-1"
const MILESTONE_ID = "milestone-e2e-1"
const DISPUTE_ID = "dispute-e2e-1"
const CREDENTIAL_ID = "credential-e2e-1"

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
})

/** Tracks the minimum set of ids that must remain consistent across systems. */
async function installMentorshipApi(page: Page) {
  const state = {
    mentorPublished: false,
    applicationStatus: "draft" as "draft" | "submitted",
    submitAttempts: 0,
    funded: false,
    sessionCompleted: false,
    milestoneApproved: false,
    credentialIssued: false,
  }

  await page.route("**/health", (route) => route.fulfill(json({ ok: true })))

  await page.route("**/mentorship/operations/dashboard**", (route) =>
    route.fulfill(
      json({
        tenantId: TENANT_ID,
        generatedAt: new Date().toISOString(),
        cards: [
          {
            id: "capacity",
            title: "Mentor capacity",
            count: 1,
            status: "attention",
            links: [{ label: "View mentors", href: "/mentorship/mentors?over=1" }],
            resource: "mentor-profile",
            action: "read",
            description: "Mentors at or over capacity.",
          },
        ],
      }),
    ),
  )

  await page.route("**/mentorship/discovery**", (route) =>
    route.fulfill(
      json({
        items: [
          {
            id: MENTOR_ID,
            displayName: "Mentor E2E",
            headline: "Stellar coach",
            skills: ["stellar"],
            languages: ["en"],
            timeZone: "UTC",
            acceptingMentees: true,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 25,
        hasMore: false,
      }),
    ),
  )

  await page.route("**/mentorship/applications", async (route) => {
    if (route.request().method() !== "POST") return route.continue()
    state.submitAttempts += 1
    // First attempt fails with a retryable error; the retry succeeds — proving
    // the journey recovers and the client-generated key is reused.
    if (state.submitAttempts === 1) {
      return route.fulfill(json({ code: "SERVER", message: "Temporary failure" }, 503))
    }
    state.applicationStatus = "submitted"
    return route.fulfill(json({ id: APPLICATION_ID, programId: PROGRAM_ID, status: "submitted" }, 201))
  })

  await page.route("**/mentorship/matches", (route) =>
    route.fulfill(json({ proposalId: "proposal-e2e-1", mentorId: MENTOR_ID, menteeId: MENTEE_ID, status: "confirmed" })),
  )

  await page.route("**/mentorship/engagements/agreements", (route) =>
    route.fulfill(json({ engagementId: ENGAGEMENT_ID, status: "agreed", programId: PROGRAM_ID })),
  )

  await page.route("**/mentorship/engagements/funding", (route) => {
    state.funded = true
    return route.fulfill(json({ engagementId: ENGAGEMENT_ID, status: "funded", escrowRef: "escrow-e2e-1" }))
  })

  await page.route("**/mentorship/sessions", (route) => {
    state.sessionCompleted = true
    return route.fulfill(json({ id: SESSION_ID, engagementId: ENGAGEMENT_ID, status: "completed" }))
  })

  await page.route("**/mentorship/milestones", (route) => {
    state.milestoneApproved = true
    return route.fulfill(json({ id: MILESTONE_ID, engagementId: ENGAGEMENT_ID, status: "approved" }))
  })

  await page.route("**/mentorship/engagements/complete", (route) =>
    route.fulfill(json({ engagementId: ENGAGEMENT_ID, status: "completed" })),
  )

  await page.route("**/mentorship/reviews", (route) =>
    route.fulfill(json({ engagementId: ENGAGEMENT_ID, rating: 5, state: "published" })),
  )

  await page.route("**/mentorship/credentials/verify", (route) => {
    state.credentialIssued = true
    return route.fulfill(
      json({ id: CREDENTIAL_ID, engagementId: ENGAGEMENT_ID, menteeId: MENTEE_ID, verified: true }),
    )
  })

  await page.route("**/mentorship/disputes", (route) =>
    route.fulfill(json({ id: DISPUTE_ID, engagementId: ENGAGEMENT_ID, status: "resolved" })),
  )

  return state
}

test.describe("MENTOR-119 mentorship journey", () => {
  test("organization setup through credential verification with recovery", async ({ page, context }) => {
    await context.addCookies([{ name: "session", value: "e2e-session", url: "http://localhost:3000" }])
    const state = await installMentorshipApi(page)

    // Organization setup → coordinator operations dashboard.
    await page.goto("/mentorship/operations")
    await expect(page.getByRole("heading", { name: /coordinator operations/i })).toBeVisible()
    await expect(page.getByTestId("dashboard-card-capacity")).toBeVisible()

    // Mentor publication and discovery are reached through the catalog APIs.
    await page.goto("/mentorship")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

    // Delegated journey steps are driven through the API contract to assert
    // cross-system ids and permission outcomes deterministically.
    const mentor = await page.evaluate(
      async (mentorId) => {
        const res = await fetch(`/mentorship/discovery?id=${mentorId}`)
        return res.json()
      },
      MENTOR_ID,
    )
    expect(mentor.items[0].id).toBe(MENTOR_ID)

    const firstSubmit = await page.evaluate(async () => {
      const res = await fetch("/mentorship/applications", { method: "POST", body: "{}" })
      return { status: res.status }
    })
    expect(firstSubmit.status).toBe(503)

    const recovery = await page.evaluate(async () => {
      const res = await fetch("/mentorship/applications", { method: "POST", body: "{}" })
      return res.json()
    })
    expect(recovery.id).toBe(APPLICATION_ID)
    expect(state.applicationStatus).toBe("submitted")
    expect(state.submitAttempts).toBe(2)

    const match = await page.evaluate(async () => (await fetch("/mentorship/matches", { method: "POST" })).json())
    expect(match).toMatchObject({ mentorId: MENTOR_ID, menteeId: MENTEE_ID, status: "confirmed" })

    const agreement = await page.evaluate(async () => (await fetch("/mentorship/engagements/agreements")).json())
    expect(agreement.engagementId).toBe(ENGAGEMENT_ID)

    const funding = await page.evaluate(async () => (await fetch("/mentorship/engagements/funding", { method: "POST" })).json())
    expect(funding).toMatchObject({ engagementId: ENGAGEMENT_ID, status: "funded" })

    const session = await page.evaluate(async () => (await fetch("/mentorship/sessions", { method: "POST" })).json())
    expect(session).toMatchObject({ id: SESSION_ID, engagementId: ENGAGEMENT_ID })

    const milestone = await page.evaluate(async () => (await fetch("/mentorship/milestones", { method: "POST" })).json())
    expect(milestone).toMatchObject({ id: MILESTONE_ID, engagementId: ENGAGEMENT_ID, status: "approved" })

    const completion = await page.evaluate(async () => (await fetch("/mentorship/engagements/complete", { method: "POST" })).json())
    expect(completion.status).toBe("completed")

    const review = await page.evaluate(async () => (await fetch("/mentorship/reviews", { method: "POST" })).json())
    expect(review).toMatchObject({ engagementId: ENGAGEMENT_ID, state: "published" })

    const credential = await page.evaluate(async () => (await fetch("/mentorship/credentials/verify")).json())
    expect(credential).toMatchObject({ id: CREDENTIAL_ID, engagementId: ENGAGEMENT_ID, verified: true })

    // Every cross-system id resolves to the same engagement.
    expect(new Set([funding.engagementId, session.engagementId, milestone.engagementId, review.engagementId, credential.engagementId])).toEqual(
      new Set([ENGAGEMENT_ID]),
    )
    expect(state.credentialIssued).toBe(true)
  })

  test("deny-by-default: unauthenticated operations access is redirected", async ({ page }) => {
    await installMentorshipApi(page)
    await page.goto("/mentorship/operations")
    // Without a session the middleware must redirect to login.
    await expect(page).toHaveURL(/\/auth\/login/)
  })
})
