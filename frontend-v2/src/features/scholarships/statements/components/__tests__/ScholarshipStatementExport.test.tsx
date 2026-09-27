import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ScholarshipStatementExport } from '../ScholarshipStatementExport';
import { summariseLines } from '../../service';
import type { LedgerEntryRef, Statement, StatementLine } from '../../types';

const line = (overrides: Partial<StatementLine> = {}): StatementLine => ({
  id: 'line-1',
  kind: 'contribution',
  occurredAt: '2026-01-10T00:00:00.000Z',
  description: 'Sponsor contribution',
  amountCents: 100_000,
  currency: 'USD',
  ledgerEntryId: 'ledger-1',
  ...overrides,
});

const statementWith = (lines: StatementLine[]): Statement => ({
  id: 'statement-1',
  sponsorId: 'sponsor-acme',
  programId: 'chainverse-scholarship',
  period: { from: '2026-01-01', to: '2026-03-31' },
  currency: 'USD',
  lines,
  totals: summariseLines(lines),
  generatedAt: '2026-04-01T00:00:00.000Z',
  generatedBy: 'finance-1',
  format: 'csv',
  ledgerHash: 'sha256:abc',
});

const LEDGER: LedgerEntryRef[] = [{ id: 'ledger-1', amountCents: 100_000, currency: 'USD' }];

describe('ScholarshipStatementExport', () => {
  it('renders a permission note rather than financial data', () => {
    render(<ScholarshipStatementExport canExport={false} initialStatement={statementWith([line()])} />);
    expect(screen.getByRole('note')).toHaveTextContent(/do not have permission/i);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders an empty state for a period with no activity', () => {
    render(<ScholarshipStatementExport initialStatement={null} />);
    expect(screen.getByRole('status')).toHaveTextContent(/no activity in this period/i);
  });

  it('renders a statement with a totals grid and a line table', () => {
    render(<ScholarshipStatementExport initialStatement={statementWith([line()])} ledgerEntries={LEDGER} />);

    expect(screen.getByRole('heading', { name: /totals \(usd\)/i })).toBeInTheDocument();
    expect(screen.getAllByText('$1,000.00').length).toBeGreaterThan(0);

    const table = screen.getByRole('table');
    expect(within(table).getByRole('caption')).toHaveTextContent(/ledger entry/i);
    const headers = within(table).getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual(['Date', 'Kind', 'Description', 'Amount', 'Ledger entry']);
    headers.forEach((header) => expect(header).toHaveAttribute('scope', 'col'));
    expect(within(table).getByRole('rowheader')).toHaveAttribute('scope', 'row');
  });

  it('reports reconciliation status in words', () => {
    render(<ScholarshipStatementExport initialStatement={statementWith([line()])} ledgerEntries={LEDGER} />);
    expect(screen.getByRole('status')).toHaveTextContent(/balanced/i);
  });

  it('reports a missing ledger entry as a discrepancy', () => {
    render(<ScholarshipStatementExport initialStatement={statementWith([line()])} ledgerEntries={[]} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'polite');
    expect(alert).toHaveTextContent(/1 discrepancy/i);
    expect(alert).toHaveTextContent(/no matching ledger entry/i);
  });

  it('warns when a statement mixes currencies', () => {
    render(
      <ScholarshipStatementExport
        initialStatement={statementWith([line(), line({ id: 'line-2', currency: 'EUR', ledgerEntryId: 'ledger-2' })])}
        ledgerEntries={[
          { id: 'ledger-1', amountCents: 100_000, currency: 'USD' },
          { id: 'ledger-2', amountCents: 100_000, currency: 'EUR' },
        ]}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/currency mismatch/i);
  });

  it('queues a large export as a job instead of downloading it', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn().mockResolvedValue({
      kind: 'job',
      job: { id: 'job-1', statementId: 'statement-1', status: 'queued', requestedAt: new Date().toISOString(), lineCount: 501 },
    });
    render(<ScholarshipStatementExport initialStatement={statementWith([line()])} onExport={onExport} />);

    await user.click(screen.getByRole('button', { name: /export statement/i }));

    expect(onExport).toHaveBeenCalledWith(expect.objectContaining({ format: 'csv' }), 1);
    expect(screen.getByRole('status')).toHaveTextContent(/queued — you'll be notified/i);
    expect(screen.getByText(/export job status: queued/i)).toBeInTheDocument();
  });

  it('downloads a small statement inline', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn().mockResolvedValue({ kind: 'statement', statement: statementWith([line()]) });
    render(<ScholarshipStatementExport initialStatement={statementWith([line()])} onExport={onExport} />);

    await user.click(screen.getByRole('button', { name: /export statement/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/ready to download/i);
  });

  it('surfaces an export failure as an alert', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn().mockRejectedValue(new Error('export service unavailable'));
    render(<ScholarshipStatementExport initialStatement={statementWith([line()])} onExport={onExport} />);

    await user.click(screen.getByRole('button', { name: /export statement/i }));
    expect(screen.getByText(/export service unavailable/i)).toBeInTheDocument();
  });

  it('labels every input and blocks generation while the period is invalid', async () => {
    const user = userEvent.setup();
    render(<ScholarshipStatementExport initialStatement={null} />);

    const start = screen.getByLabelText(/period start/i);
    expect(start).toBeInTheDocument();
    await user.clear(start);
    await user.type(start, '2026-05-01');

    expect(start).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: /generate statement/i })).toBeDisabled();
    expect(screen.getByText(/on or before the end date/i)).toBeInTheDocument();
  });

  it('surfaces a generation error with a next step', () => {
    render(<ScholarshipStatementExport initialStatement={null} error="statement service unavailable" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/statement service unavailable/i);
    expect(alert).toHaveTextContent(/next step/i);
  });
});
