import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StudentScholarshipDashboard } from '../StudentScholarshipDashboard';
import { buildStudentDashboard, type StudentDashboardParts } from '../../service';

const NOW = new Date('2026-04-01T12:00:00.000Z');

const PARTS: StudentDashboardParts = {
  programs: { ok: true, counts: { discoverablePrograms: 4 }, asOf: '2026-04-01T11:59:00.000Z', source: 'api' },
  applications: { ok: true, counts: { drafts: 1 }, asOf: '2026-04-01T11:59:00.000Z', source: 'api' },
  decisions: { ok: false, error: 'decision service unavailable', asOf: '2026-04-01T11:59:00.000Z' },
  awards: { ok: true, counts: { awards: 1 }, asOf: '2026-04-01T11:59:00.000Z', source: 'api' },
  milestones: { ok: true, counts: { openMilestones: 0 }, asOf: '2026-04-01T11:59:00.000Z', source: 'api' },
  payments: { ok: true, counts: { payments: 2 }, asOf: '2026-04-01T11:59:00.000Z', source: 'api' },
};

const dashboard = buildStudentDashboard('student-1', PARTS, NOW);

const tile = (name: RegExp) => screen.getByRole('heading', { name }).closest('li') as HTMLElement;

describe('StudentScholarshipDashboard', () => {
  it('renders a permission note instead of counts', () => {
    render(<StudentScholarshipDashboard dashboard={dashboard} allowed={false} />);
    expect(screen.getByRole('note')).toHaveTextContent(/do not have permission/i);
    expect(screen.queryByRole('heading', { name: /open milestones/i })).not.toBeInTheDocument();
  });

  it('renders a loading skeleton politely', () => {
    render(<StudentScholarshipDashboard loading />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading your scholarship journey/i);
  });

  it('renders a full error state with a retry', () => {
    render(<StudentScholarshipDashboard error="dashboard service unavailable" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/dashboard service unavailable/i);
    expect(within(alert).getByRole('button', { name: /retry dashboard/i })).toBeEnabled();
  });

  it('renders a real heading per journey tile', () => {
    render(<StudentScholarshipDashboard dashboard={dashboard} />);
    for (const title of [
      /discoverable programs/i,
      /applications in progress/i,
      /decisions/i,
      /awards/i,
      /open milestones/i,
      /payments/i,
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
  });

  it('shows a count and an "as of" freshness line per tile', () => {
    render(<StudentScholarshipDashboard dashboard={dashboard} />);
    expect(tile(/discoverable programs/i)).toHaveTextContent('4');
    expect(tile(/discoverable programs/i)).toHaveTextContent(/as of/i);
    expect(tile(/discoverable programs/i)).toHaveTextContent(/source api/i);
  });

  it('states status in words rather than colour alone', () => {
    render(<StudentScholarshipDashboard dashboard={dashboard} />);
    expect(tile(/awards/i)).toHaveTextContent(/status: up to date/i);
    expect(tile(/open milestones/i)).toHaveTextContent(/status: nothing here yet/i);
    expect(tile(/decisions/i)).toHaveTextContent(/status: could not load/i);
  });

  it('isolates a failed section to its own tile and offers a retry for it only', async () => {
    const user = userEvent.setup();
    const onRetrySection = vi.fn().mockResolvedValue(undefined);
    render(<StudentScholarshipDashboard dashboard={dashboard} onRetrySection={onRetrySection} />);

    const failedTile = tile(/decisions/i);
    expect(within(failedTile).getByRole('alert')).toHaveTextContent(/decision service unavailable/i);
    expect(within(failedTile).getAllByRole('button')).toHaveLength(1);

    await user.click(within(failedTile).getByRole('button', { name: /retry this section/i }));
    expect(onRetrySection).toHaveBeenCalledWith('decisions');
  });

  it('offers a next-step link for an empty section', () => {
    render(<StudentScholarshipDashboard dashboard={dashboard} />);
    const emptyTile = tile(/open milestones/i);
    const link = within(emptyTile).getByRole('link', { name: /submit milestone evidence/i });
    expect(link).toHaveAttribute('href', '/scholarships/awards');
  });

  it('warns that the whole dashboard failed when every part errored', () => {
    const failing: StudentDashboardParts = {
      programs: { ok: false, error: 'down', asOf: NOW.toISOString() },
      applications: { ok: false, error: 'down', asOf: NOW.toISOString() },
      decisions: { ok: false, error: 'down', asOf: NOW.toISOString() },
      awards: { ok: false, error: 'down', asOf: NOW.toISOString() },
      milestones: { ok: false, error: 'down', asOf: NOW.toISOString() },
      payments: { ok: false, error: 'down', asOf: NOW.toISOString() },
    };
    render(<StudentScholarshipDashboard dashboard={buildStudentDashboard('student-1', failing, NOW)} />);
    expect(screen.getByText(/no section could be loaded/i)).toBeInTheDocument();
  });
});
