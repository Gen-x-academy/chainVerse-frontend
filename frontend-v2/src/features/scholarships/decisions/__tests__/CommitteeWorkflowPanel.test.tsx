import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommitteeWorkflowPanel } from '../components/CommitteeWorkflowPanel';
import type { CommitteeDecision } from '../types';

vi.mock('../service', () => ({
  committeeDecisionService: {
    castVote: vi.fn(),
    recuse: vi.fn(),
    finalise: vi.fn(),
    void: vi.fn(),
  },
}));

import { committeeDecisionService } from '../service';

const BASE_DECISION: CommitteeDecision = {
  id: 'decision-001',
  applicationId: 'app-001',
  aggregateVersion: 'v1-2024-01',
  committee: [
    { userId: 'chair-001', role: 'chair', name: 'Dr. Chair' },
    { userId: 'member-001', role: 'member', name: 'Member One' },
    { userId: 'observer-001', role: 'observer', name: 'Observer' },
  ],
  votes: [],
  recusals: [],
  quorumPolicy: { minVotes: 2, requireChairVote: false },
  status: 'in_progress',
  createdAt: '2024-01-01T00:00:00Z',
};

describe('CommitteeWorkflowPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders committee members list', () => {
    render(<CommitteeWorkflowPanel decision={BASE_DECISION} currentUserId="chair-001" />);

    expect(screen.getByText('Dr. Chair')).toBeInTheDocument();
    expect(screen.getByText('Member One')).toBeInTheDocument();
    expect(screen.getByText('Observer')).toBeInTheDocument();
  });

  it('shows decision heading with evidence version', () => {
    render(<CommitteeWorkflowPanel decision={BASE_DECISION} currentUserId="chair-001" />);

    expect(screen.getByText('v1-2024-01')).toBeInTheDocument();
  });

  it('shows quorum status as not reached initially', () => {
    render(<CommitteeWorkflowPanel decision={BASE_DECISION} currentUserId="chair-001" />);

    expect(screen.getByText(/quorum not yet reached/i)).toBeInTheDocument();
  });

  it('renders vote form for eligible member', () => {
    render(<CommitteeWorkflowPanel decision={BASE_DECISION} currentUserId="member-001" />);

    expect(screen.getByRole('region', { name: /decision committee/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit vote/i })).toBeInTheDocument();
  });

  it('shows permission message for observer (permission state)', () => {
    render(<CommitteeWorkflowPanel decision={BASE_DECISION} currentUserId="observer-001" />);

    expect(screen.queryByRole('button', { name: /submit vote/i })).not.toBeInTheDocument();
    expect(screen.getByText(/observers may not cast votes/i)).toBeInTheDocument();
  });

  it('vote buttons are keyboard-accessible radio inputs', () => {
    render(<CommitteeWorkflowPanel decision={BASE_DECISION} currentUserId="member-001" />);

    const radios = screen.getAllByRole('radio');
    radios.forEach((r) => expect(r).toHaveAttribute('type', 'radio'));
  });

  it('requires rationale before submitting vote', async () => {
    render(<CommitteeWorkflowPanel decision={BASE_DECISION} currentUserId="member-001" />);

    fireEvent.click(screen.getByLabelText(/award/i, { selector: 'input[type="radio"]' }));
    fireEvent.click(screen.getByRole('button', { name: /submit vote/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/rationale is required/i)
    );
  });

  it('submits vote successfully', async () => {
    const updated: CommitteeDecision = {
      ...BASE_DECISION,
      votes: [
        {
          memberId: 'member-001',
          decision: 'award',
          rationale: 'Excellent candidate with strong track record.',
          evidenceVersion: 'v1-2024-01',
          votedAt: '2024-01-10T10:00:00Z',
        },
      ],
    };
    vi.mocked(committeeDecisionService.castVote).mockResolvedValue(updated);

    render(<CommitteeWorkflowPanel decision={BASE_DECISION} currentUserId="member-001" />);

    fireEvent.click(screen.getByLabelText(/award/i, { selector: 'input[type="radio"]' }));
    fireEvent.change(screen.getByPlaceholderText(/explain your decision/i), {
      target: { value: 'Excellent candidate with strong track record.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /submit vote/i }));

    await waitFor(() => {
      const statuses = screen.getAllByRole('status');
      expect(statuses.some((s) => s.textContent?.match(/vote recorded/i))).toBe(true);
    });
  });

  it('shows error on vote failure', async () => {
    vi.mocked(committeeDecisionService.castVote).mockRejectedValue(new Error('Server error'));

    render(<CommitteeWorkflowPanel decision={BASE_DECISION} currentUserId="member-001" />);

    fireEvent.click(screen.getByLabelText(/shortlist/i, { selector: 'input[type="radio"]' }));
    fireEvent.change(screen.getByPlaceholderText(/explain your decision/i), {
      target: { value: 'Good candidate.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /submit vote/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/could not submit vote/i)
    );
  });

  it('shows finalise button when quorum is reached', () => {
    const quorumDecision: CommitteeDecision = {
      ...BASE_DECISION,
      votes: [
        { memberId: 'chair-001', decision: 'award', rationale: 'r', evidenceVersion: 'v1-2024-01', votedAt: '' },
        { memberId: 'member-001', decision: 'award', rationale: 'r', evidenceVersion: 'v1-2024-01', votedAt: '' },
      ],
    };
    render(<CommitteeWorkflowPanel decision={quorumDecision} currentUserId="observer-001" />);

    expect(screen.getByRole('button', { name: /finalise decision/i })).toBeInTheDocument();
    expect(screen.getByText(/quorum reached/i)).toBeInTheDocument();
  });

  it('shows final decision banner on decided status', () => {
    const decided: CommitteeDecision = {
      ...BASE_DECISION,
      status: 'decided',
      finalDecision: 'award',
      decidedAt: '2024-01-15T12:00:00Z',
    };
    render(<CommitteeWorkflowPanel decision={decided} currentUserId="observer-001" />);

    const statuses = screen.getAllByRole('status');
    expect(statuses.some((s) => s.textContent?.match(/final decision: award/i))).toBe(true);
  });

  it('shows voided status banner', () => {
    const voided: CommitteeDecision = { ...BASE_DECISION, status: 'voided' };
    render(<CommitteeWorkflowPanel decision={voided} currentUserId="member-001" />);

    expect(screen.getByRole('alert')).toHaveTextContent(/voided/i);
  });

  it('recusal form is shown for eligible member', () => {
    render(<CommitteeWorkflowPanel decision={BASE_DECISION} currentUserId="member-001" />);

    expect(screen.getByRole('button', { name: /record recusal/i })).toBeInTheDocument();
  });

  it('shows screen-reader-accessible labels on vote radio group', () => {
    render(<CommitteeWorkflowPanel decision={BASE_DECISION} currentUserId="member-001" />);

    const group = screen.getByRole('radiogroup', { name: /decision type/i });
    expect(group).toBeInTheDocument();
  });

  it('shows projected outcome when a vote option is selected', () => {
    render(<CommitteeWorkflowPanel decision={BASE_DECISION} currentUserId="member-001" />);

    fireEvent.click(screen.getByLabelText(/reject/i, { selector: 'input[type="radio"]' }));
    expect(screen.getByText(/projected outcome/i)).toBeInTheDocument();
  });
});
