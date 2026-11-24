import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectSecretsPanel } from '../ProjectSecretsPanel';
import type { SecretActor } from '../../secrets-protection';

describe('ProjectSecretsPanel (CAPSTONE-109)', () => {
  const ownerActor: SecretActor = {
    id: 'usr_owner_1',
    organizationId: 'org_acme',
    role: 'student',
    isProjectOwner: true,
  };

  const studentActor: SecretActor = {
    id: 'usr_student_2',
    organizationId: 'org_acme',
    role: 'student',
    isProjectOwner: false,
  };

  it('renders all sensitive categories masked by default with classification badges', () => {
    render(
      <ProjectSecretsPanel
        projectId="prj_100"
        organizationId="org_acme"
        actor={ownerActor}
      />
    );

    expect(screen.getByRole('heading', { name: /Project Secrets & Sensitive-Field Protection/i })).toBeInTheDocument();

    expect(screen.getByText(/External Provider API Tokens/i)).toBeInTheDocument();
    expect(screen.getByText(/Confidential Supervisor & Ethics Deliberations/i)).toBeInTheDocument();
    expect(screen.getByText(/Precise Research Coordinates/i)).toBeInTheDocument();
    expect(screen.getByText(/Unpublished Intellectual Property/i)).toBeInTheDocument();
    expect(screen.getByText(/Integrity Evidence Signing Keys/i)).toBeInTheDocument();
    expect(screen.getByText(/Regulated Research Datasets/i)).toBeInTheDocument();
    expect(screen.getByText(/Escrow Payout & Wallet Identifiers/i)).toBeInTheDocument();

    // Default masking is displayed everywhere
    const maskedValues = screen.getAllByText('••••••••••••');
    expect(maskedValues.length).toBe(7);
  });

  it('allows rotating supported keys with confirmation modal explaining operational impact', async () => {
    const onSecretRotated = vi.fn();
    render(
      <ProjectSecretsPanel
        projectId="prj_100"
        organizationId="org_acme"
        actor={ownerActor}
        onSecretRotated={onSecretRotated}
      />
    );

    // Find rotate button for provider token
    const rotateButtons = screen.getAllByRole('button', { name: /Rotate Key/i });
    expect(rotateButtons.length).toBeGreaterThan(0);

    await userEvent.click(rotateButtons[0]);

    // Modal appears with operational impact
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Confirm Key Rotation/i)).toBeInTheDocument();
    expect(screen.getByText(/Rotating this token will invalidate existing API integrations/i)).toBeInTheDocument();

    // Confirm rotation
    const confirmBtn = screen.getByRole('button', { name: /Rotate Secret/i });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/Successfully rotated External Provider API Tokens/i)).toBeInTheDocument();
      expect(onSecretRotated).toHaveBeenCalled();
    });
  });

  it('denies access to unauthorized non-owner participants', () => {
    render(
      <ProjectSecretsPanel
        projectId="prj_100"
        organizationId="org_acme"
        actor={studentActor}
      />
    );

    expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
    expect(screen.queryByText(/External Provider API Tokens/i)).not.toBeInTheDocument();
  });
});
