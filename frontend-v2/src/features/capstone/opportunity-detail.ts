/**
 * Project opportunity detail view-model (CAPSTONE-026).
 *
 * Builds what the detail page shows: the problem, outcomes, prerequisites,
 * timeline, roles, sponsor, terms, seats and the clear next actions for this
 * viewer. Restricted data is dropped here, at the boundary, so the page cannot
 * render what it was never given.
 */

export type ViewerState = "anonymous" | "signed_in" | "applied" | "reserved" | "waitlisted" | "confirmed";

export interface OpportunitySource {
  id: string;
  title: string;
  status: "draft" | "open" | "closed" | "archived";
  problemStatement: string;
  outcomes: string[];
  prerequisites: string[];
  timeline: { opensOn: string; closesOn: string; startsOn: string; endsOn: string };
  roles: Array<{ name: string; seats: number; description: string }>;
  sponsor?: { name: string; disclosed: boolean };
  termsVersion: number;
  seats: { total: number; taken: number; waitlistOpen: boolean };
  // Restricted: only organizers/reviewers may see these.
  internalNotes?: string;
  reviewerIds?: string[];
  budgetMinor?: string;
  applicantCount?: number;
}

export interface ViewerContext {
  state: ViewerState;
  /** Organizer or reviewer of this opportunity. */
  staff?: boolean;
  eligible?: boolean | null;
  profileComplete?: boolean;
}

export type ActionId = "sign_in" | "complete_profile" | "apply" | "join_waitlist" | "confirm_seat" | "withdraw" | "view_terms" | "none";

export interface NextAction {
  id: ActionId;
  label: string;
  /** Why this is offered, or why something else is not. */
  hint?: string;
  primary: boolean;
}

export interface OpportunityDetail {
  id: string;
  title: string;
  status: OpportunitySource["status"];
  problemStatement: string;
  outcomes: string[];
  prerequisites: string[];
  timeline: OpportunitySource["timeline"];
  roles: OpportunitySource["roles"];
  sponsor: { name: string } | { name: null; note: string } | null;
  termsVersion: number;
  seats: { total: number; remaining: number; label: string };
  actions: NextAction[];
  /** Present only for staff. */
  staff?: { internalNotes: string | null; reviewerCount: number; applicantCount: number | null; budgetMinor: string | null };
}

function seatLabel(s: OpportunitySource["seats"]): string {
  const remaining = Math.max(0, s.total - s.taken);
  if (remaining > 0) return `${remaining} of ${s.total} seats left`;
  return s.waitlistOpen ? "Full, waitlist open" : "Full";
}

export function nextActions(o: OpportunitySource, v: ViewerContext, today: string): NextAction[] {
  const terms: NextAction = { id: "view_terms", label: `Read the terms (v${o.termsVersion})`, primary: false };
  if (o.status !== "open" || today > o.timeline.closesOn) {
    return [{ id: "none", label: "Applications are closed", hint: o.status === "open" ? `Closed on ${o.timeline.closesOn}` : `This opportunity is ${o.status}`, primary: false }, terms];
  }
  const remaining = o.seats.total - o.seats.taken;
  switch (v.state) {
    case "anonymous":
      return [{ id: "sign_in", label: "Sign in to apply", primary: true }, terms];
    case "signed_in": {
      if (v.profileComplete === false) return [{ id: "complete_profile", label: "Complete your profile to apply", primary: true }, terms];
      if (v.eligible === false) return [{ id: "none", label: "You are not eligible", hint: "Check the prerequisites below.", primary: false }, terms];
      if (remaining > 0) return [{ id: "apply", label: "Apply", primary: true }, terms];
      if (o.seats.waitlistOpen) return [{ id: "join_waitlist", label: "Join the waitlist", primary: true }, terms];
      return [{ id: "none", label: "This opportunity is full", primary: false }, terms];
    }
    case "reserved":
      return [{ id: "confirm_seat", label: "Confirm your seat", hint: "Your offer expires soon.", primary: true }, { id: "withdraw", label: "Withdraw", primary: false }, terms];
    case "applied":
    case "waitlisted":
    case "confirmed":
      return [{ id: "withdraw", label: "Withdraw", primary: false }, terms];
  }
}

export function buildOpportunityDetail(o: OpportunitySource, v: ViewerContext, today: string): OpportunityDetail {
  const detail: OpportunityDetail = {
    id: o.id,
    title: o.title,
    status: o.status,
    problemStatement: o.problemStatement,
    outcomes: [...o.outcomes],
    prerequisites: [...o.prerequisites],
    timeline: { ...o.timeline },
    roles: o.roles.map((r) => ({ ...r })),
    sponsor: !o.sponsor ? null : o.sponsor.disclosed ? { name: o.sponsor.name } : { name: null, note: "Sponsor name is shared on request." },
    termsVersion: o.termsVersion,
    seats: { total: o.seats.total, remaining: Math.max(0, o.seats.total - o.seats.taken), label: seatLabel(o.seats) },
    actions: nextActions(o, v, today),
  };
  if (v.staff) {
    detail.staff = {
      internalNotes: o.internalNotes ?? null,
      reviewerCount: o.reviewerIds?.length ?? 0,
      applicantCount: o.applicantCount ?? null,
      budgetMinor: o.budgetMinor ?? null,
    };
  }
  return detail;
}
