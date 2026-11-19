/**
 * Capstone dependency readiness (CAPSTONE-008).
 *
 * Liveness answers "is the process running?" and never depends on anything
 * else. Readiness reports each backing dependency separately: required ones
 * (persistence, files) make the service not ready when they are down;
 * optional ones (search, notifications, ...) only degrade it.
 */

export const DEPENDENCIES = [
  "persistence",
  "search",
  "files",
  "notifications",
  "collaboration",
  "plagiarism",
  "payments",
  "ledger",
] as const;
export type Dependency = (typeof DEPENDENCIES)[number];

export const REQUIRED_DEPENDENCIES: readonly Dependency[] = ["persistence", "files"];

export type DependencyStatus = "up" | "degraded" | "down" | "unknown";

export interface ProbeResult {
  status: Exclude<DependencyStatus, "unknown">;
  latencyMs?: number;
  /** Short, non-sensitive reason; never a connection string or stack trace. */
  detail?: string;
}

export type Probe = () => Promise<ProbeResult>;

export interface DependencyReport {
  name: Dependency;
  required: boolean;
  status: DependencyStatus;
  latencyMs?: number;
  detail?: string;
}

export type OverallStatus = "ready" | "degraded" | "not_ready";

export interface ReadinessReport {
  /** Liveness is independent of every dependency. */
  live: true;
  status: OverallStatus;
  dependencies: DependencyReport[];
}

const SAFE_DETAIL = /^[\w .,:;()/-]{0,120}$/;

/** Keep only short, plain detail text. */
function safeDetail(detail: string | undefined): string | undefined {
  if (!detail) return undefined;
  const text = detail.replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[url]").trim();
  return SAFE_DETAIL.test(text) ? text : text.slice(0, 120).replace(/[^\w .,:;()/-]/g, "?");
}

/** Combine per-dependency results into one report. Missing probes are "unknown". */
export function evaluateReadiness(results: Partial<Record<Dependency, ProbeResult>>): ReadinessReport {
  const dependencies: DependencyReport[] = DEPENDENCIES.map((name) => {
    const result = results[name];
    return {
      name,
      required: REQUIRED_DEPENDENCIES.includes(name),
      status: result?.status ?? "unknown",
      ...(result?.latencyMs !== undefined ? { latencyMs: result.latencyMs } : {}),
      ...(result?.detail ? { detail: safeDetail(result.detail) } : {}),
    };
  });

  const requiredBroken = dependencies.some((d) => d.required && d.status !== "up" && d.status !== "degraded");
  const anyImpaired = dependencies.some((d) => d.status !== "up");
  return {
    live: true,
    status: requiredBroken ? "not_ready" : anyImpaired ? "degraded" : "ready",
    dependencies,
  };
}

/** The always-available liveness answer. */
export function liveness(): { live: true } {
  return { live: true };
}

/**
 * Run probes in parallel, each bounded by `timeoutMs`. A probe that throws or
 * times out is reported as `down` with a generic detail (its error text is not
 * passed through).
 */
export async function runProbes(
  probes: Partial<Record<Dependency, Probe>>,
  timeoutMs = 2000,
  now: () => number = Date.now,
): Promise<ReadinessReport> {
  const entries = await Promise.all(
    DEPENDENCIES.filter((name) => probes[name]).map(async (name) => {
      const started = now();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
        });
        const result = await Promise.race([(probes[name] as Probe)(), timeout]);
        return [name, { ...result, latencyMs: result.latencyMs ?? now() - started }] as const;
      } catch (error) {
        const timedOut = error instanceof Error && error.message === "timeout";
        return [name, { status: "down" as const, latencyMs: now() - started, detail: timedOut ? "probe timed out" : "probe failed" }] as const;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }),
  );
  return evaluateReadiness(Object.fromEntries(entries));
}
