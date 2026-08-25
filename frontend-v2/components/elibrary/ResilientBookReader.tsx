"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export interface ResilientBookReaderProps {
  fileUrl: string
  format: "epub" | "pdf"
}

/**
 * #979: Wraps EPUB/PDF rendering with a visible loading/error state and a
 * manual retry, so a slow or failed load doesn't strand the reader on a
 * blank screen.
 */
export function ResilientBookReader({
  fileUrl,
  format,
}: ResilientBookReaderProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  )
  const [attempt, setAttempt] = useState(0)

  return (
    <div className="relative min-h-[480px] w-full">
      {status !== "ready" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          {status === "loading" && <p>Loading {format.toUpperCase()}...</p>}
          {status === "error" && (
            <>
              <p role="alert" className="text-destructive">
                Couldn&apos;t load this {format.toUpperCase()} file.
              </p>
              <Button onClick={() => setAttempt((a) => a + 1)}>Retry</Button>
            </>
          )}
        </div>
      )}
      <iframe
        key={attempt}
        src={fileUrl}
        title="Book reader"
        className="h-full min-h-[480px] w-full border-0"
        onLoad={() => setStatus("ready")}
        onError={() => setStatus("error")}
      />
    </div>
  )
}
