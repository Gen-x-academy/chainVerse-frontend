import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useCancellableTimeout } from "../useCancellableTimeout"

describe("useCancellableTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("runs the callback after the delay", () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useCancellableTimeout())

    act(() => {
      result.current.schedule(callback, 1500)
    })

    act(() => {
      vi.advanceTimersByTime(1499)
    })
    expect(callback).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it("replaces a prior timer when schedule is called again", () => {
    const first = vi.fn()
    const second = vi.fn()
    const { result } = renderHook(() => useCancellableTimeout())

    act(() => {
      result.current.schedule(first, 1500)
    })
    act(() => {
      vi.advanceTimersByTime(500)
    })
    act(() => {
      result.current.schedule(second, 1500)
    })
    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it("cancels a pending navigation callback on unmount (race)", () => {
    const navigate = vi.fn()
    const { result, unmount } = renderHook(() => useCancellableTimeout())

    act(() => {
      result.current.schedule(() => {
        navigate("/instructors/dashboard")
      }, 1500)
    })

    unmount()

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(navigate).not.toHaveBeenCalled()
  })

  it("cancels a pending status-reset callback on unmount", () => {
    const setStatus = vi.fn()
    const { result, unmount } = renderHook(() => useCancellableTimeout())

    act(() => {
      result.current.schedule(() => setStatus("idle"), 3000)
    })

    unmount()

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(setStatus).not.toHaveBeenCalled()
  })

  it("clear() cancels a pending timer without unmounting", () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useCancellableTimeout())

    act(() => {
      result.current.schedule(callback, 1000)
    })
    act(() => {
      result.current.clear()
    })
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(callback).not.toHaveBeenCalled()
  })
})
