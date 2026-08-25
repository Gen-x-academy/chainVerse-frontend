"use client"

import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"

export interface AudiobookPlayerProps {
  itemId: string
  audioUrl: string
}

const storageKey = (itemId: string) => `audiobook-position:${itemId}`

/**
 * #980: Basic audiobook player that remembers and resumes the patron's
 * last playback position for a given item, using localStorage.
 */
export function AudiobookPlayer({ itemId, audioUrl }: AudiobookPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const saved = Number(localStorage.getItem(storageKey(itemId)) ?? 0)
    if (saved > 0) audio.currentTime = saved

    const savePosition = () => {
      localStorage.setItem(storageKey(itemId), String(audio.currentTime))
    }
    audio.addEventListener("timeupdate", savePosition)
    audio.addEventListener("pause", savePosition)
    return () => {
      audio.removeEventListener("timeupdate", savePosition)
      audio.removeEventListener("pause", savePosition)
    }
  }, [itemId])

  return (
    <div className="flex flex-col gap-2">
      <audio ref={audioRef} src={audioUrl} controls className="w-full" />
      <Button
        variant="outline"
        onClick={() => {
          localStorage.removeItem(storageKey(itemId))
          if (audioRef.current) audioRef.current.currentTime = 0
        }}
      >
        Restart from beginning
      </Button>
    </div>
  )
}
