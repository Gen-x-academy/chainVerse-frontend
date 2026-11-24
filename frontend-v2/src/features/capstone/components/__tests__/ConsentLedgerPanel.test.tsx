import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsentLedgerPanel } from '../ConsentLedgerPanel';
import type { ConsentActor, ConsentRecord } from '../../consent-ledger';

describe('ConsentLedgerPanel (CAPSTONE-105)', () => {
  const actor: ConsentActor = {
    id: 'usr_student_1',
    organizationId: 'org_acme',
    role: 'student',
  };

  const unauthorizedActor: ConsentActor = {
    id: 'usr_other',
    organizationId: 'org_acme',
    role: 'student',
  };

  const foreignTenantActor: ConsentActor = {
    id: 'usr_student_1',
    organizationId: 'org_other',
    role: 'student',
  };

  it('renders all seven distinct consent purposes with data coverage explanations', () => {
    render(
      <ConsentLedgerPanel
        projectId="prj_100"
        participantId="usr_student_1"
        organizationId="org_acme"
        actor={actor}
      />
    );

    expect(screen.getByRole('heading', { name: /Capstone Consent Ledger/i })).toBeInTheDocument();

    expect(screen.getByText(/Project & Mentor Matching/i)).toBeInTheDocument();
    expect(screen.getByText(/Project Workspace & Collaboration/i)).toBeInTheDocument();
    expect(screen.getByText(/Authorized Provider Access/i)).toBeInTheDocument();
    expect(screen.getByText(/Originality & Integrity Screening/i)).toBeInTheDocument();
    expect(screen.getByText(/Program Analytics & Evaluation/i)).toBeInTheDocument();
    expect(screen.getByText(/Showcase & Repository Publication/i)).toBeInTheDocument();
    expect(screen.getByText(/Verifiable Credential Minting/i)).toBeInTheDocument();

    // Data covered explanations
    expect(screen.getByText(/Academic profile, listed skill proficiencies/i)).toBeInTheDocument();
    expect(screen.getByText(/Workspace activity logs, collaborative comments/i)).toBeInTheDocument();
  });

  it('allows granting consent for an optional purpose', async () => {
    const onConsentChanged = vi.fn();
    render(
      <ConsentLedgerPanel
        projectId="prj_100"
        participantId="usr_student_1"
        organizationId="org_acme"
        actor={actor}
        onConsentChanged={onConsentChanged}
      />
    );

    // Find the Grant consent button for matching
    const grantButtons = screen.getAllByRole('button', { name: /Grant consent/i });
    expect(grantButtons.length).toBeGreaterThan(0);

    await userEvent.click(grantButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Consent granted for/i)).toBeInTheDocument();
      expect(onConsentChanged).toHaveBeenCalled();
    });
  });

  it('triggers a consequential warning modal when withdrawing critical consent', async () => {
    const initialRecords: ConsentRecord[] = [
      {
        id: 'cns_prj_100_usr_student_1_collaboration',
        projectId: 'prj_100',
        participantId: 'usr_student_1',
        organizationId: 'org_acme',
        purpose: 'collaboration',
        state: 'granted',
        required: true,
        updatedAt: '2026-11-20T12:00:00.000Z',
        revision: 2,
      },
    ];

    render(
      <ConsentLedgerPanel
        projectId="prj_100"
        participantId="usr_student_1"
        organizationId="org_acme"
        actor={actor}
        initialRecords={initialRecords}
      />
    );

    const withdrawBtn = screen.getByRole('button', { name: /Withdraw consent/i });
    await userEvent.click(withdrawBtn);

    // Expect confirmation modal with consequential warning
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Consequential Consent Change/i)).toBeInTheDocument();
    expect(screen.getByText(/Withdrawing workspace collaboration consent will suspend your write access/i)).toBeInTheDocument();

    // Confirm withdrawal
    const confirmBtn = screen.getByRole('button', { name: /Confirm withdrawal/i });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/Consent withdrawn for Project Workspace & Collaboration/i)).toBeInTheDocument();
    });
  });

  it('renders permission-denied note for unauthorized participant', () => {
    render(
      <ConsentLedgerPanel
        projectId="prj_100"
        participantId="usr_student_1"
        organizationId="org_acme"
        actor={unauthorizedActor}
      />
    );

    expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
    expect(screen.queryByText(/Project Workspace & Collaboration/i)).not.toBeInTheDocument();
  });

  it('rejects cross-tenant access deny-by-default', () => {
    render(
      <ConsentLedgerPanel
        projectId="prj_100"
        participantId="usr_student_1"
        organizationId="org_acme"
        actor={foreignTenantActor}
      />
    );

    expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
  });
});
