import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SponsorProfileManager } from '@/src/features/scholarships/sponsors/components/SponsorProfileManager';
import { SponsorOrganizationDirectory } from '@/src/features/scholarships/sponsors/components/SponsorOrganizationDirectory';
import { CreateSponsorOrgForm } from '@/src/features/scholarships/sponsors/components/CreateSponsorOrgForm';
import { PrivateContactsCard } from '@/src/features/scholarships/sponsors/components/PrivateContactsCard';
import { ComplianceDocumentsPanel } from '@/src/features/scholarships/sponsors/components/ComplianceDocumentsPanel';
import { useSponsorOrgStore } from '@/src/features/scholarships/sponsors/orgStore';
import { sponsorOrgService } from '@/src/features/scholarships/sponsors/service';
import {
  mockSponsorOrg,
  mockUnverifiedSponsorOrg,
  mockPendingSponsorOrg,
  mockPublicSponsorProfile,
} from '@/src/features/scholarships/testing/fixtures/sponsors';

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

describe('Sponsor Organizations & Verified Profiles Components — UI States & Accessibility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useSponsorOrgStore.getState().reset();
  });

  /* -------------------------------------------------------------------------- */
  /* 1. Loading State                                                           */
  /* -------------------------------------------------------------------------- */
  describe('1. Loading State', () => {
    it('renders accessible loading skeleton with role="status" and aria-busy="true"', () => {
      useSponsorOrgStore.setState({ isLoading: true, activeOrg: null });

      renderWithClient(<SponsorProfileManager sponsorId="sponsor-stellar-impact" />);

      const loadingStatus = screen.getByRole('status');
      expect(loadingStatus).toBeInTheDocument();
      expect(loadingStatus).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByText(/loading sponsor profile\.\.\./i)).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 2. Empty State                                                             */
  /* -------------------------------------------------------------------------- */
  describe('2. Empty State', () => {
    it('renders accessible empty status when no organizations match directory filters', async () => {
      vi.spyOn(sponsorOrgService, 'listOrganizations').mockResolvedValue([]);

      renderWithClient(<SponsorOrganizationDirectory />);

      await waitFor(() => {
        expect(screen.getByText(/no organizations found/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/try adjusting your search terms/i)).toBeInTheDocument();
    });

    it('renders accessible empty status in ComplianceDocumentsPanel when 0 documents exist', () => {
      renderWithClient(
        <ComplianceDocumentsPanel documents={[]} isAuthorized={true} />
      );

      expect(screen.getByText(/no compliance documents submitted yet/i)).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 3. Error State                                                             */
  /* -------------------------------------------------------------------------- */
  describe('3. Error State', () => {
    it('renders dismissible role="alert" when store error is set', () => {
      useSponsorOrgStore.setState({
        activeOrg: mockSponsorOrg,
        isLoading: false,
        error: 'Failed to synchronize organization credentials with compliance registry.',
      });

      renderWithClient(
        <SponsorProfileManager
          sponsorId={mockSponsorOrg.id}
          currentUser={{
            userId: 'user-elena-owner',
            email: 'elena.rostova@stellarimpact.org',
            tenantId: 'tenant-stellar-global',
            role: 'owner',
          }}
        />
      );

      const alertBanner = screen.getByRole('alert');
      expect(alertBanner).toBeInTheDocument();
      expect(
        screen.getByText(/failed to synchronize organization credentials/i)
      ).toBeInTheDocument();

      const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(dismissBtn);

      expect(useSponsorOrgStore.getState().error).toBeNull();
    });

    it('renders validation alert when submitting empty required fields in CreateSponsorOrgForm', () => {
      renderWithClient(
        <CreateSponsorOrgForm
          tenantId="tenant-test"
          userEmail="test@test.org"
          onSubmit={vi.fn()}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /create sponsor organization/i });
      fireEvent.click(submitBtn);

      const alertBanner = screen.getByRole('alert');
      expect(alertBanner).toBeInTheDocument();
      expect(screen.getByText(/organization display name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/official legal entity name is required/i)).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 4. Success State & Profile Rendering                                       */
  /* -------------------------------------------------------------------------- */
  describe('4. Success State & Profile Journey', () => {
    it('renders verified organization profile with branding, badges, and tab navigation', async () => {
      useSponsorOrgStore.setState({
        activeOrg: mockSponsorOrg,
        isLoading: false,
      });

      renderWithClient(
        <SponsorProfileManager
          sponsorId={mockSponsorOrg.id}
          currentUser={{
            userId: 'user-elena-owner',
            email: 'elena.rostova@stellarimpact.org',
            tenantId: 'tenant-stellar-global',
            role: 'owner',
          }}
        />
      );

      // Verify title & badges
      expect(screen.getByText(mockSponsorOrg.name)).toBeInTheDocument();
      expect(screen.getByText(/verified sponsor/i)).toBeInTheDocument();
      expect(screen.getByText(/tier 2 enhanced/i)).toBeInTheDocument();

      // Overview Tab (default)
      expect(screen.getByText(/about the organization/i)).toBeInTheDocument();
      expect(screen.getByText(mockSponsorOrg.branding!.bio!)).toBeInTheDocument();

      // Switch to Compliance Tab
      const complianceTab = screen.getByRole('button', { name: /compliance documents/i });
      fireEvent.click(complianceTab);

      expect(screen.getByText(/delaware certificate of incorporation/i)).toBeInTheDocument();
      expect(screen.getByText(/irs 501\(c\)\(3\) determination letter/i)).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 5. Responsive State                                                        */
  /* -------------------------------------------------------------------------- */
  describe('5. Responsive State', () => {
    it('applies responsive classes in PrivateContactsCard and CreateSponsorOrgForm', () => {
      const { container } = renderWithClient(
        <PrivateContactsCard
          privateContacts={mockSponsorOrg.privateContacts}
          isAuthorized={true}
          tenantId={mockSponsorOrg.tenantId}
        />
      );

      const grid = container.querySelector('.grid.gap-4.sm\\:grid-cols-3');
      expect(grid).toBeInTheDocument();
    });

    it('applies responsive multi-column layouts to CreateSponsorOrgForm sections', () => {
      const { container } = renderWithClient(
        <CreateSponsorOrgForm
          tenantId="tenant-test"
          userEmail="admin@chainverse.org"
          onSubmit={vi.fn()}
        />
      );

      const gridSections = container.querySelectorAll('.grid.gap-4.sm\\:grid-cols-2');
      expect(gridSections.length).toBeGreaterThanOrEqual(2);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 6. Keyboard Navigation                                                     */
  /* -------------------------------------------------------------------------- */
  describe('6. Keyboard Navigation & Interaction', () => {
    it('allows opening upload credential drawer and submitting via buttons', () => {
      const uploadMock = vi.fn().mockResolvedValue(true);

      renderWithClient(
        <ComplianceDocumentsPanel
          documents={[]}
          isAuthorized={true}
          onUploadDocument={uploadMock}
        />
      );

      const uploadBtn = screen.getByRole('button', { name: /upload credential/i });
      fireEvent.click(uploadBtn);

      const titleInput = screen.getByLabelText(/document title/i);
      fireEvent.change(titleInput, { target: { value: 'Bank Letter 2026' } });

      const fileInput = screen.getByLabelText(/file name \/ upload reference/i);
      fireEvent.change(fileInput, { target: { value: 'bank_letter.pdf' } });

      const submitBtn = screen.getByRole('button', { name: /upload & encrypt/i });
      fireEvent.click(submitBtn);

      expect(uploadMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Bank Letter 2026',
          fileName: 'bank_letter.pdf',
        })
      );
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 7. Screen-Reader Accessibility & Semantic HTML                             */
  /* -------------------------------------------------------------------------- */
  describe('7. Screen-Reader Accessibility & Semantic HTML', () => {
    it('includes role="region" with descriptive aria-labels for sensitive panels', () => {
      renderWithClient(
        <PrivateContactsCard
          privateContacts={mockSponsorOrg.privateContacts}
          isAuthorized={true}
          tenantId="tenant-stellar-global"
        />
      );

      const region = screen.getByRole('region', { name: /tenant private contacts/i });
      expect(region).toBeInTheDocument();
    });

    it('associates form labels with input fields via htmlFor in CreateSponsorOrgForm', () => {
      renderWithClient(
        <CreateSponsorOrgForm
          tenantId="tenant-test"
          userEmail="user@org.com"
          onSubmit={vi.fn()}
        />
      );

      expect(screen.getByLabelText(/organization public name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/official registered legal name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/primary administrative email/i)).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 8. Permission States (Tenant Owner vs Public / Student Viewer)             */
  /* -------------------------------------------------------------------------- */
  describe('8. Permission States & Confidential Contact Redaction', () => {
    it('authorized tenant owner can see confidential billing, legal, compliance contacts', () => {
      renderWithClient(
        <PrivateContactsCard
          privateContacts={mockSponsorOrg.privateContacts}
          isAuthorized={true}
          tenantId={mockSponsorOrg.tenantId}
        />
      );

      expect(screen.getByText('Marcus Vance')).toBeInTheDocument();
      expect(screen.getByText('marcus.vance@stellarimpact.org')).toBeInTheDocument();
      expect(screen.getByText('US-EIN-84-9382910')).toBeInTheDocument();
    });

    it('unauthorized public or student viewer sees redacted contacts with no PII leakage', () => {
      renderWithClient(
        <PrivateContactsCard
          privateContacts={mockSponsorOrg.privateContacts}
          isAuthorized={false}
        />
      );

      // Confidential contacts MUST NOT exist in DOM
      expect(screen.queryByText('Marcus Vance')).not.toBeInTheDocument();
      expect(screen.queryByText('marcus.vance@stellarimpact.org')).not.toBeInTheDocument();
      expect(screen.queryByText('US-EIN-84-9382910')).not.toBeInTheDocument();

      // Redacted warning is displayed
      expect(screen.getByText(/private contacts redacted/i)).toBeInTheDocument();
    });

    it('platform administrator sees adjudication controls on pending organizations', () => {
      useSponsorOrgStore.setState({
        activeOrg: mockPendingSponsorOrg,
        isLoading: false,
      });

      renderWithClient(
        <SponsorProfileManager
          sponsorId={mockPendingSponsorOrg.id}
          currentUser={{
            userId: 'user-admin',
            email: 'admin@chainverse.org',
            role: 'administrator',
          }}
        />
      );

      expect(
        screen.getByRole('button', { name: /adjudicate verification/i })
      ).toBeInTheDocument();
    });
  });
});
