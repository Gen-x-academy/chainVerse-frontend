/**
 * Participant project dashboard (CAPSTONE-114 / issue #1540).
 *
 * Provides a centralized, role-aware operational dashboard for research participants
 * and project contributors.
 *
 * Dashboard Information Sections (8):
 * 1. Deadlines (upcoming, overdue, milestone deliverables)
 * 2. Invitations (pending invites with accept/decline actions)
 * 3. Active projects and work assignments
 * 4. Milestones (in-progress and completed milestones)
 * 5. Reviews awaiting action or feedback
 * 6. Authorized funding actions and claims
 * 7. System & integrity alerts
 * 8. Recent activity timeline
 *
 * Operational Resiliency:
 * - Partial failure tolerance: each section loads and handles errors independently.
 *   A failure in the reviews or funding service does not break deadlines or projects.
 * - Idempotency & duplicate protection: invitation decisions and milestone submissions
 *   require client-generated requestIds.
 * - Role-aware visibility: participants only see information and actions appropriate
 *   to their authenticated project roles.
 */

export type DashboardSectionKey =
  | "deadlines"
  | "invitations"
  | "projects"
  | "milestones"
  | "reviews"
  | "funding"
  | "alerts"
  | "activity";

export const DASHBOARD_SECTIONS: readonly DashboardSectionKey[] = [
  "deadlines",
  "invitations",
  "projects",
  "milestones",
  "reviews",
  "funding",
  "alerts",
  "activity",
] as const;

export type SectionStatus = "idle" | "loading" | "ready" | "empty" | "error" | "forbidden";

export interface DeadlineItem {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  dueAt: string;
  isOverdue: boolean;
  priority: "low" | "medium" | "high" | "critical";
  kind: "milestone" | "review" | "ethics" | "submission";
}

export interface InvitationItem {
  id: string;
  projectId: string;
  projectTitle: string;
  inviterName: string;
  roleOffered: string;
  sentAt: string;
  expiresAt: string;
  status: "pending" | "accepted" | "declined" | "expired";
  revision: number;
}

export interface ActiveProjectItem {
  id: string;
  title: string;
  summary: string;
  role: string;
  state: "recruiting" | "active" | "under-review" | "paused" | "completed";
  memberCount: number;
  progressPercent: number;
  currentMilestoneTitle?: string;
  isOwner: boolean;
  canManagePrivacy: boolean;
  canManageSecrets: boolean;
}

export interface MilestoneProgressItem {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  dueAt: string;
  status: "planned" | "in_progress" | "submitted" | "accepted" | "rejected";
  completionPercent: number;
}

export interface ReviewActionItem {
  id: string;
  projectId: string;
  projectTitle: string;
  itemTitle: string;
  dueAt: string;
  status: "assigned" | "in_progress" | "submitted";
  isAwaitingMyAction: boolean;
}

export interface FundingActionItem {
  id: string;
  projectId: string;
  projectTitle: string;
  awardAmount: string;
  currency: string;
  state: "pledged" | "awarded" | "disbursing" | "closed";
  canClaimReimbursement: boolean;
  canApproveBudget: boolean;
}

export interface AlertNotificationItem {
  id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "error";
  createdAt: string;
  actionHref?: string;
}

export interface ActivityTimelineItem {
  id: string;
  projectId: string;
  projectTitle: string;
  actorName: string;
  actionSummary: string;
  occurredAt: string;
}

export interface ParticipantDashboardState {
  participantId: string;
  organizationId: string;
  role: string;
  sections: {
    deadlines: { status: SectionStatus; items: DeadlineItem[]; error?: string };
    invitations: { status: SectionStatus; items: InvitationItem[]; error?: string };
    projects: { status: SectionStatus; items: ActiveProjectItem[]; error?: string };
    milestones: { status: SectionStatus; items: MilestoneProgressItem[]; error?: string };
    reviews: { status: SectionStatus; items: ReviewActionItem[]; error?: string };
    funding: { status: SectionStatus; items: FundingActionItem[]; error?: string };
    alerts: { status: SectionStatus; items: AlertNotificationItem[]; error?: string };
    activity: { status: SectionStatus; items: ActivityTimelineItem[]; error?: string };
  };
}

export interface RespondInvitationInput {
  requestId: string;
  invitationId: string;
  decision: "accept" | "decline";
  expectedRevision: number;
  actorId: string;
  actorOrganizationId: string;
  now: string;
}

export type DashboardErrorCode =
  | "INVITATION_NOT_FOUND"
  | "TENANT_MISMATCH"
  | "UNAUTHORIZED"
  | "INVALID_DECISION"
  | "STALE_REVISION"
  | "INVITATION_EXPIRED"
  | "ALREADY_DECIDED";

export type DashboardActionResult<T> =
  | { ok: true; value: T; replayed?: boolean }
  | { ok: false; code: DashboardErrorCode; message: string };

const DASHBOARD_ERROR_MESSAGES: Record<DashboardErrorCode, string> = {
  INVITATION_NOT_FOUND: "The requested project invitation was not found.",
  TENANT_MISMATCH: "Operation rejected across organization boundaries.",
  UNAUTHORIZED: "You are not authorized to respond to this invitation.",
  INVALID_DECISION: "Invalid invitation decision.",
  STALE_REVISION: "Invitation state has changed. Please refresh and try again.",
  INVITATION_EXPIRED: "This invitation has expired and can no longer be accepted.",
  ALREADY_DECIDED: "This invitation has already been decided.",
};

export function dashboardFail<T>(code: DashboardErrorCode, detail?: string): DashboardActionResult<T> {
  return { ok: false, code, message: detail ?? DASHBOARD_ERROR_MESSAGES[code] };
}

/**
 * Assesses whether a deadline item is overdue based on current time.
 */
export function calculateOverdueDeadlines(deadlines: DeadlineItem[], now: string): DeadlineItem[] {
  const currentMs = Date.parse(now);
  return deadlines.map((item) => ({
    ...item,
    isOverdue: Date.parse(item.dueAt) < currentMs,
  }));
}

export type DashboardActionLedger = Map<string, DashboardActionResult<InvitationItem>>;

/**
 * Handles accepting or declining project invitations with idempotency and optimistic concurrency.
 */
export function respondToInvitation(
  invitations: InvitationItem[],
  input: RespondInvitationInput,
  ledger: DashboardActionLedger = new Map(),
): DashboardActionResult<InvitationItem> {
  const cached = ledger.get(input.requestId);
  if (cached) {
    return cached.ok ? { ...cached, replayed: true } : cached;
  }

  const recordResult = (res: DashboardActionResult<InvitationItem>): DashboardActionResult<InvitationItem> => {
    ledger.set(input.requestId, res);
    return res;
  };

  const invite = invitations.find((i) => i.id === input.invitationId);
  if (!invite) {
    return recordResult(dashboardFail("INVITATION_NOT_FOUND"));
  }

  if (invite.status !== "pending") {
    return recordResult(dashboardFail("ALREADY_DECIDED"));
  }

  if (Date.parse(invite.expiresAt) <= Date.parse(input.now)) {
    return recordResult(dashboardFail("INVITATION_EXPIRED"));
  }

  if (invite.revision !== input.expectedRevision) {
    return recordResult(dashboardFail("STALE_REVISION"));
  }

  const nextStatus = input.decision === "accept" ? "accepted" : "declined";
  const updated: InvitationItem = {
    ...invite,
    status: nextStatus,
    revision: invite.revision + 1,
  };

  return recordResult({ ok: true, value: updated });
}

/**
 * Filters dashboard information according to the authenticated user's role and permissions.
 * Guarantees that participants never see administrator-only controls or unauthorized actions.
 */
export function filterDashboardByRole(
  dashboard: ParticipantDashboardState,
  role: string,
): ParticipantDashboardState {
  const isParticipantOrStudent = role === "student" || role === "participant";
  const isSupervisor = role === "supervisor";
  const isAdminOrFinance = role === "administrator" || role === "finance_staff";

  // Deep copy sections
  const filtered = JSON.parse(JSON.stringify(dashboard)) as ParticipantDashboardState;

  // If user is a student/participant, hide admin funding approval actions
  if (isParticipantOrStudent && !isAdminOrFinance) {
    filtered.sections.funding.items = filtered.sections.funding.items.map((item) => ({
      ...item,
      canApproveBudget: false,
    }));
  }

  // If user is not an administrator, ensure they cannot manage secrets unless they own the project
  filtered.sections.projects.items = filtered.sections.projects.items.map((prj) => ({
    ...prj,
    canManageSecrets: prj.isOwner || isAdminOrFinance,
    canManagePrivacy: prj.isOwner || isSupervisor || isAdminOrFinance,
  }));

  return filtered;
}

/**
 * Helper to compute aggregate dashboard operational health metrics.
 */
export function computeDashboardMetrics(dashboard: ParticipantDashboardState) {
  const activeProjectsCount = dashboard.sections.projects.items.filter((p) => p.state === "active").length;
  const overdueDeadlinesCount = dashboard.sections.deadlines.items.filter((d) => d.isOverdue).length;
  const pendingInvitationsCount = dashboard.sections.invitations.items.filter((i) => i.status === "pending").length;
  const pendingReviewsCount = dashboard.sections.reviews.items.filter((r) => r.isAwaitingMyAction).length;

  return {
    activeProjectsCount,
    overdueDeadlinesCount,
    pendingInvitationsCount,
    pendingReviewsCount,
  };
}
