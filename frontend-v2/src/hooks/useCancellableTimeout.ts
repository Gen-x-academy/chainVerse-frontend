import { useCallback, useEffect, useRef } from "react"

/**
 * Schedules a delayed callback that is cleared on unmount.
 * Calling `schedule` again replaces any pending timer (no stacking).
 * Use for status resets and post-success redirects that must not fire after unmount.
 */
export function useCancellableTimeout() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const schedule = useCallback(
    (fn: () => void, delayMs: number) => {
      clear()
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        fn()
      }, delayMs)
    },
    [clear]
  )

  useEffect(() => clear, [clear])

  return { schedule, clear }
}
