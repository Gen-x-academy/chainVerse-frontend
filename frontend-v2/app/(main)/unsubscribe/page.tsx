import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Unsubscribe | ChainVerse",
  description: "Stop receiving ChainVerse marketing emails.",
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Unsubscribe</h1>
        <p className="text-gray-600">
          To stop marketing emails, use the unsubscribe link in any ChainVerse
          newsletter message. That link confirms your request and updates our
          records.
        </p>
        <p className="text-gray-600">
          Questions about how we handle your data? Read our{" "}
          <Link href="/privacy" className="text-indigo-600 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
        <Link href="/" className="inline-block text-indigo-600 hover:underline text-sm">
          ← Back to home
        </Link>
      </div>
    </div>
  )
}
