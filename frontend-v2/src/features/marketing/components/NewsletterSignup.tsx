"use client"

import React, { useState } from "react"
import Link from "next/link"
import {
  NewsletterSubscribeError,
  getPrivacyPolicyHref,
  getUnsubscribeHref,
  subscribeToNewsletter,
} from "@/src/features/marketing/services/newsletter.service"

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string; code?: string }

export function NewsletterSignup() {
  const [email, setEmail] = useState("")
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: "idle" })

  const privacyHref = getPrivacyPolicyHref()
  const unsubscribeHref = getUnsubscribeHref()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus({ kind: "loading" })

    try {
      const result = await subscribeToNewsletter({ email, consent })
      setStatus({ kind: "success", message: result.message })
      setEmail("")
      setConsent(false)
    } catch (err) {
      if (err instanceof NewsletterSubscribeError) {
        setStatus({ kind: "error", message: err.message, code: err.code })
        return
      }
      setStatus({
        kind: "error",
        message: "Something went wrong. Please try again.",
        code: "unknown",
      })
    }
  }

  if (status.kind === "success") {
    return (
      <div
        className="bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-lg p-6 border border-gray-800"
        role="status"
        aria-live="polite"
        data-testid="newsletter-success"
      >
        <h3 className="font-semibold text-white mb-2">You&apos;re subscribed</h3>
        <p className="text-gray-300 text-sm mb-3">{status.message}</p>
        <p className="text-gray-400 text-xs">
          You can{" "}
          <Link
            href={unsubscribeHref}
            className="text-indigo-300 hover:text-indigo-200 underline"
          >
            unsubscribe
          </Link>{" "}
          anytime. Read our{" "}
          <Link
            href={privacyHref}
            className="text-indigo-300 hover:text-indigo-200 underline"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-lg p-6 border border-gray-800">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        noValidate
        data-testid="newsletter-form"
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h3 className="font-semibold text-white mb-2">
              Subscribe to our newsletter
            </h3>
            <p className="text-gray-400 text-sm">
              Get the latest courses and learning tips delivered to your inbox.
            </p>
          </div>
          <div className="flex w-full md:w-auto gap-2">
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              disabled={status.kind === "loading"}
              aria-invalid={status.kind === "error"}
              aria-describedby={
                status.kind === "error" ? "newsletter-error" : "newsletter-consent-hint"
              }
              className="flex-1 md:flex-none px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus-ring disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={status.kind === "loading"}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {status.kind === "loading" ? "Subscribing…" : "Subscribe"}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={status.kind === "loading"}
              className="mt-1 rounded border-gray-600 bg-gray-800 text-indigo-600 focus-ring"
              data-testid="newsletter-consent"
            />
            <span id="newsletter-consent-hint">
              I agree to receive marketing emails from ChainVerse. See our{" "}
              <Link
                href={privacyHref}
                className="text-indigo-300 hover:text-indigo-200 underline"
              >
                Privacy Policy
              </Link>
              . You can{" "}
              <Link
                href={unsubscribeHref}
                className="text-indigo-300 hover:text-indigo-200 underline"
              >
                unsubscribe
              </Link>{" "}
              at any time.
            </span>
          </label>

          {status.kind === "error" && (
            <p
              id="newsletter-error"
              role="alert"
              className="text-sm text-red-400"
              data-testid="newsletter-error"
              data-error-code={status.code}
            >
              {status.message}
            </p>
          )}
        </div>
      </form>
    </div>
  )
}
