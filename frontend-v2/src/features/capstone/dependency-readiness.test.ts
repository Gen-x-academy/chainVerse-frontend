import { describe, expect, it, vi } from "vitest";
import { DEPENDENCIES, evaluateReadiness, liveness, runProbes, type ProbeResult } from "./dependency-readiness";

const allUp = (): Record<string, ProbeResult> => Object.fromEntries(DEPENDENCIES.map((d) => [d, { status: "up" as const }]));

describe("capstone dependency readiness", () => {
  it("reports every dependency separately and is ready when all are up", () => {
    const report = evaluateReadiness(allUp());
    expect(report.status).toBe("ready");
    expect(report.dependencies.map((d) => d.name)).toEqual([...DEPENDENCIES]);
    expect(report.dependencies.filter((d) => d.required).map((d) => d.name)).toEqual(["persistence", "files"]);
  });

  it("is not ready when a required dependency is down", () => {
    for (const name of ["persistence", "files"]) {
      const report = evaluateReadiness({ ...allUp(), [name]: { status: "down" } });
      expect(report.status).toBe("not_ready");
    }
  });

  it("is only degraded when an optional dependency is down or unprobed", () => {
    expect(evaluateReadiness({ ...allUp(), search: { status: "down" } }).status).toBe("degraded");
    expect(evaluateReadiness({ ...allUp(), payments: { status: "degraded" } }).status).toBe("degraded");
    const missing = allUp();
    delete missing.ledger;
    const report = evaluateReadiness(missing);
    expect(report.status).toBe("degraded");
    expect(report.dependencies.find((d) => d.name === "ledger")?.status).toBe("unknown");
  });

  it("treats a missing required dependency as not ready", () => {
    const missing = allUp();
    delete missing.persistence;
    expect(evaluateReadiness(missing).status).toBe("not_ready");
  });

  it("keeps liveness independent of dependencies", () => {
    expect(liveness()).toEqual({ live: true });
    expect(evaluateReadiness({}).live).toBe(true);
    expect(evaluateReadiness({}).status).toBe("not_ready");
  });

  it("does not leak URLs or odd characters through detail text", () => {
    const report = evaluateReadiness({ ...allUp(), search: { status: "degraded", detail: "cannot reach https://user:pw@search.internal:9200/x" } });
    const detail = report.dependencies.find((d) => d.name === "search")?.detail ?? "";
    expect(detail).not.toContain("pw");
    expect(detail).not.toContain("search.internal");
  });

  it("runs probes in parallel, records latency, and converts failures and timeouts to down", async () => {
    vi.useFakeTimers();
    let t = 0;
    const now = () => t;
    const promise = runProbes(
      {
        persistence: async () => ({ status: "up" }),
        files: async () => {
          throw new Error("connect ECONNREFUSED postgres://u:p@h/db");
        },
        search: () => new Promise(() => {}),
        ledger: async () => ({ status: "degraded", detail: "slow", latencyMs: 900 }),
      },
      100,
      now,
    );
    t = 120;
    await vi.advanceTimersByTimeAsync(150);
    const report = await promise;
    vi.useRealTimers();
    const by = Object.fromEntries(report.dependencies.map((d) => [d.name, d]));
    expect(by.persistence.status).toBe("up");
    expect(by.files).toMatchObject({ status: "down", detail: "probe failed" });
    expect(JSON.stringify(by.files)).not.toMatch(/postgres|ECONNREFUSED/);
    expect(by.search).toMatchObject({ status: "down", detail: "probe timed out" });
    expect(by.ledger).toMatchObject({ status: "degraded", latencyMs: 900 });
    expect(by.notifications.status).toBe("unknown");
    expect(report.status).toBe("not_ready");
  });
});
