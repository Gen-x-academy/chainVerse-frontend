"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { sessionSummaryService } from "../service";
import type { SessionSummaryListItem } from "../types";

function summaryLabel(state: SessionSummaryListItem["summaryState"]): string {
  if (state === "confirmed") return "Confirmed";
  if (state === "draft") return "Unconfirmed draft";
  return "No summary";
}

export function SessionSummaryList() {
  const [sessions, setSessions] = useState<SessionSummaryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSessions(await sessionSummaryService.list());
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load completed sessions.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading)
    return (
      <p role="status" aria-live="polite">
        Loading completed sessions...
      </p>
    );
  if (error) {
    return (
      <div role="alert" className="space-y-3">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="min-h-11 rounded-md border px-3 py-2"
        >
          Retry loading sessions
        </button>
      </div>
    );
  }
  if (sessions.length === 0) {
    return <p role="status">No completed sessions are available yet.</p>;
  }

  return (
    <ul
      aria-label="Completed mentorship sessions"
      className="divide-y divide-slate-200"
    >
      {sessions.map((session) => (
        <li
          key={session.sessionId}
          className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900">
              Session with {session.counterpartName}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {new Date(session.startsAt).toLocaleString()}
              <span className="mx-2" aria-hidden="true">
                ·
              </span>
              {summaryLabel(session.summaryState)}
            </p>
          </div>
          <Link
            href={`/mentorship/sessions/${encodeURIComponent(session.sessionId)}/summary`}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          >
            {session.summaryState === "missing"
              ? "Create summary"
              : "View summary"}
            <span className="sr-only">
              {" "}
              for session with {session.counterpartName}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
