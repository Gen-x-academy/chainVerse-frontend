/**
 * Single-flight token refresh for issue #826.
 * Every simultaneous 401 currently calls the refresh endpoint independently,
 * risking refresh-token rotation races. This ensures only one refresh
 * request is in flight and all callers await the same promise.
 */

type Refresher = () => Promise<boolean>;

let inFlight: Promise<boolean> | null = null;

export function singleFlightRefresh(refresher: Refresher): Promise<boolean> {
  if (!inFlight) {
    inFlight = refresher().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/** Test/debug helper to confirm no refresh is currently pending. */
export function isRefreshPending(): boolean {
  return inFlight !== null;
}
