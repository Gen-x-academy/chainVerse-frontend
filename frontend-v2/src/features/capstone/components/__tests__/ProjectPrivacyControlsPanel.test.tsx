import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectPrivacyControlsPanel } from '../ProjectPrivacyControlsPanel';
import type { PrivacyActor } from '../../field-privacy';

describe('ProjectPrivacyControlsPanel (CAPSTONE-106)', () => {
  const ownerActor: PrivacyActor = {
    id: 'usr_owner_1',
    organizationId: 'org_acme',
    role: 'student',
    isProjectOwner: true,
  };

  const studentActor: PrivacyActor = {
    id: 'usr_member_2',
    organizationId: 'org_acme',
    role: 'student',
    isProjectOwner: false,
  };

  it('renders all nine field categories and identifies policy-locked fields', () => {
    render(
      <ProjectPrivacyControlsPanel
        projectId="prj_100"
        organizationId="org_acme"
        actor={ownerActor}
      />
    );

    expect(screen.getByRole('heading', { name: /Field-Level Privacy Controls/i })).toBeInTheDocument();

    expect(screen.getByText(/Participant Profiles/i)).toBeInTheDocument();
    expect(screen.getByText(/Research Proposals/i)).toBeInTheDocument();
    expect(screen.getByText(/Team Membership/i)).toBeInTheDocument();
    expect(screen.getByText(/Collaborative Notes/i)).toBeInTheDocument();
    expect(screen.getByText(/Milestone Progress/i)).toBeInTheDocument();
    expect(screen.getByText(/Project Deliverables & Outputs/i)).toBeInTheDocument();
    expect(screen.getByText(/Field Research Locations/i)).toBeInTheDocument();
    expect(screen.getByText(/Funding & Financial Records/i)).toBeInTheDocument();
    expect(screen.getByText(/Credentials & Badges/i)).toBeInTheDocument();

    // Policy locked badge on Locations
    expect(screen.getByText(/Policy Locked/i)).toBeInTheDocument();
    expect(screen.getByText(/Precise research locations are locked to project members/i)).toBeInTheDocument();
  });

  it('prompts confirmation when transitioning a category to public visibility', async () => {
    render(
      <ProjectPrivacyControlsPanel
        projectId="prj_100"
        organizationId="org_acme"
        actor={ownerActor}
      />
    );

    // Select progress audience dropdown and change to public
    const progressSelect = screen.getByLabelText(/Current Visibility/i, { selector: '#audience-select-progress' });
    await userEvent.selectOptions(progressSelect, 'public');

    // Consequential modal appears
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Public Visibility Warning/i)).toBeInTheDocument();
    expect(screen.getByText(/Publishing 'Milestone Progress' to the Public internet/i)).toBeInTheDocument();

    // Confirm button
    const confirmBtn = screen.getByRole('button', { name: /Make Public/i });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/Updated visibility for Milestone Progress to Public/i)).toBeInTheDocument();
    });
  });

  it('denies access to non-owners or non-administrators deny-by-default', () => {
    render(
      <ProjectPrivacyControlsPanel
        projectId="prj_100"
        organizationId="org_acme"
        actor={studentActor}
      />
    );

    expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
    expect(screen.getByText(/Only project owners, supervisors, and authorized organization administrators/i)).toBeInTheDocument();
    expect(screen.queryByText(/Participant Profiles/i)).not.toBeInTheDocument();
  });
});
