"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import {
  canPerformMentorshipAction,
  type MentorshipPrincipal,
} from "../../rbac";
import { sessionDisputeService, SessionDisputeError } from "../service";
import {
  canCreateSessionDispute,
  canResolveSessionDispute,
  canSubmitDisputeResponse,
  validateDisputeSubmission,
} from "../rules";
import {
  SESSION_DISPUTE_ISSUES,
  type SessionDispute,
  type SessionDisputeSnapshot,
} from "../types";

export interface SessionDisputesPanelProps {
  principal: MentorshipPrincipal;
  now?: () => Date;
  capabilityState?: "loading" | "enabled" | "disabled";
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; snapshot: SessionDisputeSnapshot };

const ISSUE_LABELS: Record<(typeof SESSION_DISPUTE_ISSUES)[number], string> = {
  attendance: "Attendance",
  completion: "Completion",
  duration: "Duration",
  outcome: "Outcome",
};

function referencesFrom(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(/\r?\n/)
    .map((reference) => reference.trim())
    .filter(Boolean);
}

function createIdempotencyKey(): string {
  return `mentor-067-${crypto.randomUUID()}`;
}

function errorMessage(
  error: unknown,
  context: "load" | "action" = "action",
): string {
  if (error instanceof SessionDisputeError) return error.message;
  return context === "load"
    ? "The dispute list could not be loaded. Check your connection and try again."
    : "The dispute action could not be saved. Refresh and try again.";
}

function DisputeRecordCard({
  dispute,
  principal,
  tenantId,
  now,
  busy,
  onRespond,
  onResolve,
}: {
  dispute: SessionDispute;
  principal: MentorshipPrincipal;
  tenantId: string;
  now: Date;
  busy: boolean;
  onRespond: (
    dispute: SessionDispute,
    summary: string,
    evidenceReferences: string[],
  ) => Promise<boolean>;
  onResolve: (
    dispute: SessionDispute,
    decision: "confirm-completion" | "refund" | "partial-refund",
    rationale: string,
  ) => Promise<boolean>;
}) {
  const resource = {
    resource: "dispute" as const,
    tenantId,
    ownerId: dispute.isOpenedByCurrentUser ? principal.userId : undefined,
  };
  const mayRespond =
    canPerformMentorshipAction(principal, resource, "update").allowed &&
    canSubmitDisputeResponse(dispute, now);
  const mayResolve =
    canPerformMentorshipAction(principal, resource, "approve").allowed &&
    canResolveSessionDispute(dispute, now);

  return (
    <article
      className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
      aria-labelledby={`dispute-${dispute.publicId}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3
            id={`dispute-${dispute.publicId}`}
            className="font-semibold text-gray-900"
          >
            Session {dispute.sessionId}
          </h3>
          <p className="text-sm text-gray-600">
            {ISSUE_LABELS[dispute.issue]} dispute ·{" "}
            {dispute.status.replace("-", " ")}
          </p>
        </div>
        <span
          className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900"
          aria-label="Settlement paused"
        >
          {dispute.settlementStatus === "paused"
            ? "Settlement paused"
            : `Settlement ${dispute.settlementStatus}`}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm text-gray-800">
        {dispute.summary}
      </p>
      <p className="text-sm text-gray-600">
        Response due{" "}
        <time dateTime={dispute.responseDeadlineAt}>
          {new Date(dispute.responseDeadlineAt).toLocaleString()}
        </time>
      </p>
      {dispute.evidenceReferences.length > 0 && (
        <ul
          aria-label="Evidence references"
          className="list-inside list-disc break-all text-sm text-gray-600"
        >
          {dispute.evidenceReferences.map((reference) => (
            <li key={reference}>{reference}</li>
          ))}
        </ul>
      )}
      {dispute.response && (
        <section
          aria-label="Participant response"
          className="border-l-2 border-gray-300 pl-3"
        >
          <h4 className="text-sm font-semibold text-gray-800">
            Response received
          </h4>
          <p className="whitespace-pre-wrap text-sm text-gray-700">
            {dispute.response.summary}
          </p>
          {dispute.response.evidenceReferences.length > 0 && (
            <ul
              aria-label="Response evidence references"
              className="list-inside list-disc break-all text-sm text-gray-600"
            >
              {dispute.response.evidenceReferences.map((reference) => (
                <li key={reference}>{reference}</li>
              ))}
            </ul>
          )}
        </section>
      )}
      {dispute.resolution && (
        <section
          aria-label="Auditable resolution"
          className="border-l-2 border-green-600 pl-3"
        >
          <h4 className="text-sm font-semibold text-gray-800">
            Resolution: {dispute.resolution.decision.replaceAll("-", " ")}
          </h4>
          <p className="text-sm text-gray-700">
            {dispute.resolution.rationale}
          </p>
          <p className="text-xs text-gray-600">
            Audit reference: {dispute.resolution.auditEventId}
          </p>
        </section>
      )}
      {mayRespond && (
        <form
          className="grid gap-3 border-t border-gray-200 pt-3"
          aria-label={`Respond to session ${dispute.sessionId} dispute`}
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            void onRespond(
              dispute,
              String(data.get("responseSummary") ?? ""),
              referencesFrom(data.get("responseEvidence")),
            ).then((saved) => {
              if (saved) form.reset();
            });
          }}
        >
          <label className="grid gap-1 text-sm font-medium text-gray-800">
            Your response
            <textarea
              name="responseSummary"
              required
              maxLength={2000}
              rows={3}
              className="rounded-md border border-gray-300 p-2"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-gray-800">
            Evidence references, one per line
            <textarea
              name="responseEvidence"
              rows={2}
              className="rounded-md border border-gray-300 p-2"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 w-fit rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Submit response
          </button>
        </form>
      )}
      {mayResolve && (
        <form
          className="grid gap-3 border-t border-gray-200 pt-3"
          aria-label={`Resolve session ${dispute.sessionId} dispute`}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void onResolve(
              dispute,
              String(
                data.get("decision") as
                  | "confirm-completion"
                  | "refund"
                  | "partial-refund",
              ),
              String(data.get("rationale") ?? ""),
            );
          }}
        >
          <label className="grid gap-1 text-sm font-medium text-gray-800">
            Resolution decision
            <select
              name="decision"
              className="min-h-11 rounded-md border border-gray-300 px-2"
            >
              <option value="confirm-completion">Confirm completion</option>
              <option value="refund">Refund</option>
              <option value="partial-refund">Partial refund</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-gray-800">
            Resolution rationale
            <textarea
              name="rationale"
              required
              maxLength={2000}
              rows={3}
              className="rounded-md border border-gray-300 p-2"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 w-fit rounded-md bg-green-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Record resolution
          </button>
        </form>
      )}
    </article>
  );
}

export function SessionDisputesPanel({
  principal,
  now: getNow = () => new Date(),
  capabilityState = "enabled",
}: SessionDisputesPanelProps) {
  const [state, setState] = React.useState<LoadState>({ status: "loading" });
  const [busyKey, setBusyKey] = React.useState<string>();
  const [notice, setNotice] = React.useState("");
  const [actionError, setActionError] = React.useState("");
  const keyByAction = React.useRef(new Map<string, string>());
  const tenantId = principal.tenantId;
  const hasPrincipal = Boolean(principal.userId && tenantId);

  const load = React.useCallback(async () => {
    setState({ status: "loading" });
    try {
      const snapshot = await sessionDisputeService.load(tenantId);
      setState({ status: "success", snapshot });
    } catch (error) {
      setState({ status: "error", message: errorMessage(error, "load") });
    }
  }, [tenantId]);

  React.useEffect(() => {
    if (capabilityState === "enabled") void load();
  }, [capabilityState, load]);

  function keyFor(action: string): string {
    let key = keyByAction.current.get(action);
    if (!key) {
      key = createIdempotencyKey();
      keyByAction.current.set(action, key);
    }
    return key;
  }

  async function runAction(
    action: string,
    save: (idempotencyKey: string) => Promise<SessionDispute>,
    success: string,
  ): Promise<boolean> {
    setBusyKey(action);
    setActionError("");
    setNotice("");
    try {
      await save(keyFor(action));
      keyByAction.current.delete(action);
      setNotice(success);
      await load();
      return true;
    } catch (error) {
      setActionError(errorMessage(error));
      return false;
    } finally {
      setBusyKey(undefined);
    }
  }

  async function openDispute(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status !== "success") return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const input = {
      sessionId: String(data.get("sessionId") ?? ""),
      issue: String(
        data.get("issue") ?? "",
      ) as (typeof SESSION_DISPUTE_ISSUES)[number],
      summary: String(data.get("summary") ?? ""),
      evidenceReferences: referencesFrom(data.get("evidenceReferences")),
    };
    const validation = validateDisputeSubmission(input);
    if (validation) {
      setActionError(
        validation === "SUMMARY_REQUIRED"
          ? "Describe what you are challenging before submitting."
          : validation === "SUMMARY_TOO_LONG"
            ? "Keep the description to 2,000 characters or fewer."
            : "Use an HTTPS link or evidence:<reference> for each evidence reference.",
      );
      return;
    }
    const session = state.snapshot.sessions.find(
      (candidate) => candidate.publicId === input.sessionId,
    );
    if (!session?.canOpenDispute || session.settlementStatus !== "pending") {
      setActionError(
        "This session is no longer eligible for a dispute. Refresh to check its settlement status.",
      );
      return;
    }
    const decision = canPerformMentorshipAction(
      principal,
      {
        resource: "dispute",
        tenantId,
        ownerId: principal.userId,
      },
      "create",
    );
    if (!decision.allowed || !canCreateSessionDispute(principal)) {
      setActionError("Your role is not allowed to open a session dispute.");
      return;
    }
    const saved = await runAction(
      `open:${input.sessionId}`,
      (key) => sessionDisputeService.open(tenantId, input, key),
      "Dispute opened. Settlement is paused while both participants have a response window.",
    );
    if (saved) form.reset();
  }

  async function respond(
    dispute: SessionDispute,
    summary: string,
    evidenceReferences: string[],
  ): Promise<boolean> {
    const validation = validateDisputeSubmission({
      issue: dispute.issue,
      summary,
      evidenceReferences,
    });
    if (validation) {
      setActionError(
        validation === "SUMMARY_REQUIRED"
          ? "Add a response before submitting."
          : "Check the response and evidence references.",
      );
      return false;
    }
    if (
      !hasPrincipal ||
      !canPerformMentorshipAction(
        principal,
        { resource: "dispute", tenantId },
        "update",
      ).allowed
    ) {
      setActionError(
        "Your role is not allowed to respond to this session dispute.",
      );
      return false;
    }
    return runAction(
      `respond:${dispute.publicId}`,
      (key) =>
        sessionDisputeService.respond(
          tenantId,
          dispute.publicId,
          { summary: summary.trim(), evidenceReferences },
          key,
        ),
      "Response submitted. The dispute is ready for review.",
    );
  }

  async function resolve(
    dispute: SessionDispute,
    decision: "confirm-completion" | "refund" | "partial-refund",
    rationale: string,
  ): Promise<boolean> {
    if (!rationale.trim() || rationale.trim().length > 2000) {
      setActionError(
        "Add a resolution rationale of 2,000 characters or fewer.",
      );
      return false;
    }
    if (!canResolveSessionDispute(dispute, getNow())) {
      setActionError(
        "Resolution is available after a response is received or the response deadline passes.",
      );
      return false;
    }
    const decisionCheck = canPerformMentorshipAction(
      principal,
      {
        resource: "dispute",
        tenantId,
        ownerId: dispute.isOpenedByCurrentUser ? principal.userId : undefined,
      },
      "approve",
    );
    if (!hasPrincipal || !decisionCheck.allowed) {
      setActionError(
        "Only an authorized moderator can resolve a session dispute.",
      );
      return false;
    }
    return runAction(
      `resolve:${dispute.publicId}`,
      (key) =>
        sessionDisputeService.resolve(
          tenantId,
          dispute.publicId,
          { decision, rationale: rationale.trim() },
          key,
        ),
      "Resolution recorded with an audit reference.",
    );
  }

  const mayCreate =
    hasPrincipal &&
    canCreateSessionDispute(principal) &&
    canPerformMentorshipAction(
      principal,
      { resource: "dispute", tenantId },
      "create",
    ).allowed;

  return (
    <section aria-label="Session completion disputes" className="space-y-5">
      {capabilityState === "loading" && (
        <p role="status" aria-live="polite">
          Checking session dispute availability…
        </p>
      )}
      {capabilityState === "disabled" && (
        <p role="status">
          Session disputes are not enabled in this environment.
        </p>
      )}
      {capabilityState === "enabled" && state.status === "loading" && (
        <p role="status" aria-live="polite">
          Loading session disputes…
        </p>
      )}
      {capabilityState === "enabled" && state.status === "error" && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <span>{state.message}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex min-h-11 items-center gap-2 rounded px-2 underline"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
          </button>
        </div>
      )}
      {capabilityState === "enabled" && actionError && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900"
        >
          {actionError}
        </p>
      )}
      {capabilityState === "enabled" && notice && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900"
        >
          {notice}
        </p>
      )}

      {capabilityState === "enabled" && state.status === "success" && (
        <>
          {mayCreate && state.snapshot.sessions.length > 0 && (
            <form
              onSubmit={(event) => void openDispute(event)}
              className="grid gap-4 rounded-lg border border-gray-200 bg-white p-4 sm:p-6"
              aria-labelledby="open-dispute-title"
            >
              <div>
                <h2
                  id="open-dispute-title"
                  className="text-lg font-semibold text-gray-900"
                >
                  Challenge a session
                </h2>
                <p className="text-sm text-gray-600">
                  A dispute pauses settlement. Evidence is submitted as a
                  reference only.
                </p>
              </div>
              <label className="grid gap-1 text-sm font-medium text-gray-800">
                Session
                <select
                  name="sessionId"
                  required
                  defaultValue=""
                  className="min-h-11 rounded-md border border-gray-300 px-2"
                >
                  <option value="" disabled>
                    Select a session awaiting settlement
                  </option>
                  {state.snapshot.sessions
                    .filter((session) => session.canOpenDispute)
                    .map((session) => (
                      <option key={session.publicId} value={session.publicId}>
                        Session {session.publicId} · completed{" "}
                        {new Date(session.completedAt).toLocaleDateString()}
                      </option>
                    ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-gray-800">
                What are you challenging?
                <select
                  name="issue"
                  className="min-h-11 rounded-md border border-gray-300 px-2"
                >
                  {SESSION_DISPUTE_ISSUES.map((issue) => (
                    <option key={issue} value={issue}>
                      {ISSUE_LABELS[issue]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-gray-800">
                Description
                <textarea
                  name="summary"
                  required
                  maxLength={2000}
                  rows={4}
                  className="rounded-md border border-gray-300 p-2"
                  aria-describedby="dispute-summary-help"
                />
                <span
                  id="dispute-summary-help"
                  className="font-normal text-gray-600"
                >
                  Do not include sensitive personal information.
                </span>
              </label>
              <label className="grid gap-1 text-sm font-medium text-gray-800">
                Evidence references, one per line
                <textarea
                  name="evidenceReferences"
                  rows={3}
                  className="rounded-md border border-gray-300 p-2"
                  aria-describedby="dispute-evidence-help"
                />
                <span
                  id="dispute-evidence-help"
                  className="font-normal text-gray-600"
                >
                  Use HTTPS links or opaque evidence: references. Do not paste
                  files or private evidence contents.
                </span>
              </label>
              <button
                type="submit"
                disabled={busyKey !== undefined}
                className="min-h-11 w-fit rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Open dispute and pause settlement
              </button>
            </form>
          )}

          {state.snapshot.disputes.length === 0 ? (
            <p
              className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600"
              role="status"
            >
              No session disputes to show.
              {state.snapshot.sessions.length === 0 && mayCreate
                ? " Sessions become available here while awaiting settlement."
                : ""}
            </p>
          ) : (
            <section aria-labelledby="dispute-list-title" className="space-y-3">
              <h2
                id="dispute-list-title"
                className="text-lg font-semibold text-gray-900"
              >
                Dispute records
              </h2>
              {state.snapshot.disputes.map((dispute) => (
                <DisputeRecordCard
                  key={dispute.publicId}
                  dispute={dispute}
                  principal={principal}
                  tenantId={tenantId}
                  now={getNow()}
                  busy={
                    busyKey === `respond:${dispute.publicId}` ||
                    busyKey === `resolve:${dispute.publicId}`
                  }
                  onRespond={respond}
                  onResolve={resolve}
                />
              ))}
            </section>
          )}
        </>
      )}
    </section>
  );
}
