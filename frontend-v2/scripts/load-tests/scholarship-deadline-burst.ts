/**
 * Scholarship deadline-burst load generator (issue #1224).
 *
 * OPERATIONAL TOOLING — NOT PART OF THE SHIPPOPED APPLICATION.
 *
 * This module used to live at `src/features/scholarships/load-testing.ts` and
 * was reachable from `ScholarshipLoadTestPanel`, a client component rendered by
 * `/scholarships/operations`. That put a load generator, its synthetic dataset
 * and its burst coordinator into the browser bundle of a production route, so
 * anyone who could load the page could fire synthetic deadline traffic at the
 * scholarship API.
 *
 * It now lives under `scripts/load-tests/`, which is outside the App Router
 * route graph and is therefore never bundled. `npm run lint` fails if anything
 * under `app/`, `src/`, `components/`, `hooks/`, `lib/`, `services/` or
 * `utils/` imports this file, and `scripts/check-no-production-imports.mjs`
 * enforces the same rule in CI.
 *
 * Run it with:
 *   npm run loadtest:deadline -- --base-url https://staging.example/api \
 *                               --token "$SCHOLARSHIP_LOAD_TEST_TOKEN" \
 *                               --tenant load-test-tenant-a
 *
 * @see ../docs/scholarships-load-testing.md
 */

import type {
  ScholarshipApplication,
  ScholarshipApplicationStatus,
} from "../../src/features/scholarships/types/scholarship.types";
import { isNonProductionHostname } from "../../src/features/scholarships/utils/stagingEnvironment";

export const SCHOLARSHIP_BURST_ACTIONS = [
  "search",
  "submit",
  "upload",
  "review",
  "notify",
  "decision",
  "payout",
] as const;

export type ScholarshipBurstAction = (typeof SCHOLARSHIP_BURST_ACTIONS)[number];

export interface ScholarshipLoadTarget {
  tenantId: string;
  deadline: string;
  applicants: number;
  applications: number;
  documents: number;
  reviewers: number;
  awards: number;
  burstRequestsPerSecond: number;
}

export const DEFAULT_SCHOLARSHIP_LOAD_TARGET: ScholarshipLoadTarget = {
  tenantId: "load-test-tenant-a",
  deadline: "2026-10-01T23:59:59.000Z",
  applicants: 10_000,
  applications: 12_000,
  documents: 24_000,
  reviewers: 250,
  awards: 1_500,
  burstRequestsPerSecond: 500,
};

export class ScholarshipBackpressureError extends Error {
  readonly code = "RESOURCE_SATURATED" as const;

  constructor(readonly retryAfterMs: number) {
    super(`Scholarship service is at capacity. Retry after ${retryAfterMs}ms.`);
    this.name = "ScholarshipBackpressureError";
  }
}

export class ScholarshipTenantBoundaryError extends Error {
  readonly code = "CROSS_TENANT_DENIED" as const;

  constructor() {
    super("The load-test operation belongs to a different tenant.");
    this.name = "ScholarshipTenantBoundaryError";
  }
}

/** Raised when the target environment refuses to accept load-test traffic. */
export class ScholarshipLoadTestAuthorizationError extends Error {
  readonly code = "LOAD_TEST_NOT_AUTHORIZED" as const;

  constructor(message: string) {
    super(message);
    this.name = "ScholarshipLoadTestAuthorizationError";
  }
}

export type BurstResult<T> =
  | { status: "accepted"; value: T }
  | { status: "duplicate"; value: T }
  | { status: "rejected"; error: ScholarshipBackpressureError };

/** Coordinates deadline bursts without crossing tenants or repeating keyed work. */
export class ScholarshipBurstCoordinator {
  private readonly completed = new Map<string, Promise<unknown>>();
  private inFlight = 0;

  constructor(
    private readonly tenantId: string,
    private readonly maxInFlight = 50,
    private readonly retryAfterMs = 250,
  ) {}

  get activeCount() {
    return this.inFlight;
  }

  run<T>(
    tenantId: string,
    idempotencyKey: string,
    task: () => Promise<T>,
  ): Promise<BurstResult<T>> {
    if (tenantId !== this.tenantId) throw new ScholarshipTenantBoundaryError();

    const existing = this.completed.get(idempotencyKey) as
      | Promise<BurstResult<T>>
      | undefined;
    if (existing)
      return existing.then((result) => ({
        ...result,
        status: "duplicate" as const,
      }));

    if (this.inFlight >= this.maxInFlight) {
      return Promise.resolve({
        status: "rejected",
        error: new ScholarshipBackpressureError(this.retryAfterMs),
      });
    }

    this.inFlight += 1;
    const operation = task()
      .then((value): BurstResult<T> => ({ status: "accepted", value }))
      .finally(() => {
        this.inFlight -= 1;
      });
    this.completed.set(idempotencyKey, operation);
    return operation;
  }
}

export interface ScholarshipDeadlineSearchParams {
  tenantId: string;
  query?: string;
  roundId?: string;
  status?: ScholarshipApplicationStatus;
  page?: number;
  pageSize?: number;
}

export interface ScholarshipDeadlineSearchResult {
  items: ScholarshipApplication[];
  total: number;
  deadline: string;
}

export interface ScholarshipLoadTestConfig {
  baseUrl: string;
  token: string;
  tenantId: string;
  requests: number;
  concurrency: number;
}

/**
 * Load testing is only ever permitted against a non-production, authenticated
 * environment. Refusing production up front keeps a mis-typed `--base-url` from
 * becoming an outage.
 *
 * The hostname rule is the same predicate the browser gate in
 * `src/features/scholarships/utils/stagingEnvironment.ts` uses, so the CLI and
 * the UI cannot disagree about what counts as production.
 */
export function assertNonProductionTarget(baseUrl: string): void {
  let hostname: string;
  try {
    hostname = new URL(baseUrl).hostname;
  } catch {
    throw new ScholarshipLoadTestAuthorizationError(
      `--base-url must be an absolute URL, received "${baseUrl}".`,
    );
  }

  if (!isNonProductionHostname(hostname)) {
    throw new ScholarshipLoadTestAuthorizationError(
      `Refusing to generate load against "${hostname}". Point --base-url at a staging or test environment.`,
    );
  }
}

export interface ScholarshipBurstRunSummary {
  accepted: number;
  duplicates: number;
  rejected: number;
}

/**
 * Executes `config.requests` keyed search operations against the configured
 * environment. Every request carries the operator's bearer token, so a target
 * that has load testing disabled simply rejects them.
 */
export async function runDeadlineBurst(
  config: ScholarshipLoadTestConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<ScholarshipBurstRunSummary> {
  assertNonProductionTarget(config.baseUrl);

  const coordinator = new ScholarshipBurstCoordinator(
    config.tenantId,
    Math.max(1, config.concurrency),
  );

  const summary: ScholarshipBurstRunSummary = { accepted: 0, duplicates: 0, rejected: 0 };

  for (let index = 0; index < config.requests; index += 1) {
    const result = await coordinator.run(
      config.tenantId,
      `deadline-probe-${index}`,
      async () => {
        const response = await fetchImpl(
          `${config.baseUrl.replace(/\/$/, "")}/scholarships/applications?tenantId=${encodeURIComponent(config.tenantId)}&page=${index + 1}`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${config.token}`,
            },
          },
        );

        if (response.status === 401 || response.status === 403) {
          throw new ScholarshipLoadTestAuthorizationError(
            `The scholarship API rejected the load-test token (HTTP ${response.status}).`,
          );
        }
        if (response.status === 429) {
          throw new ScholarshipBackpressureError(
            Number(response.headers.get("retry-after") ?? 250) * 1000,
          );
        }
        if (!response.ok) {
          throw new Error(`Load-test request failed with HTTP ${response.status}.`);
        }

        return (await response.json()) as ScholarshipDeadlineSearchResult;
      },
    );

    if (result.status === "accepted") summary.accepted += 1;
    else if (result.status === "duplicate") summary.duplicates += 1;
    else summary.rejected += 1;
  }

  return summary;
}

/** Minimal argument parser so the tool has no runtime dependency. */
export function parseLoadTestArgs(argv: readonly string[]): ScholarshipLoadTestConfig {
  const read = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    if (index === -1) return undefined;
    const value = argv[index + 1];
    return value && !value.startsWith("--") ? value : undefined;
  };

  const baseUrl = read("--base-url") ?? process.env.SCHOLARSHIP_LOAD_TEST_BASE_URL ?? "";
  const token = read("--token") ?? process.env.SCHOLARSHIP_LOAD_TEST_TOKEN ?? "";
  const tenantId =
    read("--tenant") ?? DEFAULT_SCHOLARSHIP_LOAD_TARGET.tenantId;
  const requests = Number(read("--requests") ?? 50);
  const concurrency = Number(read("--concurrency") ?? 5);

  if (!baseUrl) {
    throw new ScholarshipLoadTestAuthorizationError(
      "--base-url (or SCHOLARSHIP_LOAD_TEST_BASE_URL) is required.",
    );
  }
  if (!token) {
    throw new ScholarshipLoadTestAuthorizationError(
      "--token (or SCHOLARSHIP_LOAD_TEST_TOKEN) is required.",
    );
  }
  if (!Number.isInteger(requests) || requests <= 0) {
    throw new Error("--requests must be a positive integer.");
  }
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    throw new Error("--concurrency must be a positive integer.");
  }

  // Fail before any request is issued rather than on the first fetch.
  assertNonProductionTarget(baseUrl);

  return { baseUrl, token, tenantId, requests, concurrency };
}

/* c8 ignore start -- CLI wiring */
if (process.argv[1]?.endsWith("scholarship-deadline-burst.ts")) {
  const config = parseLoadTestArgs(process.argv.slice(2));
  runDeadlineBurst(config)
    .then((summary) => {
      process.stdout.write(
        `accepted=${summary.accepted} duplicates=${summary.duplicates} rejected=${summary.rejected}\n`,
      );
    })
    .catch((error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : "Load test failed."}\n`,
      );
      process.exitCode = 1;
    });
}
/* c8 ignore stop */
