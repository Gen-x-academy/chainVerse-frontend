import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AggregateScorePanel } from '../AggregateScorePanel';
import type { NormalizedAggregateScore } from '../../aggregate-scores';

vi.mock('../../aggregate-scores', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../aggregate-scores')>();
  return {
    ...actual,
    aggregateScoreService: {
      compute: vi.fn(),
      listByRound: vi.fn(),
    },
  };
});

import { aggregateScoreService } from '../../aggregate-scores';

const COMPLETE_AGGREGATE: NormalizedAggregateScore = {
  applicationId: 'app-001',
  reviewScores: [
    {
      reviewId: 'rev-001',
      reviewerId: 'reviewer-001',
      criterionScores: [
        {
          criterionId: 'c-academic',
          criterionName: 'Academic merit',
          weightPercent: 50,
          rawScore: 3,
          maxRawScore: 3,
          weightedContribution: 50,
        },
        {
          criterionId: 'c-impact',
          criterionName: 'Community impact',
          weightPercent: 50,
          rawScore: 2,
          maxRawScore: 3,
          weightedContribution: 33.33,
        },
      ],
      normalizedTotal: 83.33,
      rubricVersion: 1,
      submittedAt: '2024-01-10T10:00:00Z',
    },
    {
      reviewId: 'rev-002',
      reviewerId: 'reviewer-002',
      criterionScores: [
        {
          criterionId: 'c-academic',
          criterionName: 'Academic merit',
          weightPercent: 50,
          rawScore: 2,
          maxRawScore: 3,
          weightedContribution: 33.33,
        },
        {
          criterionId: 'c-impact',
          criterionName: 'Community impact',
          weightPercent: 50,
          rawScore: 3,
          maxRawScore: 3,
          weightedContribution: 50,
        },
      ],
      normalizedTotal: 83.33,
      rubricVersion: 1,
      submittedAt: '2024-01-11T10:00:00Z',
    },
  ],
  aggregateScore: 83.33,
  totalReviews: 2,
  isComplete: true,
  hasRubricVersionMismatch: false,
  tiePolicy: 'application_id_asc',
  computedAt: '2024-01-12T00:00:00Z',
};

describe('AggregateScorePanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders with initialData without fetching', () => {
    render(<AggregateScorePanel applicationId="app-001" initialData={COMPLETE_AGGREGATE} />);

    expect(screen.getByRole('region', { name: /normalized review aggregate/i })).toBeInTheDocument();
    expect(screen.getAllByText('83.33').length).toBeGreaterThan(0);
    expect(aggregateScoreService.compute).not.toHaveBeenCalled();
  });

  it('shows loading skeleton while fetching', () => {
    vi.mocked(aggregateScoreService.compute).mockImplementation(
      () => new Promise(() => {})
    );
    render(<AggregateScorePanel applicationId="app-001" />);

    expect(screen.getByRole('region', { name: /aggregate score loading/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /aggregate score loading/i })).toHaveAttribute(
      'aria-busy',
      'true'
    );
  });

  it('renders aggregate score on success', async () => {
    vi.mocked(aggregateScoreService.compute).mockResolvedValue(COMPLETE_AGGREGATE);
    render(<AggregateScorePanel applicationId="app-001" />);

    await waitFor(() =>
      expect(screen.getAllByText('83.33').length).toBeGreaterThan(0)
    );
    expect(screen.getByText('Normalized review aggregate')).toBeInTheDocument();
  });

  it('shows error state with retry button on fetch failure', async () => {
    vi.mocked(aggregateScoreService.compute).mockRejectedValue(new Error('Network error'));
    render(<AggregateScorePanel applicationId="app-001" />);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument()
    );
    expect(screen.getByText(/could not load aggregate score/i)).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('retries fetch when retry button is clicked', async () => {
    vi.mocked(aggregateScoreService.compute)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(COMPLETE_AGGREGATE);

    render(<AggregateScorePanel applicationId="app-001" />);

    await waitFor(() => screen.getByRole('button', { name: /retry/i }));
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(screen.getAllByText('83.33').length).toBeGreaterThan(0));
  });

  it('shows incomplete notice when fewer than minimum reviews', () => {
    const incomplete: NormalizedAggregateScore = {
      ...COMPLETE_AGGREGATE,
      reviewScores: [COMPLETE_AGGREGATE.reviewScores[0]],
      totalReviews: 1,
      isComplete: false,
    };
    render(<AggregateScorePanel applicationId="app-001" initialData={incomplete} />);

    expect(screen.getByRole('status')).toHaveTextContent(/incomplete/i);
    expect(screen.getByRole('status')).toHaveTextContent(/1 more review/i);
  });

  it('shows rubric version mismatch alert', () => {
    const mismatched: NormalizedAggregateScore = {
      ...COMPLETE_AGGREGATE,
      hasRubricVersionMismatch: true,
    };
    render(<AggregateScorePanel applicationId="app-001" initialData={mismatched} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/rubric version mismatch/i);
  });

  it('renders per-review breakdown table with keyboard-accessible headers', () => {
    render(<AggregateScorePanel applicationId="app-001" initialData={COMPLETE_AGGREGATE} />);

    const tables = screen.getAllByRole('table');
    expect(tables.length).toBe(2);
    tables.forEach((t) => {
      expect(t).toHaveAttribute('aria-label');
    });
  });

  it('displays criterion scores with weights and contributions', () => {
    render(<AggregateScorePanel applicationId="app-001" initialData={COMPLETE_AGGREGATE} />);

    expect(screen.getAllByText('Academic merit').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Community impact').length).toBeGreaterThan(0);
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0);
  });

  it('has accessible section landmark', () => {
    render(<AggregateScorePanel applicationId="app-001" initialData={COMPLETE_AGGREGATE} />);

    const section = screen.getByRole('region', { name: /normalized review aggregate/i });
    expect(section).toBeInTheDocument();
  });

  it('shows score colour based on value (green for high scores)', () => {
    render(<AggregateScorePanel applicationId="app-001" initialData={COMPLETE_AGGREGATE} />);
    const scoreEls = screen.getAllByText('83.33');
    const bigScore = scoreEls.find((el) => el.className.includes('text-5xl'));
    expect(bigScore).toBeDefined();
    expect(bigScore!.className).toContain('emerald');
  });

  it('shows amber colour for mid-range scores', () => {
    const midScore: NormalizedAggregateScore = { ...COMPLETE_AGGREGATE, aggregateScore: 65.0 };
    render(<AggregateScorePanel applicationId="app-001" initialData={midScore} />);
    const scoreEls = screen.getAllByText('65.00');
    const bigScore = scoreEls.find((el) => el.className.includes('text-5xl'));
    expect(bigScore).toBeDefined();
    expect(bigScore!.className).toContain('amber');
  });

  it('shows red colour for low scores', () => {
    const lowScore: NormalizedAggregateScore = { ...COMPLETE_AGGREGATE, aggregateScore: 30.0 };
    render(<AggregateScorePanel applicationId="app-001" initialData={lowScore} />);
    const scoreEls = screen.getAllByText('30.00');
    const bigScore = scoreEls.find((el) => el.className.includes('text-5xl'));
    expect(bigScore).toBeDefined();
    expect(bigScore!.className).toContain('red');
  });

  it('shows computedAt timestamp', () => {
    render(<AggregateScorePanel applicationId="app-001" initialData={COMPLETE_AGGREGATE} />);
    expect(screen.getByText(/computed at/i)).toBeInTheDocument();
  });
});
