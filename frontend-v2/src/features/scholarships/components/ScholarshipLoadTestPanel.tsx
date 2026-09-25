"use client";

import { useState } from "react";
import {
  DEFAULT_SCHOLARSHIP_LOAD_TARGET,
  ScholarshipBackpressureError,
  ScholarshipBurstCoordinator,
  type BurstResult,
} from "../load-testing";

const coordinator = new ScholarshipBurstCoordinator(
  DEFAULT_SCHOLARSHIP_LOAD_TARGET.tenantId,
  2,
);

export function ScholarshipLoadTestPanel() {
  const [result, setResult] = useState<BurstResult<number> | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function runBurst() {
    setIsRunning(true);
    const key = `deadline-probe-${Date.now()}`;
    try {
      const next = await coordinator.run(
        DEFAULT_SCHOLARSHIP_LOAD_TARGET.tenantId,
        key,
        async () => DEFAULT_SCHOLARSHIP_LOAD_TARGET.burstRequestsPerSecond,
      );
      setResult(next);
    } catch (error) {
      setResult({
        status: "rejected",
        error:
          error instanceof ScholarshipBackpressureError
            ? error
            : new ScholarshipBackpressureError(250),
      });
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <section
      className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm"
      aria-labelledby="load-test-heading"
    >
      <h2
        id="load-test-heading"
        className="text-xl font-semibold text-slate-900"
      >
        Deadline burst readiness
      </h2>
      <p className="mt-1 text-sm text-slate-700">
        Synthetic probes only. Data is scoped to{" "}
        {DEFAULT_SCHOLARSHIP_LOAD_TARGET.tenantId} and never uses applicant
        records.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-slate-600">Applicants</dt>
          <dd className="font-semibold">
            {DEFAULT_SCHOLARSHIP_LOAD_TARGET.applicants.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-slate-600">Documents</dt>
          <dd className="font-semibold">
            {DEFAULT_SCHOLARSHIP_LOAD_TARGET.documents.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-slate-600">Reviewers</dt>
          <dd className="font-semibold">
            {DEFAULT_SCHOLARSHIP_LOAD_TARGET.reviewers.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-slate-600">Burst target</dt>
          <dd className="font-semibold">
            {DEFAULT_SCHOLARSHIP_LOAD_TARGET.burstRequestsPerSecond}/s
          </dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={runBurst}
        disabled={isRunning}
        className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
      >
        {isRunning ? "Running synthetic probe..." : "Run synthetic probe"}
      </button>
      <div className="mt-3 min-h-6 text-sm" role="status" aria-live="polite">
        {result?.status === "accepted" &&
          `Probe accepted at ${result.value} requests per second.`}
        {result?.status === "duplicate" &&
          "Duplicate probe safely reused the original result."}
        {result?.status === "rejected" &&
          `Backpressure is active. Retry after ${result.error.retryAfterMs}ms.`}
      </div>
    </section>
  );
}
