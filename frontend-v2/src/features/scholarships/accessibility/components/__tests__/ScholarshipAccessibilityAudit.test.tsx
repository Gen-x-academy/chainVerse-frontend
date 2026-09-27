import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { A11yStatusBadge } from '../A11yStatusBadge';
import { ScholarshipAccessibilityAudit } from '../ScholarshipAccessibilityAudit';
import { accessibilityService, WCAG_SEED_CRITERIA } from '../../service';
import type { A11yCheckResult } from '../../types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const RESULTS: A11yCheckResult[] = [
  {
    criterionId: '1.4.3',
    status: 'fail',
    automated: true,
    evidence: 'axe-core: contrast 2.85:1 on the rubric badge',
    checkedAt: '2025-09-01T12:00:00.000Z',
  },
  {
    criterionId: '1.1.1',
    status: 'pass',
    automated: true,
    evidence: 'all decorative icons are aria-hidden',
    checkedAt: '2025-09-01T12:00:00.000Z',
  },
];

function mockLoaded() {
  vi.spyOn(accessibilityService, 'listCriteria').mockResolvedValue(WCAG_SEED_CRITERIA);
  vi.spyOn(accessibilityService, 'listResults').mockResolvedValue(RESULTS);
}

async function renderAudit() {
  render(<ScholarshipAccessibilityAudit />);
  return screen.findByRole('heading', { name: /wcag audit by journey/i });
}

describe('A11yStatusBadge', () => {
  it('never relies on colour alone', () => {
    render(<A11yStatusBadge status="fail" criterionId="1.4.3" />);
    const badge = screen.getByText('1.4.3: Fail');
    expect(badge).toBeInTheDocument();
    expect(badge.parentElement).toHaveAttribute('data-status', 'fail');
    // The glyph is decorative and hidden from assistive technology.
    expect(badge.previousElementSibling).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('ScholarshipAccessibilityAudit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a loading state', () => {
    vi.spyOn(accessibilityService, 'listCriteria').mockReturnValue(new Promise(() => {}));
    vi.spyOn(accessibilityService, 'listResults').mockReturnValue(new Promise(() => {}));
    render(<ScholarshipAccessibilityAudit />);

    expect(screen.getByRole('status')).toHaveTextContent(/loading wcag criteria/i);
  });

  it('renders an error state with a retry action', async () => {
    const criteria = vi.spyOn(accessibilityService, 'listCriteria').mockRejectedValue(new Error('audit offline'));
    render(<ScholarshipAccessibilityAudit />);

    expect(await screen.findByRole('alert')).toHaveTextContent('audit offline');
    mockLoaded();
    await fireEvent.click(screen.getByRole('button', { name: /retry loading the audit/i }));
    expect(await screen.findByRole('heading', { name: /wcag audit by journey/i })).toBeInTheDocument();
    expect(criteria).toHaveBeenCalled();
  });

  it('renders an empty state when no criteria are configured', async () => {
    vi.spyOn(accessibilityService, 'listCriteria').mockResolvedValue([]);
    vi.spyOn(accessibilityService, 'listResults').mockResolvedValue([]);
    render(<ScholarshipAccessibilityAudit />);

    expect(await screen.findByRole('status')).toHaveTextContent(/no wcag criteria are configured/i);
  });

  it('renders a permission-denied note', () => {
    render(<ScholarshipAccessibilityAudit canManage={false} />);
    expect(screen.getByRole('note')).toHaveTextContent(/cannot record accessibility results/i);
  });

  it('uses real table semantics with a caption and column headers', async () => {
    mockLoaded();
    await renderAudit();

    const table = screen.getByRole('table');
    expect(table).toHaveAccessibleName(/wcag success criteria tracked/i);
    const headers = within(table).getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual([
      'Criterion',
      'Level',
      'Journey',
      'Check',
      'Status',
    ]);
    expect(within(table).getAllByRole('rowheader').length).toBe(WCAG_SEED_CRITERIA.length);
  });

  it('filters the table by journey', async () => {
    mockLoaded();
    await renderAudit();

    fireEvent.change(screen.getByLabelText('Journey'), { target: { value: 'financial-tables' } });

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('rowheader');
    expect(rows).toHaveLength(4);
    expect(table).toHaveAccessibleName(/financial tables and disbursements/i);
  });

  it('summarises blocking failures from failing A and AA criteria', async () => {
    mockLoaded();
    await renderAudit();

    expect(
      screen.getByText((_, element) => element?.textContent?.startsWith('2 criteria tracked, 1 passing, 1 failing, 0 untested') === true)
    ).toBeInTheDocument();
    const blocking = screen.getByText(/Blocking failures \(1\)/).parentElement as HTMLElement;
    expect(blocking).toHaveTextContent('1.4.3');
  });

  it('runs the checks and reports the outcome', async () => {
    mockLoaded();
    const run = vi.spyOn(accessibilityService, 'runChecks').mockResolvedValue(RESULTS);
    await renderAudit();

    fireEvent.click(screen.getByRole('button', { name: /run checks/i }));

    await waitFor(() => expect(run).toHaveBeenCalled());
    expect(run.mock.calls[0][0].idempotencyKey).toMatch(/^a11y-chainverse-scholarship-/);
    expect(await screen.findByText('Checks complete.')).toBeInTheDocument();
  });

  it('surfaces a failed check run', async () => {
    mockLoaded();
    vi.spyOn(accessibilityService, 'runChecks').mockRejectedValue(new Error('scanner unavailable'));
    await renderAudit();

    fireEvent.click(screen.getByRole('button', { name: /run checks/i }));
    expect(await screen.findByText('scanner unavailable')).toBeInTheDocument();
  });

  it('computes a contrast ratio and reports AA and AAA verdicts', async () => {
    mockLoaded();
    await renderAudit();

    const foreground = screen.getByLabelText(/foreground colour/i);
    const background = screen.getByLabelText(/background colour/i);
    expect(background).toHaveAttribute('aria-invalid', 'false');

    fireEvent.change(foreground, { target: { value: '#767676' } });
    fireEvent.change(background, { target: { value: '#ffffff' } });

    expect(screen.getByText('4.54:1')).toBeInTheDocument();
    expect(screen.getByText(/AA needs 4.5:1 for normal text/)).toBeInTheDocument();
    expect(screen.getByText(/AAA needs 7:1 for normal text/)).toBeInTheDocument();
    expect(screen.getAllByText('Pass').length).toBe(1);

    fireEvent.change(foreground, { target: { value: 'not-a-colour' } });
    expect(foreground).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/enter two hex colours/i)).toBeInTheDocument();
  });

  it('shows status as text and glyph, not colour alone', async () => {
    mockLoaded();
    await renderAudit();

    expect(screen.getByText('1.4.3: Fail')).toBeInTheDocument();
    expect(screen.getByText('1.1.1: Pass')).toBeInTheDocument();
    expect(screen.getAllByText(/: Untested$/).length).toBe(WCAG_SEED_CRITERIA.length - RESULTS.length);
  });
});
