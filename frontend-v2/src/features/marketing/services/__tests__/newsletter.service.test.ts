import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  CLIENT_THROTTLE_MS,
  CLIENT_THROTTLE_STORAGE_KEY,
  NewsletterSubscribeError,
  assertClientThrottle,
  assertMarketingConsent,
  markClientSubmit,
  subscribeToNewsletter,
  validateNewsletterEmail,
} from "../newsletter.service"

function memoryStorage(initial: Record<string, string> = {}) {
  const store = { ...initial }
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    _store: store,
  }
}

describe("newsletter.service", () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_BASE_URL

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:3001/api/v1"
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = originalEnv
    vi.restoreAllMocks()
  })

  describe("validation & consent", () => {
    it("rejects empty and invalid emails", () => {
      expect(() => validateNewsletterEmail("")).toThrow(NewsletterSubscribeError)
      expect(() => validateNewsletterEmail("not-an-email")).toThrow(
        /valid email/i
      )
    })

    it("accepts a trimmed valid email", () => {
      expect(validateNewsletterEmail("  user@example.com ")).toBe(
        "user@example.com"
      )
    })

    it("requires explicit marketing consent", () => {
      expect(() => assertMarketingConsent(false)).toThrow(/agree/i)
      expect(() => assertMarketingConsent(true)).not.toThrow()
    })
  })

  describe("client throttle", () => {
    it("blocks rapid resubmits", () => {
      const storage = memoryStorage({
        [CLIENT_THROTTLE_STORAGE_KEY]: String(Date.now()),
      })
      expect(() => assertClientThrottle(storage, Date.now())).toThrow(
        NewsletterSubscribeError
      )
      try {
        assertClientThrottle(storage, Date.now())
      } catch (err) {
        expect(err).toMatchObject({ code: "rate_limit", status: 429 })
      }
    })

    it("allows submit after the throttle window", () => {
      const now = Date.now()
      const storage = memoryStorage({
        [CLIENT_THROTTLE_STORAGE_KEY]: String(now - CLIENT_THROTTLE_MS - 1),
      })
      expect(() => assertClientThrottle(storage, now)).not.toThrow()
      markClientSubmit(storage, now)
      expect(storage.getItem(CLIENT_THROTTLE_STORAGE_KEY)).toBe(String(now))
    })
  })

  describe("subscribeToNewsletter", () => {
    it("posts consent payload and returns success", async () => {
      const storage = memoryStorage()
      const fetchImpl = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: "Subscribed" }),
        text: async () => "",
      })

      const result = await subscribeToNewsletter({
        email: "user@example.com",
        consent: true,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        storage,
        now: 1_700_000_000_000,
      })

      expect(result).toEqual({ ok: true, message: "Subscribed" })
      expect(fetchImpl).toHaveBeenCalledWith(
        "http://localhost:3001/api/v1/newsletter/subscribe",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            email: "user@example.com",
            consent: true,
            consentedAt: new Date(1_700_000_000_000).toISOString(),
            source: "footer",
          }),
        })
      )
    })

    it("maps 409 to duplicate", async () => {
      const fetchImpl = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        text: async () => "already subscribed",
        json: async () => ({}),
      })

      await expect(
        subscribeToNewsletter({
          email: "user@example.com",
          consent: true,
          fetchImpl: fetchImpl as unknown as typeof fetch,
          storage: memoryStorage(),
        })
      ).rejects.toMatchObject({ code: "duplicate", status: 409 })
    })

    it("maps 429 to rate_limit", async () => {
      const fetchImpl = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "slow down",
        json: async () => ({}),
      })

      await expect(
        subscribeToNewsletter({
          email: "user@example.com",
          consent: true,
          fetchImpl: fetchImpl as unknown as typeof fetch,
          storage: memoryStorage(),
        })
      ).rejects.toMatchObject({ code: "rate_limit", status: 429 })
    })

    it("does not call the API when consent is missing", async () => {
      const fetchImpl = vi.fn()
      await expect(
        subscribeToNewsletter({
          email: "user@example.com",
          consent: false,
          fetchImpl: fetchImpl as unknown as typeof fetch,
          storage: memoryStorage(),
        })
      ).rejects.toMatchObject({ code: "consent" })
      expect(fetchImpl).not.toHaveBeenCalled()
    })
  })
})
