import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy Policy | ChainVerse",
  description: "How ChainVerse collects, uses, and protects your information.",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="text-gray-600">
          ChainVerse uses your email address only for the purposes you consent to,
          such as newsletter updates about courses and learning tips. You can
          withdraw consent at any time.
        </p>
        <p className="text-gray-600">
          For newsletter preferences, visit{" "}
          <Link href="/unsubscribe" className="text-indigo-600 hover:underline">
            Unsubscribe
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
