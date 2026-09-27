import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScholarshipTreasuryReconciliation } from '../ScholarshipTreasuryReconciliation';
import type { Liability, ReconciliationRun, TreasuryAccount } from '../../types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { apiClient } from '@/src/lib/api-client';

const AS_OF = '2026-02-01T00:00:00.000Z';

const ACCOUNTS: TreasuryAccount[] = [
  {
    id: 'acct-program',
    programId: 'program-1',
    kind: 'program-pool',
    availableCents: 1_000_00,
    reservedCents: 200_00,
    payableCents: 300_00,
    currency: 'USD',
    asOf: AS_OF,
  },
];

const LIABILITIES: Liability[] = [
  {
    id: 'liab-1',
    programId: 'program-1',
    kind: 'committed-award',
    amountCents: 300_00,
    currency: 'USD',
    createdAt: '2026-01-15T00:00:00.000Z',
  },
];

function run(overrides: Partial<ReconciliationRun> = {}): ReconciliationRun {
  const position = {
    availableCents: 1_000_00,
    reservedCents: 200_00,
    payableCents: 300_00,
    netCents: 700_00,
    currency: 'USD',
    accounts: ACCOUNTS,
  };
  return {
    id: 'run-1',
    asOf: AS_OF,
    startedAt: AS_OF,
    completedAt: AS_OF,
    position,
    liabilities: LIABILITIES,
    balanced: true,
    varianceCents: 0,
    discrepancies: [],
    status: 'balanced',
    ...overrides,
  };
}

function mockTreasury(overrides: {
  accounts?: TreasuryAccount[];
  liabilities?: Liability[];
  runs?: ReconciliationRun[];
  rejects?: boolean;
} = {}) {
  const mock = vi.mocked(apiClient);
  if (overrides.rejects) {
    mock.get.mockRejectedValue(new Error('treasury API unavailable'));
    return;
  }
  mock.get
    .mockResolvedValueOnce((overrides.accounts ?? ACCOUNTS) as never)
    .mockResolvedValueOnce((overrides.liabilities ?? LIABILITIES) as never)
    .mockResolvedValueOnce((overrides.runs ?? []) as never);
}

describe('ScholarshipTreasuryReconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a loading status while the treasury is fetched', () => {
    mockTreasury();
    render(<ScholarshipTreasuryReconciliation role="finance" programId="program-1" />);

    expect(screen.getByRole('status')).toHaveTextContent(/loading treasury accounts/i);
  });

  it('renders an error alert with a next step when the treasury API fails', async () => {
    mockTreasury({ rejects: true });
    render(<ScholarshipTreasuryReconciliation role="finance" programId="program-1" />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/treasury data could not be loaded/i);
    expect(alert).toHaveTextContent(/treasury API unavailable/);
    expect(screen.getByRole('button', { name: /retry loading treasury/i })).toBeInTheDocument();
  });

  it('renders an empty state when there is no run yet', () => {
    mockTreasury();
    render(
      <ScholarshipTreasuryReconciliation
        role="finance"
        initialAccounts={ACCOUNTS}
        initialLiabilities={LIABILITIES}
        initialRuns={[]}
      />
    );

    expect(screen.getByText(/no run yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no reconciliation runs recorded yet/i)).toBeInTheDocument();
  });

  it('renders an empty state when there are no treasury accounts', () => {
    render(
      <ScholarshipTreasuryReconciliation
        role="finance"
        initialAccounts={[]}
        initialLiabilities={[]}
        initialRuns={[]}
      />
    );

    expect(screen.getByText(/no treasury accounts are configured/i)).toBeInTheDocument();
  });

  it('shows position summary tiles in minor units', () => {
    render(
      <ScholarshipTreasuryReconciliation
        role="finance"
        initialAccounts={ACCOUNTS}
        initialLiabilities={LIABILITIES}
        initialRuns={[run()]}
      />
    );

    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('Reserved')).toBeInTheDocument();
    expect(screen.getByText('Payable')).toBeInTheDocument();
    expect(screen.getByText('Net')).toBeInTheDocument();
    expect(screen.getByText(/\$1,000\.00/)).toBeInTheDocument();
  });

  it('states the status in words, not colour alone', () => {
    render(
      <ScholarshipTreasuryReconciliation
        role="finance"
        initialAccounts={ACCOUNTS}
        initialLiabilities={LIABILITIES}
        initialRuns={[run({ status: 'drifted', balanced: false, varianceCents: 50_00 })]}
      />
    );

    const status = screen.getAllByRole('status').find((node) => /Drifted/.test(node.textContent ?? ''));
    expect(status).toBeDefined();
    expect(status).toHaveTextContent(/Drifted — drifted/);
  });

  it('explains the award gate when the treasury is insolvent', () => {
    const insolvent = run({
      status: 'insolvent',
      balanced: false,
      position: { ...run().position, netCents: -300_00 },
    });

    render(
      <ScholarshipTreasuryReconciliation
        role="finance"
        initialAccounts={ACCOUNTS}
        initialLiabilities={LIABILITIES}
        initialRuns={[insolvent]}
      />
    );

    const gate = screen.getByRole('note', { name: /award gate/i });
    expect(gate).toHaveTextContent(/new awards blocked/i);
    expect(gate).toHaveTextContent(/insolvent/i);
  });

  it('explains that new awards are blocked while drift is unacknowledged', () => {
    const drifted = run({
      status: 'drifted',
      balanced: false,
      varianceCents: 50_00,
      discrepancies: [
        {
          id: 'disc-1',
          kind: 'variance',
          expectedCents: 300_00,
          actualCents: 250_00,
          varianceCents: 50_00,
          currency: 'USD',
          description: 'Payable liabilities total 30000 but recorded payables total 25000.',
          alertId: 'alert-1',
        },
      ],
    });

    render(
      <ScholarshipTreasuryReconciliation
        role="finance"
        initialAccounts={ACCOUNTS}
        initialLiabilities={LIABILITIES}
        initialRuns={[drifted]}
      />
    );

    expect(screen.getByRole('note', { name: /award gate/i })).toHaveTextContent(
      /unacknowledged reconciliation discrepanc/i
    );
    const table = screen.getByRole('table', { name: /discrepancies from run run-1/i });
    expect(within(table).getByText('disc-1')).toBeInTheDocument();
    expect(within(table).getByText(/\$50\.00/)).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: /acknowledge/i })).toBeInTheDocument();
  });

  it('appends a new run when reconciliation is run again and never rewrites history', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient).post.mockResolvedValueOnce(run({ id: 'run-2' }) as never);

    render(
      <ScholarshipTreasuryReconciliation
        role="finance"
        initialAccounts={ACCOUNTS}
        initialLiabilities={LIABILITIES}
        initialRuns={[run()]}
      />
    );

    expect(screen.getByText(/never rewrites history/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /run reconciliation/i }));

    await waitFor(() => {
      expect(screen.getByText(/Run run-2 recorded as balanced/i)).toBeInTheDocument();
    });
    expect(vi.mocked(apiClient).post).toHaveBeenCalledWith(
      '/scholarships/treasury/reconciliation-runs',
      expect.objectContaining({ previousRunId: 'run-1' })
    );
    expect(screen.getByText('run-1')).toBeInTheDocument();
    expect(screen.getByText('run-2')).toBeInTheDocument();
  });

  it('records an acknowledgement as a new run', async () => {
    const user = userEvent.setup();
    const drifted = run({
      status: 'drifted',
      balanced: false,
      varianceCents: 50_00,
      discrepancies: [
        {
          id: 'disc-1',
          kind: 'variance',
          expectedCents: 300_00,
          actualCents: 250_00,
          varianceCents: 50_00,
          currency: 'USD',
          description: 'Payable liabilities do not match recorded payables.',
          alertId: 'alert-1',
        },
      ],
    });
    vi.mocked(apiClient).post.mockResolvedValueOnce(
      run({
        id: 'run-2',
        status: 'balanced',
        balanced: true,
        discrepancies: [{ ...drifted.discrepancies[0], acknowledgedAt: AS_OF, acknowledgedBy: 'finance' }],
      }) as never
    );

    render(
      <ScholarshipTreasuryReconciliation
        role="finance"
        initialAccounts={ACCOUNTS}
        initialLiabilities={LIABILITIES}
        initialRuns={[drifted]}
      />
    );

    await user.click(screen.getByRole('button', { name: /acknowledge/i }));

    await waitFor(() => {
      expect(vi.mocked(apiClient).post).toHaveBeenCalledWith(
        '/scholarships/treasury/reconciliation-runs/run-1/acknowledgements',
        { discrepancyId: 'disc-1', by: 'finance' }
      );
    });
    expect(await screen.findByText(/original run and its discrepancies remain on record/i)).toBeInTheDocument();
  });

  it('renders a permission notice and disables mutations for a student role', () => {
    render(
      <ScholarshipTreasuryReconciliation
        role="student"
        initialAccounts={ACCOUNTS}
        initialLiabilities={LIABILITIES}
        initialRuns={[run()]}
      />
    );

    const notice = screen.getByRole('note', { name: /treasury permission notice/i });
    expect(notice).toHaveTextContent(/not available for your role/i);
    expect(notice).toHaveTextContent(/ask a finance, sponsor, or administrator/i);
    expect(screen.getByRole('button', { name: /run reconciliation/i })).toBeDisabled();
    expect(screen.getByText(/Acknowledgement controls are disabled/i)).toBeInTheDocument();
  });
});
