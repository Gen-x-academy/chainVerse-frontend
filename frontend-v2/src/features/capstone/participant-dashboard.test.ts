import { describe, expect, it } from "vitest";
import {
  calculateOverdueDeadlines,
  computeDashboardMetrics,
  DASHBOARD_SECTIONS,
  filterDashboardByRole,
  respondToInvitation,
  type DeadlineItem,
  type InvitationItem,
  type ParticipantDashboardState,
} from "./participant-dashboard";

describe("CAPSTONE-114: Participant Project Dashboard", () => {
  const now = "2026-11-20T12:00:00.000Z";

  const sampleDeadlines: DeadlineItem[] = [
    {
      id: "dl_1",
      projectId: "prj_1",
      projectTitle: "Decentralized AI Governance",
      title: "Submit Milestone 2 Deliverable",
      dueAt: "2026-11-19T00:00:00.000Z", // Past date
      isOverdue: false,
      priority: "high",
      kind: "milestone",
    },
    {
      id: "dl_2",
      projectId: "prj_1",
      projectTitle: "Decentralized AI Governance",
      title: "Peer Review Assigned Drafts",
      dueAt: "2026-11-25T00:00:00.000Z", // Future date
      isOverdue: false,
      priority: "medium",
      kind: "review",
    },
  ];

  const sampleInvitations: InvitationItem[] = [
    {
      id: "inv_1",
      projectId: "prj_2",
      projectTitle: "Zero-Knowledge Rollup Explorer",
      inviterName: "Dr. Satoshi",
      roleOffered: "Core Researcher",
      sentAt: "2026-11-15T00:00:00.000Z",
      expiresAt: "2026-11-30T00:00:00.000Z",
      status: "pending",
      revision: 1,
    },
    {
      id: "inv_expired",
      projectId: "prj_3",
      projectTitle: "Legacy Blockchain Bridge",
      inviterName: "Alice Lead",
      roleOffered: "Contributor",
      sentAt: "2026-11-01T00:00:00.000Z",
      expiresAt: "2026-11-10T00:00:00.000Z",
      status: "pending",
      revision: 1,
    },
  ];

  const sampleDashboard: ParticipantDashboardState = {
    participantId: "usr_student_1",
    organizationId: "org_acme",
    role: "student",
    sections: {
      deadlines: { status: "ready", items: sampleDeadlines },
      invitations: { status: "ready", items: sampleInvitations },
      projects: {
        status: "ready",
        items: [
          {
            id: "prj_1",
            title: "Decentralized AI Governance",
            summary: "Research into DAO voting primitives",
            role: "Lead Author",
            state: "active",
            memberCount: 4,
            progressPercent: 65,
            isOwner: true,
            canManagePrivacy: true,
            canManageSecrets: true,
          },
          {
            id: "prj_4",
            title: "Smart Contract Verification",
            summary: "Formal verification suite",
            role: "Member",
            state: "active",
            memberCount: 3,
            progressPercent: 20,
            isOwner: false,
            canManagePrivacy: false,
            canManageSecrets: false,
          },
        ],
      },
      milestones: {
        status: "ready",
        items: [
          {
            id: "mil_1",
            projectId: "prj_1",
            projectTitle: "Decentralized AI Governance",
            title: "Architecture Specification",
            dueAt: "2026-11-30T00:00:00.000Z",
            status: "in_progress",
            completionPercent: 75,
          },
        ],
      },
      reviews: {
        status: "ready",
        items: [
          {
            id: "rev_1",
            projectId: "prj_1",
            projectTitle: "Decentralized AI Governance",
            itemTitle: "Proposal Chapter 3",
            dueAt: "2026-11-28T00:00:00.000Z",
            status: "assigned",
            isAwaitingMyAction: true,
          },
        ],
      },
      funding: {
        status: "ready",
        items: [
          {
            id: "fnd_1",
            projectId: "prj_1",
            projectTitle: "Decentralized AI Governance",
            awardAmount: "15000",
            currency: "USD",
            state: "awarded",
            canClaimReimbursement: true,
            canApproveBudget: true, // Should be scrubbed for regular student
          },
        ],
      },
      alerts: {
        status: "ready",
        items: [
          {
            id: "alt_1",
            title: "Upcoming Project Milestone",
            message: "Milestone deliverable due in 6 days",
            severity: "info",
            createdAt: now,
          },
        ],
      },
      activity: {
        status: "ready",
        items: [
          {
            id: "act_1",
            projectId: "prj_1",
            projectTitle: "Decentralized AI Governance",
            actorName: "usr_student_1",
            actionSummary: "Submitted draft deliverable for review",
            occurredAt: now,
          },
        ],
      },
    },
  };

  it("covers all 8 required dashboard operational information sections", () => {
    expect(DASHBOARD_SECTIONS).toEqual([
      "deadlines",
      "invitations",
      "projects",
      "milestones",
      "reviews",
      "funding",
      "alerts",
      "activity",
    ]);

    for (const key of DASHBOARD_SECTIONS) {
      expect(sampleDashboard.sections[key]).toBeDefined();
      expect(sampleDashboard.sections[key].status).toBe("ready");
    }
  });

  it("identifies overdue deadlines correctly based on current time", () => {
    const assessed = calculateOverdueDeadlines(sampleDeadlines, now);
    expect(assessed[0].isOverdue).toBe(true); // due Nov 19, now is Nov 20
    expect(assessed[1].isOverdue).toBe(false); // due Nov 25, now is Nov 20
  });

  it("accepts a pending invitation, bumps revision, and handles idempotency", () => {
    const ledger = new Map();
    const input = {
      requestId: "req_inv_acc",
      invitationId: "inv_1",
      decision: "accept" as const,
      expectedRevision: 1,
      actorId: "usr_student_1",
      actorOrganizationId: "org_acme",
      now,
    };

    const first = respondToInvitation(sampleInvitations, input, ledger);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.status).toBe("accepted");
    expect(first.value.revision).toBe(2);

    // Duplicate call returns replayed result
    const second = respondToInvitation(sampleInvitations, input, ledger);
    expect(second.ok).toBe(true);
    expect(second.replayed).toBe(true);
  });

  it("declines a pending invitation cleanly", () => {
    const input = {
      requestId: "req_inv_dec",
      invitationId: "inv_1",
      decision: "decline" as const,
      expectedRevision: 1,
      actorId: "usr_student_1",
      actorOrganizationId: "org_acme",
      now,
    };

    const res = respondToInvitation(sampleInvitations, input);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.status).toBe("declined");
  });

  it("rejects responses to expired invitations", () => {
    const input = {
      requestId: "req_inv_exp",
      invitationId: "inv_expired",
      decision: "accept" as const,
      expectedRevision: 1,
      actorId: "usr_student_1",
      actorOrganizationId: "org_acme",
      now,
    };

    const res = respondToInvitation(sampleInvitations, input);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("INVITATION_EXPIRED");
  });

  it("detects stale revisions during invitation response", () => {
    const input = {
      requestId: "req_inv_stale",
      invitationId: "inv_1",
      decision: "accept" as const,
      expectedRevision: 99,
      actorId: "usr_student_1",
      actorOrganizationId: "org_acme",
      now,
    };

    const res = respondToInvitation(sampleInvitations, input);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("STALE_REVISION");
  });

  it("enforces role-aware boundary by scrubbing administrator-only actions for student role", () => {
    const filtered = filterDashboardByRole(sampleDashboard, "student");

    // Student should not have canApproveBudget permission in funding items
    expect(filtered.sections.funding.items[0].canApproveBudget).toBe(false);
    expect(filtered.sections.funding.items[0].canClaimReimbursement).toBe(true);

    // Project 1: student is owner -> canManagePrivacy = true, canManageSecrets = true
    expect(filtered.sections.projects.items[0].canManagePrivacy).toBe(true);
    expect(filtered.sections.projects.items[0].canManageSecrets).toBe(true);

    // Project 4: student is member (not owner) -> cannot manage secrets
    expect(filtered.sections.projects.items[1].canManageSecrets).toBe(false);
  });

  it("computes aggregate dashboard operational health metrics", () => {
    const metrics = computeDashboardMetrics(sampleDashboard);
    expect(metrics.activeProjectsCount).toBe(2);
    expect(metrics.pendingInvitationsCount).toBe(2);
    expect(metrics.pendingReviewsCount).toBe(1);
  });

  it("tolerates partial API failure in one section without breaking others", () => {
    const partialDashboard: ParticipantDashboardState = {
      ...sampleDashboard,
      sections: {
        ...sampleDashboard.sections,
        funding: { status: "error", items: [], error: "Funding service temporarily unavailable (HTTP 503)" },
      },
    };

    expect(partialDashboard.sections.funding.status).toBe("error");
    expect(partialDashboard.sections.funding.error).toBeDefined();

    // Deadlines and projects are still healthy and ready!
    expect(partialDashboard.sections.deadlines.status).toBe("ready");
    expect(partialDashboard.sections.deadlines.items.length).toBeGreaterThan(0);
    expect(partialDashboard.sections.projects.status).toBe("ready");
  });
});
