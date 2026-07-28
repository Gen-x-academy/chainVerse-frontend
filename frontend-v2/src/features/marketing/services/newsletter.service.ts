import { z } from "zod"

export const newsletterEmailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email address")

export type NewsletterSubscribePayload = {
  email: string
  /** Explicit marketing consent — must be true to subscribe. */
  consent: true
  consentedAt: string
  source: "footer"
}

export type NewsletterErrorCode =
  | "validation"
  | "consent"
  | "duplicate"
  | "rate_limit"
  | "unknown"

export class NewsletterSubscribeError extends Error {
  readonly status: number
  readonly code: NewsletterErrorCode

  constructor(message: string, status: number, code: NewsletterErrorCode) {
    super(message)
    this.name = "NewsletterSubscribeError"
    this.status = status
    this.code = code
  }
}

export const CLIENT_THROTTLE_MS = 30_000
export const CLIENT_THROTTLE_STORAGE_KEY = "chainverse:newsletter:lastSubmitAt"

export function getPrivacyPolicyHref(): string {
  const raw = process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL?.trim()
  if (raw && raw !== "#" && !raw.startsWith("#")) return raw
  return "/privacy"
}

export function getUnsubscribeHref(): string {
  const raw = process.env.NEXT_PUBLIC_NEWSLETTER_UNSUBSCRIBE_URL?.trim()
  if (raw && raw !== "#" && !raw.startsWith("#")) return raw
  return "/unsubscribe"
}

export function validateNewsletterEmail(email: string): string {
  const result = newsletterEmailSchema.safeParse(email)
  if (!result.success) {
    throw new NewsletterSubscribeError(
      result.error.issues[0]?.message ?? "Invalid email",
      400,
      "validation"
    )
  }
  return result.data
}

export function assertMarketingConsent(consent: boolean): asserts consent is true {
  if (!consent) {
    throw new NewsletterSubscribeError(
      "Please agree to receive marketing emails before subscribing.",
      400,
      "consent"
    )
  }
}

/** Client-side abuse protection — blocks rapid resubmits in this browser tab. */
export function assertClientThrottle(
  storage: Pick<Storage, "getItem"> = sessionStorage,
  now = Date.now()
): void {
  const last = Number(storage.getItem(CLIENT_THROTTLE_STORAGE_KEY) || "0")
  if (last > 0 && now - last < CLIENT_THROTTLE_MS) {
    const waitSec = Math.ceil((CLIENT_THROTTLE_MS - (now - last)) / 1000)
    throw new NewsletterSubscribeError(
      `Too many attempts. Please wait ${waitSec}s before trying again.`,
      429,
      "rate_limit"
    )
  }
}

export function markClientSubmit(
  storage: Pick<Storage, "setItem"> = sessionStorage,
  now = Date.now()
): void {
  storage.setItem(CLIENT_THROTTLE_STORAGE_KEY, String(now))
}

function mapStatusToError(status: number, bodyText: string): NewsletterSubscribeError {
  if (status === 409) {
    return new NewsletterSubscribeError(
      "This email is already subscribed.",
      409,
      "duplicate"
    )
  }
  if (status === 429) {
    return new NewsletterSubscribeError(
      "Too many requests. Please try again later.",
      429,
      "rate_limit"
    )
  }
  if (status === 400) {
    return new NewsletterSubscribeError(
      bodyText || "Unable to subscribe with that email.",
      400,
      "validation"
    )
  }
  return new NewsletterSubscribeError(
    bodyText || `Subscription failed (${status}).`,
    status,
    "unknown"
  )
}

/**
 * Validates input, records explicit consent in the payload, enforces client
 * throttling, and posts to the newsletter API.
 */
export async function subscribeToNewsletter(input: {
  email: string
  consent: boolean
  fetchImpl?: typeof fetch
  storage?: Pick<Storage, "getItem" | "setItem">
  now?: number
}): Promise<{ ok: true; message: string }> {
  const email = validateNewsletterEmail(input.email)
  assertMarketingConsent(input.consent)

  const storage = input.storage ?? sessionStorage
  const now = input.now ?? Date.now()
  assertClientThrottle(storage, now)

  const payload: NewsletterSubscribePayload = {
    email,
    consent: true,
    consentedAt: new Date(now).toISOString(),
    source: "footer",
  }

  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
  if (!base) {
    throw new NewsletterSubscribeError(
      "Newsletter service is not configured.",
      500,
      "unknown"
    )
  }

  const fetchImpl = input.fetchImpl ?? fetch
  const response = await fetchImpl(`${base}/newsletter/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "")
    throw mapStatusToError(response.status, bodyText)
  }

  markClientSubmit(storage, now)

  let message = "You're subscribed! Check your inbox for a confirmation."
  try {
    const data = (await response.json()) as { message?: string }
    if (data.message) message = data.message
  } catch {
    // non-JSON success body is fine
  }

  return { ok: true, message }
}
