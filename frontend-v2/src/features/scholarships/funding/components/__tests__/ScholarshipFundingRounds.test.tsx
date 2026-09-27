import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScholarshipFundingRounds } from '../ScholarshipFundingRounds';
import { EXPECTED_SOURCE_ACCOUNT_ID, type Deposit, type FundingRound } from '../../types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { apiClient } from '@/src/lib/api-client';

const DEPOSITS: Deposit[] = [
  {
    id: 'dep-1',
    sponsorId: 'sponsor-1',
    allocation: 'specific-program',
    programId: 'program-1',
    amountCents: 500_00,
    currency: 'USD',
    asset: {
      assetCode: 'USDC',
      issuer: 'circle',
      sourceAccountId: EXPECTED_SOURCE_ACCOUNT_ID,
      verifiedAt: '2026-01-01T00:00:00.000Z',
    },
    reference: 'ref-001',
    status: 'credited',
    recordedAt: '2026-01-01T00:00:00.000Z',
    creditedAt: '2026-01-02T00:00:00.000Z',
    clientToken: 'token-001',
  },
];

const ROUNDS: FundingRound[] = [
  {
    id: 'round-1',
    name: 'Spring round',
    programId: 'program-1',
    currency: 'USD',
    targetCents: 1_000_00,
    committedCents: 400_00,
    opensAt: '2026-01-01T00:00:00.000Z',
    closesAt: '2026-06-01T00:00:00.000Z',
    status: 'open',
  },
];

function mockFunding(overrides: { rejects?: boolean } = {}) {
  const mock = vi.mocked(apiClient);
  if (overrides.rejects) {
    mock.get.mockRejectedValue(new Error('funding API unavailable'));
    return;
  }
  mock.get
    .mockResolvedValueOnce(DEPOSITS as never)
    .mockResolvedValueOnce(ROUNDS as never)
    .mockResolvedValueOnce([] as never);
}

function renderReady(props: Partial<Parameters<typeof ScholarshipFundingRounds>[0]> = {}) {
  return render(
    <ScholarshipFundingRounds
      role="finance"
      sponsorId="sponsor-1"
      initialDeposits={DEPOSITS}
      initialRounds={ROUNDS}
      initialReallocations={[]}
      {...props}
    />
  );
}

describe('ScholarshipFundingRounds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a loading status while funding is fetched', () => {
    mockFunding();
    render(<ScholarshipFundingRounds role="finance" sponsorId="sponsor-1" />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading sponsor deposits/i);
  });

  it('renders an error alert with a next step when the funding API fails', async () => {
    mockFunding({ rejects: true });
    render(<ScholarshipFundingRounds role="finance" sponsorId="sponsor-1" />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/funding data could not be loaded/i);
    expect(alert).toHaveTextContent(/funding API unavailable/);
    expect(screen.getByRole('button', { name: /retry loading funding/i })).toBeInTheDocument();
  });

  it('renders empty states for deposits, rounds, and reallocations', () => {
    renderReady({ initialDeposits: [], initialRounds: [] });

    expect(screen.getByText(/no deposits recorded yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no funding rounds configured/i)).toBeInTheDocument();
    expect(screen.getByText(/no reallocation requests recorded/i)).toBeInTheDocument();
  });

  it('shows the asset binding and a textual status, not colour alone', () => {
    renderReady();
    const table = screen.getByRole('table', { name: /sponsor deposits with asset binding/i });
    expect(within(table).getByText(/USDC · circle from sponsor-source-account/)).toBeInTheDocument();
    expect(within(table).getByText('Credited')).toBeInTheDocument();
    expect(within(table).getByText('(credited)')).toBeInTheDocument();
  });

  it('exposes funding progress with progressbar semantics and text', () => {
    renderReady();
    const bar = screen.getByRole('progressbar', { name: /spring round funding progress/i });
    expect(bar).toHaveAttribute('aria-valuenow', '40');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-valuetext', expect.stringContaining('40% funded'));
    expect(screen.getByText(/40% funded/)).toBeInTheDocument();
  });

  it('blocks submission and warns when the reference is already recorded', async () => {
    const user = userEvent.setup();
    renderReady();

    await user.type(screen.getByLabelText(/deposit reference/i), 'ref-001');
    const submit = screen.getByRole('button', { name: /record deposit/i });

    expect(screen.getByRole('alert', { name: /duplicate reference warning/i })).toHaveTextContent(
      /can only be credited once/i
    );
    expect(submit).toBeDisabled();
    expect(screen.getByText(/submission is blocked while this reference or client token is already on file/i)).toBeInTheDocument();
  });

  it('marks invalid fields with aria-invalid and links the error with aria-describedby', async () => {
    const user = userEvent.setup();
    renderReady({ initialDeposits: [] });

    const asset = screen.getByLabelText(/asset code/i);
    const submit = screen.getByRole('button', { name: /record deposit/i });
    expect(asset).not.toHaveAttribute('aria-invalid');

    await user.clear(asset);
    await user.type(asset, 'NOTREAL');
    await user.click(submit);

    expect(asset).toHaveAttribute('aria-invalid', 'true');
    const describedBy = asset.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const message = document.getElementById(describedBy as string);
    expect(message).toHaveTextContent(/is not an accepted asset/i);
  });

  it('marks an amount below the minimum as invalid', async () => {
    const user = userEvent.setup();
    renderReady({ initialDeposits: [] });

    const amount = screen.getByLabelText(/^amount \(minor units\)$/i);
    await user.clear(amount);
    await user.type(amount, '10');
    await user.click(screen.getByRole('button', { name: /record deposit/i }));

    const describedBy = amount.getAttribute('aria-describedby');
    const message = document.getElementById(describedBy as string);
    expect(message).toHaveTextContent(/minimum deposit is 10000 minor units/i);
  });

  it('records a valid deposit and posts the idempotency key', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient).post.mockResolvedValueOnce({
      ...DEPOSITS[0],
      id: 'dep-2',
      reference: 'ref-002',
      clientToken: 'token-002',
    } as never);

    renderReady({ initialDeposits: [] });

    await user.selectOptions(screen.getByLabelText(/^program$/i), 'program-1');
    await user.type(screen.getByLabelText(/deposit reference/i), 'ref-002');
    await user.type(screen.getByLabelText(/client token/i), 'token-002');
    await user.click(screen.getByRole('button', { name: /record deposit/i }));

    await waitFor(() => {
      expect(screen.getByText(/recorded\. it is not credited until an authorized crediting step/i)).toBeInTheDocument();
    });
    expect(vi.mocked(apiClient).post).toHaveBeenCalledWith(
      '/scholarships/funding/deposits',
      expect.objectContaining({ idempotencyKey: 'deposit-token-002', reference: 'ref-002' })
    );
  });

  it('requires a distinct authorizer before a reallocation can be approved', () => {
    renderReady({
      role: 'sponsor-1',
      initialReallocations: [
        {
          id: 'rea-1',
          depositId: 'dep-1',
          fromProgramId: 'program-1',
          toProgramId: 'program-2',
          amountCents: 100_00,
          currency: 'USD',
          status: 'requested',
          requestedBy: 'sponsor-1',
          requestedAt: '2026-02-01T00:00:00.000Z',
          reason: 'Redirected to engineering.',
        },
      ],
    });

    expect(screen.getByRole('button', { name: /authorize as sponsor-1/i })).toBeDisabled();
    expect(screen.getByText(/you requested this change, so you cannot authorize it/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request reallocation/i })).toBeDisabled();
  });

  it('authorizes a reallocation when the actor differs from the requester', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient).patch.mockResolvedValueOnce({
      id: 'rea-1',
      depositId: 'dep-1',
      fromProgramId: 'program-1',
      toProgramId: 'program-2',
      amountCents: 100_00,
      currency: 'USD',
      status: 'authorized',
      requestedBy: 'sponsor-1',
      requestedAt: '2026-02-01T00:00:00.000Z',
      reason: 'Redirected to engineering.',
      authorizedBy: 'finance',
      authorizedAt: '2026-02-02T00:00:00.000Z',
    } as never);

    renderReady({
      role: 'finance',
      initialReallocations: [
        {
          id: 'rea-1',
          depositId: 'dep-1',
          fromProgramId: 'program-1',
          toProgramId: 'program-2',
          amountCents: 100_00,
          currency: 'USD',
          status: 'requested',
          requestedBy: 'sponsor-1',
          requestedAt: '2026-02-01T00:00:00.000Z',
          reason: 'Redirected to engineering.',
        },
      ],
    });

    await user.click(screen.getByRole('button', { name: /authorize as finance/i }));

    await waitFor(() => {
      expect(vi.mocked(apiClient).patch).toHaveBeenCalledWith('/scholarships/funding/reallocations/rea-1', {
        authorizedBy: 'finance',
        reason: 'Redirected to engineering.',
        expectedStatus: 'requested',
      });
    });
    expect(screen.getByText(/authorized by finance\. the original allocation stays on record/i)).toBeInTheDocument();
  });

  it('renders a permission notice and disables actions for a student role', () => {
    renderReady({ role: 'student' });

    const notice = screen.getByRole('note', { name: /funding permission notice/i });
    expect(notice).toHaveTextContent(/not available for your role/i);
    expect(notice).toHaveTextContent(/ask a sponsor, finance, or administrator/i);
    expect(screen.getByRole('button', { name: /record deposit/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /request reallocation/i })).toBeDisabled();
  });
});
