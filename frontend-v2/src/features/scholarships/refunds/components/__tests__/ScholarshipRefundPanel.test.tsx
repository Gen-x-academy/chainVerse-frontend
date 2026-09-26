import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScholarshipRefundPanel } from '../ScholarshipRefundPanel';
import type { LedgerEntry, RefundRequest } from '../../types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { apiClient } from '@/src/lib/api-client';

const REQUESTS: RefundRequest[] = [
  {
    id: 'ref-1',
    programId: 'program-1',
    sponsorId: 'sponsor-1',
    trigger: 'sponsor-request',
    amountCents: 100_00,
    currency: 'USD',
    assetCode: 'USDC',
    destinationAccountId: 'acct-1',
    status: 'requested',
    requestedBy: 'sponsor-1',
    requestedAt: '2026-02-01T00:00:00.000Z',
    reason: 'Program closed with funds unspent.',
    clientToken: 'token-1',
  },
];

const LEDGER: LedgerEntry[] = [
  {
    id: 'led-1',
    entryType: 'debit',
    amountCents: 100_00,
    currency: 'USD',
    programId: 'program-1',
    memo: 'Disbursement to recipient.',
    occurredAt: '2026-01-15T00:00:00.000Z',
  },
  {
    id: 'rev-led-1',
    entryType: 'credit',
    amountCents: 100_00,
    currency: 'USD',
    programId: 'program-1',
    memo: 'Reversal of led-1 for refund ref-1: Program closed with funds unspent.',
    occurredAt: '2026-02-05T00:00:00.000Z',
    reversesEntryId: 'led-1',
  },
];

function mockRefunds(overrides: { rejects?: boolean } = {}) {
  const mock = vi.mocked(apiClient);
  if (overrides.rejects) {
    mock.get.mockRejectedValue(new Error('refunds API unavailable'));
    return;
  }
  mock.get.mockResolvedValueOnce(REQUESTS as never).mockResolvedValueOnce(LEDGER as never);
}

function renderReady(props: Partial<Parameters<typeof ScholarshipRefundPanel>[0]> = {}) {
  return render(
    <ScholarshipRefundPanel
      role="finance"
      actorId="finance-1"
      programId="program-1"
      initialRequests={REQUESTS}
      initialLedger={LEDGER}
      initialAvailableCents={500_00}
      initialPayableCents={200_00}
      currency="USD"
      {...props}
    />
  );
}

describe('ScholarshipRefundPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a loading status while refunds are fetched', () => {
    mockRefunds();
    render(<ScholarshipRefundPanel role="finance" programId="program-1" />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading refund requests/i);
  });

  it('renders an error alert with a next step when the refunds API fails', async () => {
    mockRefunds({ rejects: true });
    render(<ScholarshipRefundPanel role="finance" programId="program-1" />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/refund data could not be loaded/i);
    expect(alert).toHaveTextContent(/refunds API unavailable/);
    expect(screen.getByRole('button', { name: /retry loading refunds/i })).toBeInTheDocument();
  });

  it('renders empty states for requests and the ledger', () => {
    renderReady({ initialRequests: [], initialLedger: [] });
    expect(screen.getByText(/no refund requests recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/no ledger entries for this program yet/i)).toBeInTheDocument();
  });

  it('states the refund authority derived from the current role', () => {
    renderReady({ role: 'administrator' });
    const notice = screen.getByRole('note', { name: /refund authority notice/i });
    expect(notice).toHaveTextContent(/refund authority: administrator/i);
  });

  it('denies authority to a student and explains the next step', () => {
    renderReady({ role: 'student' });
    const notice = screen.getByRole('note', { name: /refund authority notice/i });
    expect(notice).toHaveTextContent(/no refund authority/i);
    expect(notice).toHaveTextContent(/students and reviewers can never request, authorize, or settle a refund/i);
    expect(notice).toHaveTextContent(/next step: contact a sponsor, finance, or administrator/i);
    expect(screen.getByRole('button', { name: /request refund/i })).toBeDisabled();
  });

  it('shows the solvency check and blocks settlement when short', () => {
    renderReady({ initialAvailableCents: 250_00, initialPayableCents: 200_00 });
    const status = screen
      .getAllByRole('status')
      .find((node) => /Solvent|Short/.test(node.textContent ?? ''));
    expect(status).toHaveTextContent(/Short — settlement blocked/i);
    expect(status).toHaveTextContent(/shortfall of \$50\.00/i);
    expect(status).toHaveTextContent(/next step: resolve the shortfall/i);
  });

  it('reports a solvent treasury in words, not colour alone', () => {
    renderReady();
    const status = screen
      .getAllByRole('status')
      .find((node) => /Solvent|Short/.test(node.textContent ?? ''));
    expect(status).toHaveTextContent(/Solvent — settlement allowed/i);
  });

  it('blocks a request that would make the treasury insolvent', async () => {
    const user = userEvent.setup();
    renderReady({ initialAvailableCents: 250_00, initialPayableCents: 200_00 });

    const amount = screen.getByLabelText(/amount \(minor units\)/i);
    await user.clear(amount);
    await user.type(amount, '9000');

    expect(screen.getByText(/this refund would leave a shortfall/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request refund/i })).toBeDisabled();
    expect(
      screen.getByText(/submission is blocked while the treasury cannot cover this refund/i)
    ).toBeInTheDocument();
  });

  it('marks invalid fields with aria-invalid and aria-describedby', async () => {
    const user = userEvent.setup();
    renderReady({ initialRequests: [] });

    await user.click(screen.getByRole('button', { name: /request refund/i }));

    const reason = screen.getByLabelText(/^reason$/i);
    expect(reason).toHaveAttribute('aria-invalid', 'true');
    const describedBy = reason.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      /documented reason is required/i
    );

    const destination = screen.getByLabelText(/destination account/i);
    expect(destination).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById(destination.getAttribute('aria-describedby') as string)).toHaveTextContent(
      /destination account is required/i
    );
  });

  it('shows an amount error below the minimum linked to the amount field', async () => {
    const user = userEvent.setup();
    renderReady({ initialRequests: [] });

    const amount = screen.getByLabelText(/amount \(minor units\)/i);
    await user.clear(amount);
    await user.type(amount, '0');
    await user.click(screen.getByRole('button', { name: /request refund/i }));

    const describedBy = amount.getAttribute('aria-describedby');
    expect(document.getElementById(describedBy as string)).toHaveTextContent(/minimum refund is 100 minor units/i);
  });

  it('posts a valid refund request with an idempotency key', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient).post.mockResolvedValueOnce(REQUESTS[0] as never);
    renderReady({ initialRequests: [] });

    await user.type(screen.getByLabelText(/destination account/i), 'acct-9');
    await user.type(screen.getByLabelText(/^reason$/i), 'Program closed with funds unspent.');
    await user.type(screen.getByLabelText(/client token/i), 'unused');
    await user.click(screen.getByRole('button', { name: /request refund/i }));

    await waitFor(() => {
      expect(vi.mocked(apiClient).post).toHaveBeenCalledWith(
        '/scholarships/refunds',
        expect.objectContaining({ idempotencyKey: 'refund-unused', amountCents: 100 })
      );
    });
    expect(
      screen.getAllByText(/must be authorized by finance or an administrator/i).length
    ).toBeGreaterThan(0);
  });

  it('lists requests with a textual status, not colour alone', () => {
    renderReady();
    const table = screen.getByRole('table', { name: /refund requests with trigger, amount, and status/i });
    expect(within(table).getByText('sponsor-request')).toBeInTheDocument();
    expect(within(table).getByText('Requested')).toBeInTheDocument();
    expect(within(table).getByText('(requested)')).toBeInTheDocument();
  });

  it('proves the original ledger entry is retained alongside its reversal', () => {
    renderReady();
    const table = screen.getByRole('table', { name: /program ledger entries and their reversals/i });

    const cells = within(table).getAllByText('led-1');
    expect(cells.length).toBeGreaterThan(0);
    expect(within(table).getByText('rev-led-1')).toBeInTheDocument();
    expect(within(table).getByText('Disbursement to recipient.')).toBeInTheDocument();
    expect(within(table).getByText(/Reversal of led-1 for refund ref-1/)).toBeInTheDocument();
    expect(within(table).getByText('Debit')).toBeInTheDocument();
    expect(within(table).getByText('Credit')).toBeInTheDocument();
  });
});
