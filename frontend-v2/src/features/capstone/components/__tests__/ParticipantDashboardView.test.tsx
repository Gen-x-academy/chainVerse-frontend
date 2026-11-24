import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ParticipantDashboardView } from '../ParticipantDashboardView';
import type { ParticipantDashboardState } from '../../participant-dashboard';

describe('ParticipantDashboardView (CAPSTONE-114)', () => {
  const mockDashboard: ParticipantDashboardState = {
    participantId: 'usr_student_1',
    organizationId: 'org_acme',
    role: 'student',
    sections: {
      deadlines: {
        status: 'ready',
        items: [
          {
            id: 'dl_1',
            projectId: 'prj_1',
            projectTitle: 'Decentralized Research Ledger',
            title: 'Milestone 2 Deliverable',
            dueAt: '2026-11-19T00:00:00.000Z',
            isOverdue: true,
            priority: 'high',
            kind: 'milestone',
          },
        ],
      },
      invitations: {
        status: 'ready',
        items: [
          {
            id: 'inv_1',
            projectId: 'prj_2',
            projectTitle: 'Zero-Knowledge Privacy',
            inviterName: 'Dr. Jane Vance',
            roleOffered: 'Core Researcher',
            sentAt: '2026-11-15T00:00:00.000Z',
            expiresAt: '2026-11-30T00:00:00.000Z',
            status: 'pending',
            revision: 1,
          },
        ],
      },
      projects: {
        status: 'ready',
        items: [
          {
            id: 'prj_1',
            title: 'Decentralized Research Ledger',
            summary: 'Verifiable audit trails and privacy-preserving consent.',
            role: 'Lead Contributor',
            state: 'active',
            memberCount: 4,
            progressPercent: 60,
            isOwner: true,
            canManagePrivacy: true,
            canManageSecrets: true,
          },
        ],
      },
      milestones: {
        status: 'ready',
        items: [
          {
            id: 'mil_1',
            projectId: 'prj_1',
            projectTitle: 'Decentralized Research Ledger',
            title: 'Milestone 2: Architecture Specification',
            dueAt: '2026-11-28T00:00:00.000Z',
            status: 'in_progress',
            completionPercent: 60,
          },
        ],
      },
      reviews: {
        status: 'ready',
        items: [
          {
            id: 'rev_1',
            projectId: 'prj_1',
            projectTitle: 'Decentralized Research Ledger',
            itemTitle: 'Ethics Screening Protocol',
            dueAt: '2026-11-26T00:00:00.000Z',
            status: 'assigned',
            isAwaitingMyAction: true,
          },
        ],
      },
      funding: {
        status: 'ready',
        items: [
          {
            id: 'fnd_1',
            projectId: 'prj_1',
            projectTitle: 'Decentralized Research Ledger',
            awardAmount: '12500',
            currency: 'USDC',
            state: 'awarded',
            canClaimReimbursement: true,
            canApproveBudget: false,
          },
        ],
      },
      alerts: {
        status: 'ready',
        items: [
          {
            id: 'alt_1',
            title: 'Milestone Due Soon',
            message: 'Milestone 2 is due in 3 days.',
            severity: 'info',
            createdAt: '2026-11-20T12:00:00.000Z',
          },
        ],
      },
      activity: {
        status: 'ready',
        items: [
          {
            id: 'act_1',
            projectId: 'prj_1',
            projectTitle: 'Decentralized Research Ledger',
            actorName: 'usr_student_1',
            actionSummary: 'Updated field-level privacy settings',
            occurredAt: '2026-11-20T12:00:00.000Z',
          },
        ],
      },
    },
  };

  it('renders all eight operational dashboard sections and metrics cards', () => {
    render(<ParticipantDashboardView initialDashboard={mockDashboard} />);

    expect(screen.getByRole('heading', { name: /Participant Project Dashboard/i })).toBeInTheDocument();

    // Metric cards
    expect(screen.getAllByText(/Active Projects/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Overdue Items/i)).toBeInTheDocument();
    expect(screen.getByText(/Pending Invitations/i)).toBeInTheDocument();
    expect(screen.getByText(/Reviews Assigned/i)).toBeInTheDocument();

    // Section headings
    expect(screen.getByRole('heading', { name: /Active Projects & Work/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Upcoming Deadlines & Milestones/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Invitations/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Assigned Milestones/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Reviews & Feedback/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Funding & Expenses/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Recent Activity/i })).toBeInTheDocument();

    // Overdue badge
    expect(screen.getAllByText(/Overdue/i).length).toBeGreaterThan(0);
  });

  it('allows accepting a pending project invitation', async () => {
    const onInvitationResponded = vi.fn();
    render(
      <ParticipantDashboardView
        initialDashboard={mockDashboard}
        onInvitationResponded={onInvitationResponded}
      />
    );

    const acceptBtn = screen.getByRole('button', { name: /Accept/i });
    await userEvent.click(acceptBtn);

    await waitFor(() => {
      expect(screen.getByText(/Invitation to 'Zero-Knowledge Privacy' was accepted/i)).toBeInTheDocument();
      expect(onInvitationResponded).toHaveBeenCalled();
    });
  });

  it('tolerates partial API failure in one section while rendering other sections', () => {
    const partialDashboard: ParticipantDashboardState = {
      ...mockDashboard,
      sections: {
        ...mockDashboard.sections,
        deadlines: {
          status: 'error',
          items: [],
          error: 'Deadlines service timeout (HTTP 504)',
        },
      },
    };

    render(<ParticipantDashboardView initialDashboard={partialDashboard} />);

    // Error banner in Deadlines section
    expect(screen.getByText(/Deadlines service timeout/i)).toBeInTheDocument();

    // Projects, Invitations, Milestones, and Reviews still render properly!
    expect(screen.getAllByText(/Decentralized Research Ledger/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Zero-Knowledge Privacy/i)).toBeInTheDocument();
  });
});
