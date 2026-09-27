import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScholarshipFairnessReport } from '../ScholarshipFairnessReport';
import { fairnessService, MIN_COHORT_SIZE } from '../../service';
import type { BiasAudit, FunnelMetric } from '../../types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const FUNNEL: FunnelMetric[] = [
  {
    programId: 'p1',
    stage: 'eligible',
    cohortSize: 100,
    count: 100,
    rateFromPrevious: null,
    rateFromEligible: 1,
    suppressed: false,
  },
  {
    programId: 'p1',
    stage: 'submitted',
    cohortSize: 3,
    count: 0,
    rateFromPrevious: null,
    rateFromEligible: 0,
    suppressed: true,
    suppressedReason: 'SMALL_COHORT',
  },
  {
    programId: 'p1',
    stage: 'awarded',
    cohortSize: 100,
    count: 12,
    rateFromPrevious: 0.4,
    rateFromEligible: 0.12,
    suppressed: false,
  },
];

const AUDIT_HIGH_RISK: BiasAudit = {
  id: 'audit-1',
  ruleVersionId: 'scoring-v4',
  owner: 'equity-team',
  testCohort: '2024-25 round',
  disparateImpactRatio: 0.62,
  worstAffectedGroup: 'region: Islands',
  mitigations: [],
  rollbackPlan: 'Restore scoring-v3 and re-score the round.',
  approvalRequired: true,
  outcome: 'cleared',
  reviewedAt: '2025-09-01T00:00:00.000Z',
};

function mockLoaded() {
  vi.spyOn(fairnessService, 'getFunnel').mockResolvedValue(FUNNEL);
  vi.spyOn(fairnessService, 'getAudits').mockResolvedValue([AUDIT_HIGH_RISK]);
}

async function renderReport() {
  render(<ScholarshipFairnessReport />);
  return screen.findByRole('heading', { name: /selection funnel and bias audit/i });
}

describe('ScholarshipFairnessReport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a loading state', () => {
    vi.spyOn(fairnessService, 'getFunnel').mockReturnValue(new Promise(() => {}));
    vi.spyOn(fairnessService, 'getAudits').mockReturnValue(new Promise(() => {}));
    render(<ScholarshipFairnessReport />);

    expect(screen.getByRole('status')).toHaveTextContent(/loading funnel and bias audit data/i);
  });

  it('renders an error state with a retry action', async () => {
    const funnel = vi.spyOn(fairnessService, 'getFunnel').mockRejectedValue(new Error('fairness service down'));
    render(<ScholarshipFairnessReport />);

    expect(await screen.findByRole('alert')).toHaveTextContent('fairness service down');
    mockLoaded();
    fireEvent.click(screen.getByRole('button', { name: /retry loading the report/i }));
    expect(await screen.findByRole('heading', { name: /selection funnel and bias audit/i })).toBeInTheDocument();
    expect(funnel).toHaveBeenCalled();
  });

  it('renders an empty state when no fairness data exists', async () => {
    vi.spyOn(fairnessService, 'getFunnel').mockResolvedValue([]);
    vi.spyOn(fairnessService, 'getAudits').mockResolvedValue([]);
    render(<ScholarshipFairnessReport />);

    expect(await screen.findByRole('status')).toHaveTextContent(/no fairness data is available/i);
  });

  it('renders a permission-denied note', () => {
    render(<ScholarshipFairnessReport canManage={false} />);
    expect(screen.getByRole('note')).toHaveTextContent(/cannot edit a bias audit or a rollback plan/i);
  });

  it('uses real table semantics for the funnel', async () => {
    mockLoaded();
    await renderReport();

    const table = screen.getByRole('table');
    expect(table).toHaveAccessibleName(/application funnel/i);
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Stage',
      'Applicants',
      'From previous stage',
      'From eligible',
    ]);
    expect(within(table).getAllByRole('rowheader').map((cell) => cell.textContent)).toEqual([
      'Eligible',
      'Submitted',
      'Awarded',
    ]);
  });

  it('never renders a number for a suppressed cell', async () => {
    mockLoaded();
    await renderReport();

    const table = screen.getByRole('table');
    const row = within(table).getByRole('rowheader', { name: 'Submitted' }).closest('tr') as HTMLElement;
    expect(row).toHaveTextContent(`Suppressed (cohort < ${MIN_COHORT_SIZE})`);
    expect(row).toHaveTextContent('Not available');
    expect(row).not.toHaveTextContent('3');
  });

  it('labels the suppression for assistive technology', async () => {
    mockLoaded();
    await renderReport();

    const table = screen.getByRole('table');
    const row = within(table).getByRole('rowheader', { name: 'Submitted' }).closest('tr') as HTMLElement;
    const suppression = within(row).getByLabelText(
      `Applicants suppressed because the cohort is smaller than ${MIN_COHORT_SIZE}`
    );
    expect(suppression).toHaveTextContent('Suppressed');
  });

  it('discloses a definition and a caveat for every metric', async () => {
    mockLoaded();
    await renderReport();

    const details = screen.getAllByText(/^(Rate from eligible|Stage conversion rate|Disparate impact ratio)$/);
    expect(details).toHaveLength(3);
    expect(screen.getAllByText(/^Caveat: /).length).toBe(3);
  });

  it('shows the bias audit and forces a high-risk rule version to changes-required', async () => {
    mockLoaded();
    await renderReport();

    fireEvent.click(screen.getByRole('button', { name: 'Bias audit' }));

    const table = screen.getByRole('table');
    expect(table).toHaveAccessibleName(/bias audits for the selection rule versions/i);
    expect(within(table).getByRole('rowheader', { name: 'scoring-v4' })).toBeInTheDocument();
    expect(within(table).getByText('changes-required')).toBeInTheDocument();
    expect(within(table).getByText('0.62')).toBeInTheDocument();
    expect(within(table).getByText('Below the 80% floor')).toBeInTheDocument();
    expect(within(table).getByText(/Approval required/)).toBeInTheDocument();
    expect(within(table).getByText('equity-team')).toBeInTheDocument();
    expect(within(table).getByText('2024-25 round')).toBeInTheDocument();
  });

  it('records a rollback plan per rule version', async () => {
    mockLoaded();
    await renderReport();

    fireEvent.click(screen.getByRole('button', { name: 'Bias audit' }));

    const plan = await screen.findByLabelText(/rollback plan for scoring-v4/i);
    expect(plan).toBeInTheDocument();
    expect(screen.getByText(/Restore scoring-v3 and re-score the round\./)).toBeInTheDocument();

    fireEvent.change(plan, { target: { value: 'Restore scoring-v3 tonight.' } });
    await waitFor(() => expect(plan).toHaveValue('Restore scoring-v3 tonight.'));
  });
});
