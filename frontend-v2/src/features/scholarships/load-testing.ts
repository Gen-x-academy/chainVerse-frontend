import type {
  ScholarshipApplication,
  ScholarshipApplicationStatus,
} from "./types/scholarship.types";

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
