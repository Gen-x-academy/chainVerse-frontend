"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { sanitizeSummaryUrl, sessionSummaryService } from "../service";
import type { SessionSummaryContent, SessionSummaryRecord } from "../types";

const EMPTY_CONTENT: SessionSummaryContent = {
  summaryText: "",
  decisions: [],
  resources: [],
  nextSteps: [],
};

type Props = {
  sessionId: string;
  currentUserId: string;
  role: "mentor" | "student";
};

function lines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function resourcesFromInput(
  value: string,
): SessionSummaryContent["resources"] | null {
  const entries = lines(value);
  const resources = entries.map((entry) => {
    const separator = entry.indexOf("|");
    if (separator < 1) return null;
    const label = entry.slice(0, separator).trim();
    const url = sanitizeSummaryUrl(entry.slice(separator + 1));
    return label && url ? { label, url } : null;
  });
  return resources.some((resource) => resource === null)
    ? null
    : (resources as SessionSummaryContent["resources"]);
}

function contentFromRecord(
  record: SessionSummaryRecord,
): SessionSummaryContent {
  return record.summary ?? EMPTY_CONTENT;
}

export function SessionSummaryPanel({ sessionId, currentUserId, role }: Props) {
  const id = useId();
  const [record, setRecord] = useState<SessionSummaryRecord | null>(null);
  const [content, setContent] = useState<SessionSummaryContent>(EMPTY_CONTENT);
  const [resourceText, setResourceText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRecord(null);
    setContent(EMPTY_CONTENT);
    setResourceText("");
    try {
      const loaded = await sessionSummaryService.get(sessionId);
      setRecord(loaded);
      const loadedContent = contentFromRecord(loaded);
      setContent(loadedContent);
      setResourceText(
        loadedContent.resources
          .map(({ label, url }) => `${label} | ${url}`)
          .join("\n"),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load this session summary.",
      );
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading)
    return (
      <p role="status" aria-live="polite">
        Loading session summary...
      </p>
    );
  if (error && !record) {
    return (
      <div role="alert" className="space-y-3">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="min-h-11 rounded-md border px-3 py-2"
        >
          Retry loading summary
        </button>
      </div>
    );
  }
  if (!record) return <p role="status">This session summary is unavailable.</p>;

  const isParticipant =
    currentUserId.length > 0 &&
    [record.mentorId, record.menteeId].includes(currentUserId) &&
    (role === "mentor" || role === "student");
  if (!isParticipant) {
    return <p role="alert">You are not a participant in this session.</p>;
  }

  const summary = record.summary;
  const editable = summary?.state !== "confirmed";
  const currentResources = resourcesFromInput(resourceText);
  const hasUnsavedChanges =
    summary !== null &&
    (content.summaryText !== summary.summaryText ||
      JSON.stringify(content.decisions) !== JSON.stringify(summary.decisions) ||
      JSON.stringify(content.nextSteps) !== JSON.stringify(summary.nextSteps) ||
      JSON.stringify(currentResources) !== JSON.stringify(summary.resources));
  const updateList = (key: "decisions" | "nextSteps", value: string) => {
    setContent((current) => ({ ...current, [key]: lines(value) }));
  };

  const save = async () => {
    const resources = resourcesFromInput(resourceText);
    if (!resources) {
      setError(
        "Each resource must have a label and a valid HTTP or HTTPS link, separated by a vertical bar.",
      );
      return;
    }
    if (!content.summaryText.trim()) {
      setError("Add a concise session summary before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const saved = await sessionSummaryService.saveDraft(sessionId, {
        ...content,
        resources,
        expectedRevision: summary?.revision ?? 0,
      });
      const nextRecord = { ...record, summary: saved };
      setRecord(nextRecord);
      setContent(contentFromRecord(nextRecord));
      setResourceText(
        saved.resources.map(({ label, url }) => `${label} | ${url}`).join("\n"),
      );
      setStatus("Draft saved. This summary is not confirmed yet.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save the summary. Check your connection and retry.",
      );
    } finally {
      setSaving(false);
    }
  };

  const confirm = async () => {
    if (!summary || summary.state === "confirmed" || hasUnsavedChanges) return;
    setConfirming(true);
    setError(null);
    setStatus(null);
    try {
      const confirmed = await sessionSummaryService.confirm(
        sessionId,
        summary.revision,
      );
      setRecord({ ...record, summary: confirmed });
      setStatus("Session summary confirmed.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to confirm the summary. Reload and retry.",
      );
    } finally {
      setConfirming(false);
    }
  };

  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-5">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id={`${id}-heading`}
            className="text-lg font-semibold text-slate-900"
          >
            Shared session summary
          </h2>
          {summary ? (
            <p className="mt-1 text-sm text-slate-600">
              Draft by {summary.authorId}; last edited by {summary.updatedBy} ·
              revision {summary.revision}
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-600">
              No shared summary has been drafted yet.
            </p>
          )}
        </div>
        {summary?.state === "confirmed" ? (
          <span
            className="inline-flex w-fit rounded-md bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800"
            role="status"
          >
            Confirmed
          </span>
        ) : (
          <span
            className="inline-flex w-fit rounded-md bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-900"
            role="status"
          >
            Unconfirmed
          </span>
        )}
      </header>

      {status && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {status}
        </p>
      )}
      {error && record && (
        <div
          role="alert"
          className="space-y-2 rounded-md bg-red-50 p-3 text-sm text-red-800"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="min-h-11 rounded-md border border-red-300 px-3 py-2 font-semibold hover:bg-red-100"
          >
            Reload summary
          </button>
        </div>
      )}

      {editable ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          noValidate
        >
          <div>
            <label
              htmlFor={`${id}-summary`}
              className="block text-sm font-medium text-slate-800"
            >
              Summary
            </label>
            <textarea
              id={`${id}-summary`}
              value={content.summaryText}
              maxLength={1200}
              rows={4}
              aria-invalid={!content.summaryText.trim() && error !== null}
              required
              onChange={(event) =>
                setContent((current) => ({
                  ...current,
                  summaryText: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            />
            <p className="mt-1 text-xs text-slate-500">
              {content.summaryText.length}/1200 characters
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor={`${id}-decisions`}
                className="block text-sm font-medium text-slate-800"
              >
                Decisions
              </label>
              <textarea
                id={`${id}-decisions`}
                rows={4}
                value={content.decisions.join("\n")}
                onChange={(event) =>
                  updateList("decisions", event.target.value)
                }
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
              />
            </div>
            <div>
              <label
                htmlFor={`${id}-next-steps`}
                className="block text-sm font-medium text-slate-800"
              >
                Next steps
              </label>
              <textarea
                id={`${id}-next-steps`}
                rows={4}
                value={content.nextSteps.join("\n")}
                onChange={(event) =>
                  updateList("nextSteps", event.target.value)
                }
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor={`${id}-resources`}
              className="block text-sm font-medium text-slate-800"
            >
              Resources
            </label>
            <textarea
              id={`${id}-resources`}
              rows={3}
              value={resourceText}
              onChange={(event) => setResourceText(event.target.value)}
              aria-describedby={`${id}-resource-help`}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            />
            <p
              id={`${id}-resource-help`}
              className="mt-1 text-xs text-slate-500"
            >
              One per line: label | https://example.com
            </p>
          </div>
          {hasUnsavedChanges && (
            <p role="status" className="text-sm text-amber-900">
              Save your edits before confirming this revision.
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="submit"
              disabled={saving || confirming}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
            >
              {saving ? "Saving draft..." : "Save draft"}
            </button>
            {summary && (
              <button
                type="button"
                onClick={() => void confirm()}
                disabled={saving || confirming || hasUnsavedChanges}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
              >
                {confirming ? "Confirming..." : "Confirm summary"}
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="space-y-5">
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">
            {summary.summaryText}
          </p>
          {summary.decisions.length > 0 && (
            <section aria-label="Decisions">
              <h3 className="font-semibold text-slate-900">Decisions</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {summary.decisions.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </section>
          )}
          {summary.resources.length > 0 && (
            <section aria-label="Resources">
              <h3 className="font-semibold text-slate-900">Resources</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {summary.resources.map((resource, index) => {
                  const safeUrl = sanitizeSummaryUrl(resource.url);
                  return safeUrl ? (
                    <li key={`${resource.url}-${index}`}>
                      <a
                        href={safeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-700 underline underline-offset-2"
                      >
                        {resource.label}
                      </a>
                    </li>
                  ) : null;
                })}
              </ul>
            </section>
          )}
          {summary.nextSteps.length > 0 && (
            <section aria-label="Next steps">
              <h3 className="font-semibold text-slate-900">Next steps</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {summary.nextSteps.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </section>
          )}
          {summary.confirmedAt && (
            <p className="text-sm text-slate-600">
              Confirmed by {summary.confirmedBy} on{" "}
              {new Date(summary.confirmedAt).toLocaleString()}.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
