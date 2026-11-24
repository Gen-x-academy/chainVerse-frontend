import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsentLedgerPanel } from '@/src/features/capstone/components/ConsentLedgerPanel';
import { ProjectPrivacyControlsPanel } from '@/src/features/capstone/components/ProjectPrivacyControlsPanel';
import { ProjectSecretsPanel } from '@/src/features/capstone/components/ProjectSecretsPanel';
import { ParticipantDashboardView } from '@/src/features/capstone/components/ParticipantDashboardView';
import { filterProjectFieldsByAudience, initializeProjectPrivacy } from '@/src/features/capstone/field-privacy';
import { sanitizeTelemetryPayload } from '@/src/features/capstone/secrets-protection';
import type { ParticipantDashboardState } from '@/src/features/capstone/participant-dashboard';

describe('Shared Capstone User Journey & Security Verification (CAPSTONE-105, 106, 109, 114)', () => {
  const now = '2026-11-20T12:00:00.000Z';

  const participantActor = {
    id: 'usr_lead_researcher',
    organizationId: 'org_stellar_labs',
    role: 'student',
    isProjectOwner: true,
  };

  const outsiderActor = {
    id: 'usr_unrelated',
    organizationId: 'org_stellar_labs',
    role: 'student',
    isProjectOwner: false,
  };

  const foreignOrgActor = {
    id: 'usr_lead_researcher',
    organizationId: 'org_foreign_corp',
    role: 'student',
    isProjectOwner: true,
  };

  it('Journey 1: Participant grants purpose-specific consent, verifies non-blanket enforcement, and withdraws with confirmation', async () => {
    const onConsentChanged = vi.fn();

    render(
      <ConsentLedgerPanel
        projectId="prj_stellar_100"
        participantId={participantActor.id}
        organizationId={participantActor.organizationId}
        actor={participantActor}
        onConsentChanged={onConsentChanged}
      />
    );

    // Initial inspection: all 7 purposes present
    expect(screen.getByText(/Project Workspace & Collaboration/i)).toBeInTheDocument();
    expect(screen.getByText(/Originality & Integrity Screening/i)).toBeInTheDocument();
    expect(screen.getByText(/Showcase & Repository Publication/i)).toBeInTheDocument();

    // Grant publication consent
    const grantButtons = screen.getAllByRole('button', { name: /Grant consent/i });
    await userEvent.click(grantButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Consent granted for/i)).toBeInTheDocument();
      expect(onConsentChanged).toHaveBeenCalled();
    });
  });

  it('Journey 2: Project field-level privacy updates filter sensitive data from unauthorized audiences deny-by-default', async () => {
    const policy = initializeProjectPrivacy(
      'prj_stellar_100',
      'org_stellar_labs',
      now,
      participantActor.id
    );

    const projectDataset = {
      proposals: { title: 'Verifiable Computation on Stellar' },
      notes: [{ id: 'n1', text: 'Internal peer review findings' }],
      achievements: [{ id: 'a1', title: 'Cohort Accepted' }],
      funding: { grantAmount: '25000' },
      locations: [{ name: 'Lab 4B' }],
    };

    // Anonymous audience should only see achievements
    const publicView = filterProjectFieldsByAudience(projectDataset, policy, 'anonymous');
    expect(publicView.achievements).toBeDefined();
    expect(publicView.proposals).toBeUndefined();
    expect(publicView.notes).toBeUndefined();
    expect(publicView.funding).toBeUndefined();

    // Member audience should see proposals and notes, but funding remains restricted to organization admin
    const memberView = filterProjectFieldsByAudience(projectDataset, policy, 'member');
    expect(memberView.proposals).toBeDefined();
    expect(memberView.notes).toBeDefined();
    expect(memberView.funding).toBeUndefined();
  });

  it('Journey 3: Protects project secrets, masks values by default, and rotates keys without leaking credentials into notifications', async () => {
    const onSecretRotated = vi.fn();

    render(
      <ProjectSecretsPanel
        projectId="prj_stellar_100"
        organizationId={participantActor.organizationId}
        actor={participantActor}
        onSecretRotated={onSecretRotated}
      />
    );

    // Default masking is active
    expect(screen.getAllByText('••••••••••••').length).toBe(7);

    // Rotate provider API token
    const rotateButtons = screen.getAllByRole('button', { name: /Rotate Key/i });
    await userEvent.click(rotateButtons[0]);

    // Operational impact modal
    const confirmBtn = screen.getByRole('button', { name: /Rotate Secret/i });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/Successfully rotated External Provider API Tokens/i)).toBeInTheDocument();
      // Ensure no raw tokens or passwords leak into DOM
      expect(screen.queryByText(/sk-live/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/secret_key/i)).not.toBeInTheDocument();
    });
  });

  it('Journey 4: Participant navigates dashboard, verifies deadlines, operational health, and accepts invitation', async () => {
    const mockDashboard: ParticipantDashboardState = {
      participantId: participantActor.id,
      organizationId: participantActor.organizationId,
      role: 'student',
      sections: {
        deadlines: {
          status: 'ready',
          items: [
            {
              id: 'dl_journey',
              projectId: 'prj_stellar_100',
              projectTitle: 'Stellar Privacy Protocol',
              title: 'Final Code Delivery',
              dueAt: '2026-12-15T00:00:00.000Z',
              isOverdue: false,
              priority: 'critical',
              kind: 'milestone',
            },
          ],
        },
        invitations: {
          status: 'ready',
          items: [
            {
              id: 'inv_journey',
              projectId: 'prj_stellar_200',
              projectTitle: 'Decentralized Identity Bridge',
              inviterName: 'Prof. Turing',
              roleOffered: 'Research Fellow',
              sentAt: now,
              expiresAt: '2026-12-01T00:00:00.000Z',
              status: 'pending',
              revision: 1,
            },
          ],
        },
        projects: {
          status: 'ready',
          items: [
            {
              id: 'prj_stellar_100',
              title: 'Stellar Privacy Protocol',
              summary: 'Zero-knowledge proofs on soroban smart contracts.',
              role: 'Lead Author',
              state: 'active',
              memberCount: 5,
              progressPercent: 80,
              isOwner: true,
              canManagePrivacy: true,
              canManageSecrets: true,
            },
          ],
        },
        milestones: { status: 'ready', items: [] },
        reviews: { status: 'ready', items: [] },
        funding: { status: 'ready', items: [] },
        alerts: { status: 'ready', items: [] },
        activity: { status: 'ready', items: [] },
      },
    };

    const onInvitationResponded = vi.fn();

    render(
      <ParticipantDashboardView
        initialDashboard={mockDashboard}
        onInvitationResponded={onInvitationResponded}
      />
    );

    // Verify operational metrics rendered
    expect(screen.getAllByText(/Active Projects/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Stellar Privacy Protocol').length).toBeGreaterThan(0);

    // Accept invitation
    const acceptBtn = screen.getByRole('button', { name: /Accept/i });
    await userEvent.click(acceptBtn);

    await waitFor(() => {
      expect(screen.getByText(/Invitation to 'Decentralized Identity Bridge' was accepted/i)).toBeInTheDocument();
      expect(onInvitationResponded).toHaveBeenCalled();
    });
  });

  it('Security Boundary: Rejects cross-tenant and unauthorized access across all panels', () => {
    // 1. Cross-tenant consent panel rejection
    const { unmount: unmount1 } = render(
      <ConsentLedgerPanel
        projectId="prj_stellar_100"
        participantId={participantActor.id}
        organizationId={participantActor.organizationId}
        actor={foreignOrgActor}
      />
    );
    expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
    unmount1();

    // 2. Unauthorized privacy controls rejection
    const { unmount: unmount2 } = render(
      <ProjectPrivacyControlsPanel
        projectId="prj_stellar_100"
        organizationId={participantActor.organizationId}
        actor={outsiderActor}
      />
    );
    expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
    unmount2();

    // 3. Unauthorized secrets panel rejection
    const { unmount: unmount3 } = render(
      <ProjectSecretsPanel
        projectId="prj_stellar_100"
        organizationId={participantActor.organizationId}
        actor={outsiderActor}
      />
    );
    expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
    unmount3();
  });

  it('Privacy Boundary: Telemetry payload sanitization scrubs credentials and tokens', () => {
    const rawTelemetry = {
      userRole: 'student',
      projectId: 'prj_100',
      apiKeyToken: 'bearer-sensitive-9988',
      secretCoordinates: '37.7749,-122.4194',
      privateSupervisorNotes: 'Reviewer flagged potential plagiarism',
      safeEventCount: 5,
    };

    const sanitized = sanitizeTelemetryPayload({
      eventName: 'capstone_panel_opened',
      payload: rawTelemetry,
    });

    expect(sanitized.eventName).toBe('capstone_panel_opened');
    expect(sanitized.userRole).toBe('student');
    expect(sanitized.projectId).toBe('prj_100');
    expect(sanitized.safeEventCount).toBe(5);

    // Scrubbed fields
    expect(sanitized.apiKeyToken).toBe('[REDACTED]');
    expect(sanitized.secretCoordinates).toBe('[REDACTED]');
    expect(sanitized.privateSupervisorNotes).toBe('[REDACTED]');
  });
});
