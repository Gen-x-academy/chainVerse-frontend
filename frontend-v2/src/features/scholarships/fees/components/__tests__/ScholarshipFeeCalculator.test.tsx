import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScholarshipFeeCalculator } from '../ScholarshipFeeCalculator';
import type { FeeScheduleVersion } from '../../types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { apiClient } from '@/src/lib/api-client';

const VERSIONS: FeeScheduleVersion[] = [
  {
    version: 'v1.0.0',
    effectiveFrom: '2025-12-01T00:00:00.000Z',
    components: [
      {
        id: 'p',
        name: 'Platform fee',
        kind: 'platform',
        basis: 'gross-amount',
        rateBps: 250,
        flatCents: 0,
        currency: 'USD',
      },
      {
        id: 'n',
        name: 'Network fee',
        kind: 'network',
        basis: 'gross-amount',
        rateBps: 50,
        flatCents: 0,
        currency: 'USD',
      },
    ],
    createdBy: 'finance-user',
    createdAt: '2025-11-01T00:00:00.000Z',
    status: 'superseded',
  },
  {
    version: 'v1.1.0',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    components: [
      {
        id: 'p',
        name: 'Platform fee',
        kind: 'platform',
        basis: 'gross-amount',
        rateBps: 300,
        flatCents: 0,
        currency: 'USD',
      },
      {
        id: 'n',
        name: 'Network fee',
        kind: 'network',
        basis: 'gross-amount',
        rateBps: 50,
        flatCents: 0,
        currency: 'USD',
      },
    ],
    createdBy: 'finance-user',
    createdAt: '2025-12-15T00:00:00.000Z',
    status: 'active',
  },
  {
    version: 'v1.2.0',
    effectiveFrom: '2026-06-01T00:00:00.000Z',
    components: [
      {
        id: 'p',
        name: 'Platform fee',
        kind: 'platform',
        basis: 'gross-amount',
        rateBps: 350,
        flatCents: 0,
        currency: 'USD',
      },
    ],
    createdBy: 'finance-user',
    createdAt: '2026-01-05T00:00:00.000Z',
    status: 'draft',
  },
];

function mockFees(overrides: { rejects?: boolean } = {}) {
  const mock = vi.mocked(apiClient);
  if (overrides.rejects) {
    mock.get.mockRejectedValue(new Error('fee API unavailable'));
    return;
  }
  mock.get
    .mockResolvedValueOnce(VERSIONS as never)
    .mockResolvedValueOnce([] as never)
    .mockResolvedValueOnce({ platformRevenueCents: 0, networkCostCents: 0, currency: 'USD' } as never);
}

function renderReady(props: Partial<Parameters<typeof ScholarshipFeeCalculator>[0]> = {}) {
  return render(
    <ScholarshipFeeCalculator
      role="finance"
      currency="USD"
      initialVersions={VERSIONS}
      initialQuotes={[]}
      initialLedger={{ platformRevenueCents: 0, networkCostCents: 0, currency: 'USD' }}
      at="2026-02-01T00:00:00.000Z"
      {...props}
    />
  );
}

describe('ScholarshipFeeCalculator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a loading status while fee schedules are fetched', () => {
    mockFees();
    render(<ScholarshipFeeCalculator role="finance" />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading fee schedules/i);
  });

  it('renders an error alert with a next step when the fee API fails', async () => {
    mockFees({ rejects: true });
    render(<ScholarshipFeeCalculator role="finance" />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/fee schedules could not be loaded/i);
    expect(alert).toHaveTextContent(/fee API unavailable/);
    expect(screen.getByRole('button', { name: /retry loading fees/i })).toBeInTheDocument();
  });

  it('renders an empty state when no schedule versions exist', () => {
    renderReady({ initialVersions: [] });
    expect(screen.getByText(/no fee schedule versions exist yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no fee schedule versions\./i)).toBeInTheDocument();
  });

  it('lists schedule versions with effective dates and statuses', () => {
    renderReady();
    const list = screen.getByRole('list', { name: /fee schedule versions/i });
    expect(within(list).getAllByText('Active').length).toBeGreaterThan(0);
    expect(within(list).getAllByText('Superseded').length).toBeGreaterThan(0);
    expect(within(list).getAllByText('Draft').length).toBeGreaterThan(0);
    expect(within(list).getByText(/Effective 2026-01-01T00:00:00.000Z/)).toBeInTheDocument();
  });

  it('offers a schedule version selector showing effective dates and status', () => {
    renderReady();
    const select = screen.getByLabelText(/^schedule version$/i);
    expect(select).toHaveValue('v1.1.0');
    expect(screen.getByRole('option', { name: /v1\.1\.0 — effective 2026-01-01T00:00:00.000Z — Active/ })).toBeInTheDocument();
  });

  it('shows a live preview from gross through to the net recipient', () => {
    renderReady();
    const table = screen.getByRole('table', { name: /live fee preview/i });
    expect(table).toHaveTextContent('Gross amount');
    expect(table).toHaveTextContent('Platform fee');
    expect(table).toHaveTextContent('Network fee');
    expect(table).toHaveTextContent('Total fee');
    expect(table).toHaveTextContent('Net recipient');
    // 100000 minor units at 300 bps + 50 bps = 350 bps = 3500.
    expect(table).toHaveTextContent('$1,000.00');
    expect(table).toHaveTextContent('$30.00');
    expect(table).toHaveTextContent('$5.00');
    expect(table).toHaveTextContent('$965.00');
  });

  it('shows the rounding mode and an explicit balance line', () => {
    renderReady();
    expect(screen.getAllByText('half-even').length).toBeGreaterThan(0);
    expect(screen.getByText(/rounding mode:/i)).toBeInTheDocument();
    const balance = screen.getByTestId('balance-line');
    expect(balance).toHaveTextContent('Net + fees = gross ✓');
    expect(balance).toHaveAttribute('role', 'status');
  });

  it('recomputes the preview when the gross amount or rounding mode changes', async () => {
    const user = userEvent.setup();
    renderReady();

    const gross = screen.getByLabelText(/gross amount \(minor units\)/i);
    await user.clear(gross);
    await user.type(gross, '1000');

    // 1000 minor units at 300 bps platform + 50 bps network = 35 minor units.
    const table = screen.getByRole('table', { name: /live fee preview/i });
    expect(table).toHaveTextContent('$0.30');
    expect(table).toHaveTextContent('$0.05');
    expect(table).toHaveTextContent('$0.35');
    expect(table).toHaveTextContent('$9.65');

    await user.selectOptions(screen.getByLabelText(/rounding mode/i), 'down');
    const roundingLine = screen.getByText(/rounding mode:/i);
    expect(roundingLine).toHaveTextContent('down');
  });

  it('warns rather than quoting a partial minor unit', async () => {
    const user = userEvent.setup();
    renderReady();

    const gross = screen.getByLabelText(/gross amount \(minor units\)/i);
    await user.clear(gross);
    await user.type(gross, '10.5');

    expect(screen.getAllByRole('alert').some((node) => /whole number of minor units/i.test(node.textContent ?? ''))).toBe(true);
    expect(screen.queryByTestId('balance-line')).not.toBeInTheDocument();
  });

  it('shows a separate fee revenue account', () => {
    renderReady();
    expect(screen.getByText('Platform revenue')).toBeInTheDocument();
    expect(screen.getByText('Network cost')).toBeInTheDocument();
    expect(screen.getByText(/accounted separately from scholarship disbursement/i)).toBeInTheDocument();
  });

  it('refuses to total fee revenue across currencies', () => {
    renderReady({
      initialQuotes: [
        {
          scheduleVersion: 'v1.1.0',
          grossCents: 100_00,
          platformFeeCents: 300,
          networkFeeCents: 50,
          totalFeeCents: 350,
          netRecipientCents: 96_50,
          currency: 'USD',
          rounding: 'half-even',
          quotedAt: '2026-02-01T00:00:00.000Z',
        },
        {
          scheduleVersion: 'v1.1.0',
          grossCents: 100_00,
          platformFeeCents: 300,
          networkFeeCents: 50,
          totalFeeCents: 350,
          netRecipientCents: 96_50,
          currency: 'NGN',
          rounding: 'half-even',
          quotedAt: '2026-02-01T00:00:00.000Z',
        },
      ],
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/more than one currency/i);
  });

  it('activates a draft version and supersedes the previous one without deleting it', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient).post.mockResolvedValueOnce({
      ...VERSIONS[2],
      status: 'active',
    } as never);

    renderReady();
    await user.click(screen.getByRole('button', { name: /^activate$/i }));

    await waitFor(() => {
      expect(vi.mocked(apiClient).post).toHaveBeenCalledWith(
        '/scholarships/fees/schedules/v1.2.0/activation',
        { activatedBy: 'finance', expectedStatus: 'draft' }
      );
    });
    expect(screen.getByText(/is now active\..*retained as superseded — history is never deleted/i)).toBeInTheDocument();
    const list = screen.getByRole('list', { name: /fee schedule versions/i });
    expect(within(list).getByText('v1.1.0')).toBeInTheDocument();
    expect(within(list).getByText('v1.0.0')).toBeInTheDocument();
  });

  it('records a quote against the selected schedule version', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient).post.mockResolvedValueOnce({
      scheduleVersion: 'v1.1.0',
      grossCents: 100_000,
      platformFeeCents: 3_000,
      networkFeeCents: 500,
      totalFeeCents: 3_500,
      netRecipientCents: 96_500,
      currency: 'USD',
      rounding: 'half-even',
      quotedAt: '2026-02-01T00:00:00.000Z',
    } as never);

    renderReady();
    await user.click(screen.getByRole('button', { name: /record quote/i }));

    await waitFor(() => {
      expect(vi.mocked(apiClient).post).toHaveBeenCalledWith('/scholarships/fees/quotes', {
        grossCents: 100_000,
        currency: 'USD',
        scheduleVersion: 'v1.1.0',
        rounding: 'half-even',
        idempotencyKey: 'fee-quote-v1.1.0-100000',
      });
    });
  });

  it('denies schedule management to non-finance roles', () => {
    renderReady({ role: 'sponsor' });

    const notice = screen.getByRole('note', { name: /fee permission notice/i });
    expect(notice).toHaveTextContent(/not available for your role/i);
    expect(notice).toHaveTextContent(/ask a finance or administrator/i);
    expect(screen.getByRole('button', { name: /^activate$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /create draft from active version/i })).toBeDisabled();
    expect(screen.getByText(/version controls are disabled/i)).toBeInTheDocument();
  });
});
