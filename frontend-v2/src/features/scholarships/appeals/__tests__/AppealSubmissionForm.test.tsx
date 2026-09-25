import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppealSubmissionForm } from '../components/AppealSubmissionForm';
import type { Appeal } from '../types';

vi.mock('../service', () => ({
  appealService: {
    create: vi.fn(),
    submit: vi.fn(),
    withdraw: vi.fn(),
    decide: vi.fn(),
    get: vi.fn(),
    listByApplication: vi.fn(),
    getDecisions: vi.fn(),
  },
}));

import { appealService } from '../service';

const FUTURE_DEADLINE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const PAST_DEADLINE = new Date(Date.now() - 1000).toISOString();

const DEFAULT_PROPS = {
  applicationId: 'app-001',
  decisionId: 'dec-001',
  decisionType: 'reject',
  appellantId: 'student-001',
  appealDeadline: FUTURE_DEADLINE,
  originalReviewerIds: ['reviewer-001', 'reviewer-002'],
  existingAppeals: [] as Appeal[],
};

const CREATED_APPEAL: Appeal = {
  id: 'appeal-001',
  applicationId: 'app-001',
  decisionId: 'dec-001',
  appellantId: 'student-001',
  grounds: 'calculation_error',
  statement: 'The normalized scores were weighted incorrectly by the committee system.',
  evidence: [],
  deadline: FUTURE_DEADLINE,
  status: 'draft',
  excludedReviewerIds: ['reviewer-001', 'reviewer-002'],
  createdAt: new Date().toISOString(),
};

describe('AppealSubmissionForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the form with grounds selection', () => {
    render(<AppealSubmissionForm {...DEFAULT_PROPS} />);

    expect(screen.getByRole('region', { name: /appeal against decision/i })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: /appeal grounds/i })).toBeInTheDocument();
  });

  it('renders all appeal grounds options', () => {
    render(<AppealSubmissionForm {...DEFAULT_PROPS} />);

    expect(screen.getByLabelText(/procedural error/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/new evidence/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/bias/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/calculation error/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/other/i)).toBeInTheDocument();
  });

  it('shows deadline with closed message when past deadline (empty state)', () => {
    render(<AppealSubmissionForm {...DEFAULT_PROPS} appealDeadline={PAST_DEADLINE} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/appeal window has closed/i);
    expect(screen.queryByRole('button', { name: /submit appeal/i })).not.toBeInTheDocument();
  });

  it('requires grounds selection before submitting', async () => {
    render(<AppealSubmissionForm {...DEFAULT_PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: /submit appeal/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/select the grounds/i)
    );
  });

  it('validates statement length', async () => {
    render(<AppealSubmissionForm {...DEFAULT_PROPS} />);

    fireEvent.click(screen.getByLabelText(/calculation error/i));
    fireEvent.change(screen.getByPlaceholderText(/describe the grounds/i), {
      target: { value: 'Too short.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /submit appeal/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/at least 50 characters/i)
    );
  });

  it('submits appeal and shows confirmation', async () => {
    vi.mocked(appealService.create).mockResolvedValue(CREATED_APPEAL);
    vi.mocked(appealService.submit).mockResolvedValue({
      ...CREATED_APPEAL,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
    });

    render(<AppealSubmissionForm {...DEFAULT_PROPS} />);

    fireEvent.click(screen.getByLabelText(/calculation error/i));
    fireEvent.change(screen.getByPlaceholderText(/describe the grounds/i), {
      target: {
        value: 'The normalized scores were weighted incorrectly by the committee system during review.',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /submit appeal/i }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/appeal submitted/i)
    );
    expect(screen.getByText(/original reviewers/i)).toBeInTheDocument();
  });

  it('shows error on submission failure', async () => {
    vi.mocked(appealService.create).mockRejectedValue(new Error('Server error'));

    render(<AppealSubmissionForm {...DEFAULT_PROPS} />);

    fireEvent.click(screen.getByLabelText(/new evidence/i));
    fireEvent.change(screen.getByPlaceholderText(/describe the grounds/i), {
      target: {
        value: 'There is new evidence that was not considered during the original review process.',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /submit appeal/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/submission failed/i)
    );
  });

  it('shows character count for statement field', () => {
    render(<AppealSubmissionForm {...DEFAULT_PROPS} />);

    fireEvent.change(screen.getByPlaceholderText(/describe the grounds/i), {
      target: { value: 'Hello world' },
    });
    expect(screen.getByText(/11 characters/)).toBeInTheDocument();
  });

  it('shows info about excluded reviewers', () => {
    render(<AppealSubmissionForm {...DEFAULT_PROPS} />);

    expect(screen.getByText(/2.*excluded/i)).toBeInTheDocument();
  });

  it('shows finality notice', () => {
    render(<AppealSubmissionForm {...DEFAULT_PROPS} />);

    expect(screen.getByText(/dismissed appeal is final/i)).toBeInTheDocument();
  });

  it('grounds radio buttons are keyboard-accessible', () => {
    render(<AppealSubmissionForm {...DEFAULT_PROPS} />);

    const radios = screen.getAllByRole('radio');
    radios.forEach((r) => expect(r).toHaveAttribute('type', 'radio'));
  });

  it('submit button is disabled while submitting', async () => {
    vi.mocked(appealService.create).mockImplementation(() => new Promise(() => {}));

    render(<AppealSubmissionForm {...DEFAULT_PROPS} />);

    fireEvent.click(screen.getByLabelText(/other/i));
    fireEvent.change(screen.getByPlaceholderText(/describe the grounds/i), {
      target: {
        value: 'There are other grounds for this appeal that were not considered by the committee.',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /submit appeal/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /submitting/i })).toBeDisabled()
    );
  });
});
