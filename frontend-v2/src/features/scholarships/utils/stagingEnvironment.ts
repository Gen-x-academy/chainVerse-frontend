/**
 * Non-production gating for scholarships test tooling (issue #1224).
 * Non-production gating for scholarships test tooling (issue #1220).
 *
 * The synthetic seed flow under `/scholarships/staging` generates load-equivalent
 * records. It used to be reachable by anyone who could load the page, and the
 * deadline-burst generator it sat next to shipped in the browser bundle of a
 * production route.
 *
 * Two independent gates now apply, and both are required:
 *
 * 1. **Explicit opt-in.** The build must set `NEXT_PUBLIC_SCHOLARSHIPS_STAGING=1`.
 *    Absent, falsy, or set to a production-ish value, the page renders a
 *    not-available notice instead of the controls. Deployments therefore have to
 *    turn the tooling on deliberately instead of inheriting it.
 * 2. **Non-production API.** When `NEXT_PUBLIC_API_BASE_URL` is set, its hostname
 *    must look like a local, staging, or test host. A production API origin
 *    disables the tooling even if the flag is on, so a mis-configured staging
 *    deployment cannot seed production.
 *
 * `assertNonProductionTarget` in `scripts/load-tests/scholarship-deadline-burst.ts`
 * applies the same hostname rule on the operator CLI, so the browser gate and
 * the command-line gate cannot drift apart.
 *
 * This is a UX boundary only. The API must refuse the seed endpoints on its own;
 * see ADR-001: Privacy boundaries.
 */

/** Build-time opt-in flag. Only the literal `1`/`true` enables the tooling. */
export const SCHOLARSHIPS_STAGING_FLAG = "NEXT_PUBLIC_SCHOLARSHIPS_STAGING" as const;

const TRUTHY = new Set(["1", "true", "yes", "on"]);

const NON_PRODUCTION_HOSTNAME =
  /(^|[.\-])(staging|stage|preprod|pre-prod|test|testing|testnet|local|dev|sandbox|localhost|127)([.\-]|$)/;

export function isTruthyFlag(value: string | undefined | null): boolean {
  return typeof value === "string" && TRUTHY.has(value.trim().toLowerCase());
}

/** True when the hostname is local, staging, or testnet. Empty host is unknown. */
export function isNonProductionHostname(hostname: string | undefined | null): boolean {
  if (!hostname) return false;
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "::1" || host === "0.0.0.0") return true;
  return NON_PRODUCTION_HOSTNAME.test(host);
/** True when the hostname is local, staging, or testnet. Empty host is unknown. */
function isNonProductionHostname(hostname: string): boolean {
  if (!hostname) return false;
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "::1" || host === "0.0.0.0") return true;
  return /(^|\.)(staging|stage|preprod|pre-prod|test|testing|testnet|local|dev|sandbox)(\.|$)/.test(host);
}

/**
 * Extracts the hostname from an API base URL. Returns `undefined` when the URL
 * is absent or unparseable so callers can distinguish "unset" from "production".
 */
export function readApiHostname(
  baseUrl: string | undefined | null,
): string | undefined {
function readApiHostname(baseUrl: string | undefined | null): string | undefined {
  if (!baseUrl) return undefined;
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return undefined;
  }
}

export type StagingToolingAvailability = {
  available: boolean;
  reason: string;
};

/**
 * Decides whether the synthetic seed / test tooling may render. Kept pure so it
 * can be asserted directly in unit tests.
 */
export function resolveStagingToolingAvailability(env: {
  flag?: string;
  apiBaseUrl?: string;
}): StagingToolingAvailability {
}): { available: boolean; reason: string } {
  if (!isTruthyFlag(env.flag)) {
    return {
      available: false,
      reason: `Scholarship staging tooling is disabled. Set ${SCHOLARSHIPS_STAGING_FLAG}=1 in this build to enable it.`,
    };
  }

  const hostname = readApiHostname(env.apiBaseUrl);
  if (hostname && !isNonProductionHostname(hostname)) {
    return {
      available: false,
      reason: `Scholarship staging tooling is disabled because this build points at "${hostname}". Point it at a staging or test API.`,
    };
  }

  return { available: true, reason: "Scholarship staging tooling is enabled for this build." };
}

/** Browser-bound convenience wrapper over {@link resolveStagingToolingAvailability}. */
export function getStagingToolingAvailability(): StagingToolingAvailability {
export function getStagingToolingAvailability(): { available: boolean; reason: string } {
  return resolveStagingToolingAvailability({
    flag: process.env.NEXT_PUBLIC_SCHOLARSHIPS_STAGING,
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  });
}

/** True only for the documented opt-in values. */
function isTruthyFlag(value: string | undefined | null): boolean {
  return typeof value === "string" && TRUTHY.has(value.trim().toLowerCase());
}
