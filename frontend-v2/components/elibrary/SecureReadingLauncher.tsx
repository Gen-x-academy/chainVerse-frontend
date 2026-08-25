"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export interface SecureReadingLauncherProps {
  itemId: string
  fetchSecureReadUrl: (itemId: string) => Promise<string>
}

/**
 * #978: Requests a short-lived, signed reading URL for a licensed item
 * before opening the reader, instead of linking to the file directly.
 */
export function SecureReadingLauncher({
  itemId,
  fetchSecureReadUrl,
}: SecureReadingLauncherProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")

  const handleLaunch = async () => {
    setStatus("loading")
    try {
      const url = await fetchSecureReadUrl(itemId)
      window.open(url, "_blank", "noopener,noreferrer")
      setStatus("idle")
    } catch {
      setStatus("error")
    }
  }

  return (
    <div>
      <Button onClick={handleLaunch} disabled={status === "loading"}>
        {status === "loading" ? "Preparing reader..." : "Start Reading"}
      </Button>
      {status === "error" && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          Couldn&apos;t start a secure reading session. Please try again.
        </p>
      )}
    </div>
  )
}
