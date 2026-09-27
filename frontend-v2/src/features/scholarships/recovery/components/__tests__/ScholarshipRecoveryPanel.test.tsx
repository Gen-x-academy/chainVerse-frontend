import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ScholarshipRecoveryPanel } from '../ScholarshipRecoveryPanel';
import type { RecoveryClaim } from '../../types';

const CLAIM: RecoveryClaim = {
  id: 'claim-1',
  awardId: 'award-1',
  studentId: 'student-1',
  programId: 'program-1',
  amountCents: 250_000,
  currency: 'USD',
  reason: 'milestone-failure',
  legalBasis: 'program-terms',
  status: 'approved',
  requestedCents: 250_000,
  collectedCents: 100_000,
  requestedAt: '2026-01-05T00:00:00.000Z',
};

const NO_BASIS: RecoveryClaim = {
  ...CLAIM,
  id: 'claim-2',
  legalBasis: 'none',
  status: 'under-review',
  requestedCents: 80_000,
  collectedCents: 0,
};

describe('ScholarshipRecoveryPanel', () => {
  it('announces loading politely', () => {
    render(<ScholarshipRecoveryPanel claims={[]} loading />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading recovery claims/i);
  });

  it('renders an error state with a next step', () => {
    render(<ScholarshipRecoveryPanel claims={[]} error="ledger unavailable" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/ledger unavailable/i);
    expect(alert).toHaveTextContent(/next step/i);
  });

  it('renders an empty state', () => {
    render(<ScholarshipRecoveryPanel claims={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent(/no recovery claims/i);
  });

  it('renders a permission note instead of claims', () => {
    render(<ScholarshipRecoveryPanel claims={[CLAIM]} canManage={false} />);
    expect(screen.getByRole('note')).toHaveTextContent(/do not have permission/i);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('uses real table semantics with a caption and column headers', () => {
    render(<ScholarshipRecoveryPanel claims={[CLAIM, NO_BASIS]} />);
    const table = screen.getByRole('table');
    expect(within(table).getByRole('caption')).toHaveTextContent(/recovery claims/i);

    const headers = within(table).getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual([
      'Claim',
      'Reason',
      'Legal basis',
      'Status',
      'Requested',
      'Collected',
      'Outstanding',
      'Reconciliation',
    ]);
    headers.forEach((header) => expect(header).toHaveAttribute('scope', 'col'));
    expect(within(table).getAllByRole('rowheader')[0]).toHaveAttribute('scope', 'row');
  });

  it('states the reconciliation outcome in words, not colour alone', () => {
    render(<ScholarshipRecoveryPanel claims={[CLAIM]} />);
    const reconciliationCell = screen.getByRole('row', { name: /claim-1/i });
    expect(reconciliationCell).toHaveTextContent(/balanced/i);
  });

  it('flags a claim with no legal basis in text as well as an icon', () => {
    render(<ScholarshipRecoveryPanel claims={[NO_BASIS]} />);
    expect(screen.getAllByText(/no legal basis/i).length).toBeGreaterThan(0);
  });

  it('keeps the issue control disabled until an authorization id is entered', async () => {
    const user = userEvent.setup();
    render(<ScholarshipRecoveryPanel claims={[CLAIM]} />);

    await user.click(screen.getByRole('button', { name: /claim-1/i }));

    const issueButton = screen.getByRole('button', { name: /issue recovery instruction/i });
    expect(issueButton).toBeDisabled();
    expect(screen.getByText(/authorization id is required/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/authorization id/i), 'auth-1');
    expect(issueButton).toBeEnabled();
  });

  it('explains a blocked claim rather than just disabling the control', async () => {
    const user = userEvent.setup();
    render(<ScholarshipRecoveryPanel claims={[NO_BASIS]} />);

    await user.click(screen.getByRole('button', { name: /claim-2/i }));
    expect(screen.getByRole('button', { name: /issue recovery instruction/i })).toBeDisabled();
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(/no legal basis recorded/i);
    expect(within(note).getByText(/funds cannot be reclaimed on a/i)).toBeInTheDocument();
    expect(screen.getByText(/only an approved claim can be recovered/i)).toBeInTheDocument();
  });

  it('marks the authorization field invalid until it is filled', async () => {
    const user = userEvent.setup();
    render(<ScholarshipRecoveryPanel claims={[CLAIM]} />);
    await user.click(screen.getByRole('button', { name: /claim-1/i }));

    const field = screen.getByLabelText(/authorization id/i);
    expect(field).toHaveAttribute('aria-invalid', 'true');
    await user.type(field, 'auth-9');
    expect(field).not.toHaveAttribute('aria-invalid');
    expect(field).not.toHaveAttribute('aria-describedby');
    expect(screen.getByRole('button', { name: /issue recovery instruction/i })).toBeEnabled();
  });

  it('issues the instruction through the supplied handler', async () => {
    const user = userEvent.setup();
    const onIssueInstruction = vi.fn().mockResolvedValue(undefined);
    render(<ScholarshipRecoveryPanel claims={[CLAIM]} onIssueInstruction={onIssueInstruction} />);

    await user.click(screen.getByRole('button', { name: /claim-1/i }));
    await user.type(screen.getByLabelText(/authorization id/i), 'auth-1');
    await user.click(screen.getByRole('button', { name: /issue recovery instruction/i }));

    expect(onIssueInstruction).toHaveBeenCalledWith(CLAIM, { amountCents: 150_000, authorizationId: 'auth-1' });
  });
});
