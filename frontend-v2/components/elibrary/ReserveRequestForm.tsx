"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface ReserveRequestFormProps {
  itemTitle: string
  coursePeriod: string
  onSubmit: (note: string) => Promise<void> | void
  className?: string
}

/** Simple librarian/tutor workflow for requesting a shortened-loan reserve copy. */
export function ReserveRequestForm({
  itemTitle,
  coursePeriod,
  onSubmit,
  className,
}: ReserveRequestFormProps) {
  const [note, setNote] = useState("")
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle")

  const handleSubmit = async () => {
    setStatus("submitting")
    try {
      await onSubmit(note)
      setStatus("done")
    } catch {
      setStatus("error")
    }
  }

  return (
    <form
      className={cn("flex flex-col gap-2 rounded-lg border p-4", className)}
      onSubmit={(e) => {
        e.preventDefault()
        handleSubmit()
      }}
    >
      <p className="text-sm font-medium">
        Reserve &quot;{itemTitle}&quot; for {coursePeriod}
      </p>
      <textarea
        className="rounded-md border p-2 text-sm"
        placeholder="Reason for reserve request"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button
        type="submit"
        disabled={status === "submitting"}
        className="self-start rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
      >
        {status === "submitting" ? "Submitting…" : "Request reserve"}
      </button>
      {status === "done" && <p className="text-xs text-green-600">Request submitted.</p>}
      {status === "error" && <p className="text-xs text-red-600">Something went wrong.</p>}
    </form>
  )
}
