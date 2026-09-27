import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ScholarshipBackpressureError,
  ScholarshipBurstCoordinator,
  ScholarshipLoadTestAuthorizationError,
  ScholarshipTenantBoundaryError,
  assertNonProductionTarget,
  parseLoadTestArgs,
  runDeadlineBurst,
} from "../scholarship-deadline-burst";

describe("scholarship deadline burst coordinator", () => {
  it("accepts work once and returns the same result for a duplicate key", async () => {
    const coordinator = new ScholarshipBurstCoordinator("tenant-a", 2);
    const task = vi.fn(async () => "application-1");

    const first = await coordinator.run("tenant-a", "submit-1", task);
    const retry = await coordinator.run("tenant-a", "submit-1", task);

    expect(first).toEqual({ status: "accepted", value: "application-1" });
    expect(retry).toEqual({ status: "duplicate", value: "application-1" });
    expect(task).toHaveBeenCalledOnce();
  });

  it("rejects saturated work without invoking the task", async () => {
    let release!: () => void;
    const blocked = new Promise<string>((resolve) => {
      release = () => resolve("done");
    });
    const coordinator = new ScholarshipBurstCoordinator("tenant-a", 1, 500);
    const task = vi.fn(() => blocked);

    const first = coordinator.run("tenant-a", "submit-1", task);
    const second = await coordinator.run("tenant-a", "submit-2", task);

    expect(second.status).toBe("rejected");
    if (second.status === "rejected") {
      expect(second.error).toBeInstanceOf(ScholarshipBackpressureError);
    }
    expect(task).toHaveBeenCalledOnce();
    release();
    await first;
  });

  it("blocks cross-tenant operations before work starts", () => {
    const coordinator = new ScholarshipBurstCoordinator("tenant-a");
    expect(() =>
      coordinator.run("tenant-b", "submit-1", async () => "blocked"),
    ).toThrow(ScholarshipTenantBoundaryError);
  });
});

describe("non-production enforcement (issue #1224)", () => {
  const stubResponse = (
    status: number,
    body: unknown,
    headers: Record<string, string> = {},
  ): Response =>
    ({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
      json: async () => body,
    }) as unknown as Response;

  it("refuses production hostnames", () => {
    expect(() => assertNonProductionTarget("https://api.chainverse.example/v1")).toThrow(
      ScholarshipLoadTestAuthorizationError,
    );
  });

  it("accepts local, staging, and testnet hosts", () => {
    for (const baseUrl of [
      "http://localhost:3002",
      "https://staging.chainverse.example/api",
      "https://api.staging.example.com",
      "https://preprod.internal/api",
      "https://horizon-testnet.stellar.org",
    ]) {
      expect(() => assertNonProductionTarget(baseUrl)).not.toThrow();
    }
  });

  it("rejects a relative base URL", () => {
    expect(() => assertNonProductionTarget("/api")).toThrow(
      ScholarshipLoadTestAuthorizationError,
    );
  });

  it("never issues a request against production", async () => {
    const fetchImpl = vi.fn();
    await expect(
      runDeadlineBurst(
        {
          baseUrl: "https://api.chainverse.example/v1",
          token: "operator-token",
          tenantId: "load-test-tenant-a",
          requests: 3,
          concurrency: 2,
        },
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toThrow(ScholarshipLoadTestAuthorizationError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports an authorization failure when the target rejects the token", async () => {
    const fetchImpl = vi.fn(async () => stubResponse(403, { error: "forbidden" })) as unknown as typeof fetch;

    await expect(
      runDeadlineBurst(
        {
          baseUrl: "https://staging.chainverse.example/api",
          token: "stale-token",
          tenantId: "load-test-tenant-a",
          requests: 1,
          concurrency: 1,
        },
        fetchImpl,
      ),
    ).rejects.toThrow(ScholarshipLoadTestAuthorizationError);
  });

  it("surfaces 429 as backpressure rather than a generic failure", async () => {
    const fetchImpl = vi.fn(async () => stubResponse(429, {}, { "retry-after": "1" })) as unknown as typeof fetch;

    await expect(
      runDeadlineBurst(
        {
          baseUrl: "https://staging.chainverse.example/api",
          token: "operator-token",
          tenantId: "load-test-tenant-a",
          requests: 1,
          concurrency: 1,
        },
        fetchImpl,
      ),
    ).rejects.toThrow(ScholarshipBackpressureError);
  });

  it("sends the operator bearer token to the target", async () => {
    const fetchImpl = vi.fn(async () =>
      stubResponse(200, { items: [], total: 0, deadline: "2026-10-01T23:59:59.000Z" }),
    ) as unknown as typeof fetch;

    const summary = await runDeadlineBurst(
      {
        baseUrl: "https://staging.chainverse.example/api",
        token: "operator-token",
        tenantId: "load-test-tenant-a",
        requests: 2,
        concurrency: 1,
      },
      fetchImpl,
    );

    expect(summary).toEqual({ accepted: 2, duplicates: 0, rejected: 0 });
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/scholarships/applications?tenantId=load-test-tenant-a");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer operator-token",
    });
  });
});

describe("load-test argument parsing", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it("requires a base URL and a token", () => {
    expect(() => parseLoadTestArgs([])).toThrow(/--base-url/);
    expect(() => parseLoadTestArgs(["--base-url", "https://staging.example/api"])).toThrow(
      /--token/,
    );
  });

  it("reads defaults from the environment", () => {
    process.env.SCHOLARSHIP_LOAD_TEST_BASE_URL = "https://staging.example/api";
    process.env.SCHOLARSHIP_LOAD_TEST_TOKEN = "env-token";

    expect(parseLoadTestArgs([])).toEqual({
      baseUrl: "https://staging.example/api",
      token: "env-token",
      tenantId: "load-test-tenant-a",
      requests: 50,
      concurrency: 5,
    });
  });

  it("rejects a production target before any work starts", () => {
    expect(() =>
      parseLoadTestArgs([
        "--base-url",
        "https://api.chainverse.example/v1",
        "--token",
        "operator-token",
      ]),
    ).toThrow(ScholarshipLoadTestAuthorizationError);
  });

  it("rejects non-positive request counts", () => {
    expect(() =>
      parseLoadTestArgs([
        "--base-url",
        "https://staging.example/api",
        "--token",
        "operator-token",
        "--requests",
        "0",
      ]),
    ).toThrow(/--requests/);
  });
});
