/**
 * Capstone proposal history and status timeline (CAPSTONE-040).
 *
 * Turns the recorded events of a proposal into a timeline that is safe to
 * show: ordered deterministically, de-duplicated (a replayed event is shown
 * once), and filtered by who is looking. Access is deny-by-default. The owner
 * sees their own proposal's history, reviewers and administrators see it with
 * the applicant described by role, and everyone else sees nothing. Raw actor
 * ids never appear in a timeline entry, and internal review notes are never
 * shown to the applicant.
 */

export type ProposalEventKind = "created" | "submitted" | "withdrawn" | "resubmitted" | "review_started" | "decided";
export type DecisionOutcome = "accepted" | "declined" | "waitlisted";

export interface ProposalEvent {
  /** Unique per event; a repeated id is the same event delivered twice. */
  id: string;
  proposalId: string;
  kind: ProposalEventKind;
  /** ISO 8601 timestamp. */
  at: string;
  version: number;
  actorId: string;
  /** Applicant-facing text for `decided`, internal review text for `review_started`, owner text for `withdrawn`. */
  note?: string;
  outcome?: DecisionOutcome;
}

export type ViewerRole = "owner" | "reviewer" | "admin" | "other";

export interface Viewer {
  userId: string;
  role: ViewerRole;
}

export interface TimelineEntry {
  id: string;
  kind: ProposalEventKind;
  at: string;
  version: number;
  label: string;
  /** Who acted, described without an id: "You", "Applicant" or "Review team". */
  actorLabel: string;
  note?: string;
  outcome?: DecisionOutcome;
}

export type ProposalStatus = "draft" | "submitted" | "under_review" | "withdrawn" | "accepted" | "declined" | "waitlisted";

const LABELS: Record<ProposalEventKind, string> = {
  created: "Draft created",
  submitted: "Submitted",
  withdrawn: "Withdrawn",
  resubmitted: "Resubmitted",
  review_started: "Review started",
  decided: "Decision recorded",
};

/** Order of kinds that share a timestamp, so the timeline reads in lifecycle order. */
const KIND_ORDER: Record<ProposalEventKind, number> = { created: 0, submitted: 1, resubmitted: 1, review_started: 2, withdrawn: 3, decided: 4 };

const OUTCOME_LABELS: Record<DecisionOutcome, string> = { accepted: "Accepted", declined: "Declined", waitlisted: "Waitlisted" };

function time(at: string): number {
  const value = Date.parse(at);
  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value;
}

/** Events of one proposal in order, with repeated ids and unreadable timestamps dropped. */
export function orderEvents(events: readonly ProposalEvent[], proposalId: string): ProposalEvent[] {
  const seen = new Set<string>();
  return events
    .filter((e) => {
      if (e.proposalId !== proposalId || seen.has(e.id) || Number.isNaN(Date.parse(e.at))) return false;
      seen.add(e.id);
      return true;
    })
    .sort((a, b) => time(a.at) - time(b.at) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.id.localeCompare(b.id));
}

export function canViewHistory(viewer: Viewer, ownerId: string): boolean {
  if (viewer.role === "owner") return viewer.userId === ownerId;
  return viewer.role === "reviewer" || viewer.role === "admin";
}

function actorLabel(event: ProposalEvent, viewer: Viewer, ownerId: string): string {
  if (event.actorId === ownerId) return viewer.role === "owner" ? "You" : "Applicant";
  return "Review team";
}

/** What the viewer may read in the note: applicants never see internal review notes. */
function visibleNote(event: ProposalEvent, viewer: Viewer): string | undefined {
  const note = event.note?.trim();
  if (!note) return undefined;
  if (event.kind === "review_started" && viewer.role === "owner") return undefined;
  return note;
}

/** The timeline for `viewer`, or an empty list when they may not see this proposal. */
export function buildTimeline(events: readonly ProposalEvent[], proposalId: string, ownerId: string, viewer: Viewer): TimelineEntry[] {
  if (!canViewHistory(viewer, ownerId)) return [];
  return orderEvents(events, proposalId).map((event) => {
    const note = visibleNote(event, viewer);
    return {
      id: event.id,
      kind: event.kind,
      at: event.at,
      version: event.version,
      label: event.kind === "decided" && event.outcome ? `${LABELS.decided}: ${OUTCOME_LABELS[event.outcome]}` : LABELS[event.kind],
      actorLabel: actorLabel(event, viewer, ownerId),
      ...(note ? { note } : {}),
      ...(event.outcome ? { outcome: event.outcome } : {}),
    };
  });
}

/** Current status from the latest event, or `null` when there are no events. */
export function currentStatus(events: readonly ProposalEvent[], proposalId: string): { status: ProposalStatus; version: number; since: string } | null {
  const ordered = orderEvents(events, proposalId);
  const last = ordered[ordered.length - 1];
  if (!last) return null;
  const status: ProposalStatus =
    last.kind === "created" ? "draft"
    : last.kind === "withdrawn" ? "withdrawn"
    : last.kind === "review_started" ? "under_review"
    : last.kind === "decided" ? (last.outcome ?? "declined")
    : "submitted";
  return { status, version: last.version, since: last.at };
}

export interface VersionSummary {
  version: number;
  submittedAt: string;
  /** How this version ended, or `open` while it is still the live one. */
  end: "open" | "withdrawn" | "accepted" | "declined" | "waitlisted";
  endedAt?: string;
}

/** One row per submitted version, for a compact "versions" view. */
export function summarizeVersions(events: readonly ProposalEvent[], proposalId: string): VersionSummary[] {
  const versions = new Map<number, VersionSummary>();
  for (const event of orderEvents(events, proposalId)) {
    if (event.kind === "submitted" || event.kind === "resubmitted") {
      if (!versions.has(event.version)) versions.set(event.version, { version: event.version, submittedAt: event.at, end: "open" });
      continue;
    }
    const summary = versions.get(event.version);
    if (!summary) continue;
    if (event.kind === "withdrawn") Object.assign(summary, { end: "withdrawn", endedAt: event.at });
    if (event.kind === "decided") Object.assign(summary, { end: event.outcome ?? "declined", endedAt: event.at });
  }
  return [...versions.values()].sort((a, b) => a.version - b.version);
}
