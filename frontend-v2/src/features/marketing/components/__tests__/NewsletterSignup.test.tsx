import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NewsletterSignup } from "../NewsletterSignup"
import * as newsletterService from "@/src/features/marketing/services/newsletter.service"

vi.mock("@/src/features/marketing/services/newsletter.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/src/features/marketing/services/newsletter.service")
  >("@/src/features/marketing/services/newsletter.service")
  return {
    ...actual,
    subscribeToNewsletter: vi.fn(),
    getPrivacyPolicyHref: () => "/privacy",
    getUnsubscribeHref: () => "/unsubscribe",
  }
})

describe("NewsletterSignup", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("requires consent and validates before calling subscribe", async () => {
    const user = userEvent.setup()
    vi.mocked(newsletterService.subscribeToNewsletter).mockRejectedValueOnce(
      new newsletterService.NewsletterSubscribeError(
        "Please agree to receive marketing emails before subscribing.",
        400,
        "consent"
      )
    )

    render(<NewsletterSignup />)

    await user.type(screen.getByLabelText(/email address/i), "user@example.com")
    await user.click(screen.getByRole("button", { name: /subscribe/i }))

    await waitFor(() => {
      expect(screen.getByTestId("newsletter-error")).toHaveTextContent(/agree/i)
    })
    expect(screen.getByTestId("newsletter-error")).toHaveAttribute(
      "data-error-code",
      "consent"
    )
  })

  it("shows success state with unsubscribe and privacy links", async () => {
    const user = userEvent.setup()
    vi.mocked(newsletterService.subscribeToNewsletter).mockResolvedValueOnce({
      ok: true,
      message: "You're subscribed! Check your inbox for a confirmation.",
    })

    render(<NewsletterSignup />)

    await user.type(screen.getByLabelText(/email address/i), "user@example.com")
    await user.click(screen.getByTestId("newsletter-consent"))
    await user.click(screen.getByRole("button", { name: /subscribe/i }))

    await waitFor(() => {
      expect(screen.getByTestId("newsletter-success")).toBeInTheDocument()
    })
    expect(screen.getByRole("link", { name: /unsubscribe/i })).toHaveAttribute(
      "href",
      "/unsubscribe"
    )
    expect(screen.getByRole("link", { name: /privacy policy/i })).toHaveAttribute(
      "href",
      "/privacy"
    )
  })

  it("surfaces duplicate subscription errors", async () => {
    const user = userEvent.setup()
    vi.mocked(newsletterService.subscribeToNewsletter).mockRejectedValueOnce(
      new newsletterService.NewsletterSubscribeError(
        "This email is already subscribed.",
        409,
        "duplicate"
      )
    )

    render(<NewsletterSignup />)

    await user.type(screen.getByLabelText(/email address/i), "dup@example.com")
    await user.click(screen.getByTestId("newsletter-consent"))
    await user.click(screen.getByRole("button", { name: /subscribe/i }))

    await waitFor(() => {
      expect(screen.getByTestId("newsletter-error")).toHaveAttribute(
        "data-error-code",
        "duplicate"
      )
    })
  })

  it("surfaces rate-limit errors", async () => {
    const user = userEvent.setup()
    vi.mocked(newsletterService.subscribeToNewsletter).mockRejectedValueOnce(
      new newsletterService.NewsletterSubscribeError(
        "Too many requests. Please try again later.",
        429,
        "rate_limit"
      )
    )

    render(<NewsletterSignup />)

    await user.type(screen.getByLabelText(/email address/i), "user@example.com")
    await user.click(screen.getByTestId("newsletter-consent"))
    await user.click(screen.getByRole("button", { name: /subscribe/i }))

    await waitFor(() => {
      expect(screen.getByTestId("newsletter-error")).toHaveAttribute(
        "data-error-code",
        "rate_limit"
      )
    })
  })

  it("links to privacy and unsubscribe on the form", () => {
    render(<NewsletterSignup />)
    const privacyLinks = screen.getAllByRole("link", { name: /privacy policy/i })
    const unsubLinks = screen.getAllByRole("link", { name: /unsubscribe/i })
    expect(privacyLinks[0]).toHaveAttribute("href", "/privacy")
    expect(unsubLinks[0]).toHaveAttribute("href", "/unsubscribe")
  })
})
