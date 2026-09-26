import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SponsorProgramDashboard, type SponsorDashboardData } from '../SponsorProgramDashboard';

const SCOPE = { sponsorId: 'sponsor-acme', programIds: ['chainverse-scholarship'] };

const DATA: SponsorDashboardData = {
  scope: SCOPE,
  programName: 'ChainVerse Scholarship',
  budgetCents: 1_000_000,
  committedCents: 400_000,
  disbursedCents: 250_000,
  currency: 'USD',
  applications: [
    { id: 'app-1', programId: 'chainverse-scholarship', stage: 'submitted', awarded: false },
    { id: 'app-2', programId: 'chainverse-scholarship', stage: 'awarded', awarded: true },
  ],
  reviews: [
    { programId: 'chainverse-scholarship', status: 'assigned', dueAt: '2099-01-01T00:00:00.000Z' },
    { programId: 'chainverse-scholarship', status: 'completed', dueAt: '2020-01-01T00:00:00.000Z' },
  ],
  ledgerTotals: {
    programId: 'chainverse-scholarship',
    committedCents: 400_000,
    disbursedCents: 250_000,
    currency: 'USD',
  },
  impact: [
    {
      id: 'reach',
      label: 'Students funded',
      value: '12',
      unit: 'count',
      direction: 'up',
      definition: 'Distinct students holding an awarded, non-reversed award in this program this academic year.',
    },
  ],
  computedAt: new Date().toISOString(),
};

describe('SponsorProgramDashboard', () => {
  it('renders a permission note for an unauthorised viewer', () => {
    render(<SponsorProgramDashboard data={DATA} allowed={false} />);
    expect(screen.getByRole('note')).toHaveTextContent(/do not have permission/i);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders a loading state politely', () => {
    render(<SponsorProgramDashboard data={null} loading />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading sponsor program dashboard/i);
  });

  it('renders an error state with a next step', () => {
    render(<SponsorProgramDashboard data={null} error="dashboard service unavailable" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/dashboard service unavailable/i);
    expect(alert).toHaveTextContent(/next step/i);
  });

  it('renders an empty state when the sponsor has no activity', () => {
    render(
      <SponsorProgramDashboard
        data={{
          ...DATA,
          committedCents: 0,
          applications: [],
          reviews: [],
          ledgerTotals: { ...DATA.ledgerTotals, committedCents: 0 },
          impact: [],
        }}
      />
    );
    expect(screen.getByRole('status')).toHaveTextContent(/no activity in this program yet/i);
  });

  it('refuses a program outside the sponsor scope with a permission note', () => {
    render(<SponsorProgramDashboard programId="program-other" data={DATA} />);
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(/out of scope/i);
    expect(note).toHaveTextContent('program-other');
  });

  it('shows budget tiles and states the ledger reconciliation in words', () => {
    render(<SponsorProgramDashboard data={DATA} />);
    expect(screen.getByText('$10,000.00')).toBeInTheDocument();
    expect(screen.getByText('$4,000.00')).toBeInTheDocument();
    expect(screen.getByText(/these totals reconcile with the ledger/i)).toBeInTheDocument();
  });

  it('says so plainly when the totals do not reconcile', () => {
    render(
      <SponsorProgramDashboard
        data={{ ...DATA, ledgerTotals: { ...DATA.ledgerTotals, disbursedCents: 1 } }}
      />
    );
    expect(screen.getByText(/do not reconcile with the ledger/i)).toBeInTheDocument();
  });

  it('reports an overspend instead of a negative remainder', () => {
    render(<SponsorProgramDashboard data={{ ...DATA, committedCents: 1_500_000 }} />);
    expect(screen.getByText(/over budget by \$5,000\.00/i)).toBeInTheDocument();
  });

  it('renders the funnel as an accessible table in stage order', () => {
    render(<SponsorProgramDashboard data={DATA} />);
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('rowheader');
    expect(rows.map((row) => row.textContent)).toEqual([
      'Eligible',
      'Started',
      'Submitted',
      'Reviewed',
      'Decided',
      'Awarded',
    ]);
    rows.forEach((row) => expect(row).toHaveAttribute('scope', 'row'));
    within(table).getAllByRole('columnheader').forEach((header) =>
      expect(header).toHaveAttribute('scope', 'col')
    );
  });

  it('shows review-progress counters without counting completed work as overdue', () => {
    render(<SponsorProgramDashboard data={DATA} />);
    expect(screen.getByText('Assigned')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.queryByText(/past their due date/i)).not.toBeInTheDocument();
  });

  it('discloses the definition behind each impact indicator', () => {
    render(<SponsorProgramDashboard data={DATA} />);
    const disclosure = screen.getByText(/how is this defined/i);
    expect(disclosure.tagName).toBe('SUMMARY');
    expect(
      screen.getByText(/distinct students holding an awarded, non-reversed award/i)
    ).toBeInTheDocument();
  });

  it('shows a freshness badge and warns when the data is stale', () => {
    const { unmount } = render(<SponsorProgramDashboard data={DATA} />);
    expect(screen.getByText(/fresh — computed/i)).toBeInTheDocument();
    unmount();

    render(
      <SponsorProgramDashboard
        data={{ ...DATA, computedAt: new Date(Date.now() - 3600_000).toISOString() }}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/data is stale/i);
    expect(screen.getByText(/data is stale — computed/i)).toBeInTheDocument();
  });
});
