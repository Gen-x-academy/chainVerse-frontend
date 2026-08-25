"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

export type CitationStyle = "APA" | "MLA" | "Chicago" | "BibTeX" | "RIS"

interface CitationExportProps {
  citations: Partial<Record<CitationStyle, string>>
  className?: string
}

const STYLES: CitationStyle[] = ["APA", "MLA", "Chicago", "BibTeX", "RIS"]

/** Copy/download actions for a book or reading-list item's citation in each supported style. */
export function CitationExport({ citations, className }: CitationExportProps) {
  const [copied, setCopied] = useState<CitationStyle | null>(null)

  const handleCopy = async (style: CitationStyle, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(style)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {STYLES.map((style) => {
        const text = citations[style]
        return (
          <button
            key={style}
            type="button"
            disabled={!text}
            onClick={() => text && handleCopy(style, text)}
            aria-live="polite"
            className="rounded-md border px-2 py-1 text-xs disabled:opacity-40"
            title={text ? undefined : "Missing metadata for this style"}
          >
            {copied === style ? "Copied!" : style}
          </button>
        )
      })}
    </div>
  )
}
