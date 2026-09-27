import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SponsorTeamManager } from '@/src/features/scholarships/sponsors/components/SponsorTeamManager';
import { AcceptInvitationView } from '@/src/features/scholarships/sponsors/components/AcceptInvitationView';
import { sponsorTeamService } from '@/src/features/scholarships/sponsors/service';
import {
  mockAuditEvents,
  mockInvitations,
  mockTeamMembers,
} from '@/src/features/scholarships/sponsors/fixtures';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('SponsorTeamManager & Invitations — UI States & Accessibility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  /* -------------------------------------------------------------------------- */
  /* 1. Loading State                                                           */
  /* -------------------------------------------------------------------------- */
  describe('1. Loading State', () => {
    it('renders accessible loading skeleton with aria-busy="true"', () => {
      vi.spyOn(sponsorTeamService, 'listMembers').mockImplementation(
        () => new Promise(() => {}) // never resolves to keep loading state
      );
      vi.spyOn(sponsorTeamService, 'listInvitations').mockImplementation(
        () => new Promise(() => {})
      );

      renderWithClient(<SponsorTeamManager currentUserRole="owner" />);

      const loadingStatus = screen.getByRole('status', { name: /loading team members/i });
      expect(loadingStatus).toBeInTheDocument();
      expect(loadingStatus).toHaveAttribute('aria-busy', 'true');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 2. Empty State                                                             */
  /* -------------------------------------------------------------------------- */
  describe('2. Empty State', () => {
    it('renders accessible empty state when no team members exist or match filters', async () => {
      vi.spyOn(sponsorTeamService, 'listMembers').mockResolvedValue([]);
      vi.spyOn(sponsorTeamService, 'listInvitations').mockResolvedValue([]);
      vi.spyOn(sponsorTeamService, 'listAuditEvents').mockResolvedValue([]);

      renderWithClient(<SponsorTeamManager currentUserRole="owner" />);

      await waitFor(() => {
        expect(screen.getByText(/no team members found/i)).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /invite first member/i })).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 3. Error State                                                             */
  /* -------------------------------------------------------------------------- */
  describe('3. Error State', () => {
    it('renders role="alert" with message and a retry button on fetch failure', async () => {
      vi.spyOn(sponsorTeamService, 'listMembers').mockRejectedValue(
        new Error('Failed to reach sponsor service')
      );
      vi.spyOn(sponsorTeamService, 'listInvitations').mockResolvedValue([]);
      vi.spyOn(sponsorTeamService, 'listAuditEvents').mockResolvedValue([]);

      renderWithClient(<SponsorTeamManager currentUserRole="owner" />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(screen.getByText(/failed to load team members/i)).toBeInTheDocument();
      expect(screen.getByText(/failed to reach sponsor service/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 4. Success State & Tab Navigation                                         */
  /* -------------------------------------------------------------------------- */
  describe('4. Success State & Tab Navigation', () => {
    it('renders team members table with roles and allows navigating to invitations and audit tabs', async () => {
      vi.spyOn(sponsorTeamService, 'listMembers').mockResolvedValue(mockTeamMembers);
      vi.spyOn(sponsorTeamService, 'listInvitations').mockResolvedValue(mockInvitations);
      vi.spyOn(sponsorTeamService, 'listAuditEvents').mockResolvedValue(mockAuditEvents);

      renderWithClient(<SponsorTeamManager currentUserRole="owner" />);

      await waitFor(() => {
        expect(screen.getByText('Elena Rostova')).toBeInTheDocument();
        expect(screen.getByText('Marcus Vance')).toBeInTheDocument();
        expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
      });

      // Verify role badges
      expect(screen.getAllByText('Finance Manager').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Program Manager').length).toBeGreaterThan(0);

      // Switch to Invitations tab
      const invitationsTab = screen.getByRole('button', { name: /invitations/i });
      fireEvent.click(invitationsTab);

      await waitFor(() => {
        expect(screen.getByText('jordan.lee@finpartners.com')).toBeInTheDocument();
        expect(screen.getByText('dara.okonkwo@africanacad.edu')).toBeInTheDocument();
      });

      // Switch to Audit Trail tab
      const auditTab = screen.getByRole('button', { name: /audit trail/i });
      fireEvent.click(auditTab);

      await waitFor(() => {
        expect(screen.getByText(/team.member_role_updated/i)).toBeInTheDocument();
        expect(screen.getByText(/Role transition: reviewer → program/i)).toBeInTheDocument();
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 5. Responsive State                                                        */
  /* -------------------------------------------------------------------------- */
  describe('5. Responsive State', () => {
    it('applies responsive grid and horizontal scroll container classes', async () => {
      vi.spyOn(sponsorTeamService, 'listMembers').mockResolvedValue(mockTeamMembers);
      vi.spyOn(sponsorTeamService, 'listInvitations').mockResolvedValue(mockInvitations);
      vi.spyOn(sponsorTeamService, 'listAuditEvents').mockResolvedValue(mockAuditEvents);

      const { container } = renderWithClient(<SponsorTeamManager currentUserRole="owner" />);

      await waitFor(() => {
        expect(screen.getByText('Elena Rostova')).toBeInTheDocument();
      });

      // Role cards responsive grid
      const grid = container.querySelector('.grid.gap-3');
      expect(grid).toHaveClass('sm:grid-cols-2');
      expect(grid).toHaveClass('lg:grid-cols-4');

      // Table responsive container
      const tableWrapper = container.querySelector('.overflow-x-auto');
      expect(tableWrapper).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 6. Keyboard Navigation                                                     */
  /* -------------------------------------------------------------------------- */
  describe('6. Keyboard Navigation', () => {
    it('opens Invite Member modal and closes it upon pressing Escape key', async () => {
      vi.spyOn(sponsorTeamService, 'listMembers').mockResolvedValue(mockTeamMembers);
      vi.spyOn(sponsorTeamService, 'listInvitations').mockResolvedValue(mockInvitations);
      vi.spyOn(sponsorTeamService, 'listAuditEvents').mockResolvedValue(mockAuditEvents);

      renderWithClient(<SponsorTeamManager currentUserRole="owner" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /invite member/i })).toBeInTheDocument();
      });

      // Click Invite Member
      fireEvent.click(screen.getByRole('button', { name: /invite member/i }));

      // Dialog is open
      const dialog = screen.getByRole('dialog', { name: /invite team member/i });
      expect(dialog).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('opens Change Role modal and closes it upon pressing Escape key', async () => {
      vi.spyOn(sponsorTeamService, 'listMembers').mockResolvedValue(mockTeamMembers);
      vi.spyOn(sponsorTeamService, 'listInvitations').mockResolvedValue(mockInvitations);
      vi.spyOn(sponsorTeamService, 'listAuditEvents').mockResolvedValue(mockAuditEvents);

      renderWithClient(<SponsorTeamManager currentUserRole="owner" />);

      await waitFor(() => {
        expect(screen.getByText('Elena Rostova')).toBeInTheDocument();
      });

      // Click Change Role on a member
      const changeRoleButtons = screen.getAllByRole('button', { name: /change role/i });
      fireEvent.click(changeRoleButtons[0]);

      expect(screen.getByRole('dialog', { name: /change team role/i })).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 7. Screen-Reader Accessibility & ARIA                                      */
  /* -------------------------------------------------------------------------- */
  describe('7. Screen-Reader Accessibility & ARIA', () => {
    it('includes polite live region, table column scopes, and accessible labels', async () => {
      vi.spyOn(sponsorTeamService, 'listMembers').mockResolvedValue(mockTeamMembers);
      vi.spyOn(sponsorTeamService, 'listInvitations').mockResolvedValue(mockInvitations);
      vi.spyOn(sponsorTeamService, 'listAuditEvents').mockResolvedValue(mockAuditEvents);

      renderWithClient(<SponsorTeamManager currentUserRole="owner" />);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Polite live region
      const liveRegion = screen.getByRole('status', { name: '' });
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');

      // Table headers have scope="col"
      const columnHeaders = screen.getAllByRole('columnheader');
      expect(columnHeaders.length).toBeGreaterThanOrEqual(4);
      expect(columnHeaders[0]).toHaveAttribute('scope', 'col');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 8. Permission States (Least-Privilege & Removed Member Loss)                */
  /* -------------------------------------------------------------------------- */
  describe('8. Permission States', () => {
    it('displays full actions for sponsor owners and locks actions for non-owners', async () => {
      vi.spyOn(sponsorTeamService, 'listMembers').mockResolvedValue(mockTeamMembers);
      vi.spyOn(sponsorTeamService, 'listInvitations').mockResolvedValue(mockInvitations);
      vi.spyOn(sponsorTeamService, 'listAuditEvents').mockResolvedValue(mockAuditEvents);

      // Render as Reviewer (non-owner)
      const { rerender } = renderWithClient(<SponsorTeamManager currentUserRole="reviewer" />);

      await waitFor(() => {
        expect(screen.getByText('Elena Rostova')).toBeInTheDocument();
      });

      // Reviewer cannot invite members
      expect(screen.queryByRole('button', { name: /invite member/i })).not.toBeInTheDocument();
      expect(screen.getByText(/view-only permissions/i)).toBeInTheDocument();

      // Reviewer cannot change roles or remove members
      expect(screen.queryByRole('button', { name: /change role/i })).not.toBeInTheDocument();

      // Now rerender as Owner
      rerender(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <SponsorTeamManager currentUserRole="owner" />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /invite member/i })).toBeInTheDocument();
      });
    });

    it('indicates that removed members have lost access immediately', async () => {
      vi.spyOn(sponsorTeamService, 'listMembers').mockResolvedValue(mockTeamMembers);
      vi.spyOn(sponsorTeamService, 'listInvitations').mockResolvedValue(mockInvitations);
      vi.spyOn(sponsorTeamService, 'listAuditEvents').mockResolvedValue(mockAuditEvents);

      renderWithClient(<SponsorTeamManager currentUserRole="owner" />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // John Doe was removed
      expect(screen.getByText(/Removed \(Access Denied\)/i)).toBeInTheDocument();
      expect(screen.getByText(/No access/i)).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 9. Accept Invitation User Journey                                          */
  /* -------------------------------------------------------------------------- */
  describe('9. Accept Invitation Journey (AcceptInvitationView)', () => {
    it('shows loading status while validating token', () => {
      vi.spyOn(sponsorTeamService, 'validateInvitationToken').mockImplementation(
        () => new Promise(() => {}) // never resolves
      );

      renderWithClient(<AcceptInvitationView token="pending-tok-123" />);

      expect(screen.getByRole('status', { name: /validating your sponsor invitation/i })).toBeInTheDocument();
    });

    it('displays error message when token has expired', async () => {
      vi.spyOn(sponsorTeamService, 'validateInvitationToken').mockResolvedValue({
        valid: false,
        reason: 'EXPIRED',
      });

      renderWithClient(<AcceptInvitationView token="expired-tok-456" />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(screen.getByText(/invitation has expired/i)).toBeInTheDocument();
    });

    it('displays error message when token has already been consumed (single-use enforcement)', async () => {
      vi.spyOn(sponsorTeamService, 'validateInvitationToken').mockResolvedValue({
        valid: false,
        reason: 'ALREADY_CONSUMED',
      });

      renderWithClient(<AcceptInvitationView token="consumed-tok-789" />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(screen.getByText(/invitation already used/i)).toBeInTheDocument();
      expect(screen.getByText(/strictly single-use to prevent replay abuse/i)).toBeInTheDocument();
    });

    it('displays invitation details and allows accepting valid token', async () => {
      vi.spyOn(sponsorTeamService, 'validateInvitationToken').mockResolvedValue({
        valid: true,
        invitation: mockInvitations[0], // Jordan Lee, Finance role
      });
      const acceptSpy = vi.spyOn(sponsorTeamService, 'acceptInvitation').mockResolvedValue({
        invitation: { ...mockInvitations[0], status: 'accepted', consumedAt: '2026-09-27T12:00:00.000Z' },
        member: mockTeamMembers[1],
      });

      renderWithClient(
        <AcceptInvitationView
          token="valid-tok-123"
          currentUser={{ id: 'user-jordan', email: 'jordan.lee@finpartners.com', name: 'Jordan Lee' }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/sponsor team invitation/i)).toBeInTheDocument();
        expect(screen.getByText('jordan.lee@finpartners.com')).toBeInTheDocument();
      });

      // Role badge and least privilege scope
      expect(screen.getByText('Finance Manager')).toBeInTheDocument();

      // Click Accept button
      const acceptButton = screen.getByRole('button', { name: /accept invitation & join team/i });
      fireEvent.click(acceptButton);

      await waitFor(() => {
        expect(acceptSpy).toHaveBeenCalledWith({
          token: 'valid-tok-123',
          userId: 'user-jordan',
          email: 'jordan.lee@finpartners.com',
          name: 'Jordan Lee',
        });
        expect(screen.getByText(/welcome to the team!/i)).toBeInTheDocument();
      });
    });
  });
});
