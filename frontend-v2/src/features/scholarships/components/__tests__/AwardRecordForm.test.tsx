import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AwardRecordForm } from '../AwardRecordForm';

vi.mock('../../hooks/useScholarships', () => ({
  useCreateAward: vi.fn(),
}));

import { useCreateAward } from '../../hooks/useScholarships';

const mockMutateAsync = vi.fn();

function mockIdle() {
  vi.mocked(useCreateAward).mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useCreateAward>);
}

function mockLoading() {
  vi.mocked(useCreateAward).mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending: true,
  } as unknown as ReturnType<typeof useCreateAward>);
}

describe('AwardRecordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIdle();
  });

  it('renders all required form fields', () => {
    render(<AwardRecordForm />);

    expect(screen.getByRole('heading', { name: 'Create award record' })).toBeInTheDocument();
    expect(screen.getByLabelText(/application id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/student id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/award amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/currency/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/award terms/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/acceptance deadline/i)).toBeInTheDocument();
  });

  it('submit button is disabled when form is empty', () => {
    render(<AwardRecordForm />);

    const submitButton = screen.getByRole('button', { name: /create award record/i });
    expect(submitButton).toBeDisabled();
  });

  it('submit button is disabled when amount is zero', () => {
    render(<AwardRecordForm />);

    fireEvent.change(screen.getByLabelText(/application id/i), {
      target: { value: 'app-001' },
    });
    fireEvent.change(screen.getByLabelText(/student id/i), {
      target: { value: 'student-001' },
    });
    fireEvent.change(screen.getByLabelText(/award amount/i), {
      target: { value: '0' },
    });

    const submitButton = screen.getByRole('button', { name: /create award record/i });
    expect(submitButton).toBeDisabled();
  });

  it('submit button is disabled when deadline is in the past', () => {
    render(<AwardRecordForm />);

    fireEvent.change(screen.getByLabelText(/application id/i), {
      target: { value: 'app-001' },
    });
    fireEvent.change(screen.getByLabelText(/student id/i), {
      target: { value: 'student-001' },
    });
    fireEvent.change(screen.getByLabelText(/award amount/i), {
      target: { value: '500' },
    });
    fireEvent.change(screen.getByLabelText(/award terms/i), {
      target: { value: 'Standard scholarship terms.' },
    });
    fireEvent.change(screen.getByLabelText(/acceptance deadline/i), {
      target: { value: '2020-01-01T00:00' },
    });

    const submitButton = screen.getByRole('button', { name: /create award record/i });
    expect(submitButton).toBeDisabled();
  });

  it('shows error message on API failure', async () => {
    mockMutateAsync.mockRejectedValue(new Error('Conflict detected'));
    render(<AwardRecordForm />);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const futureDateStr = futureDate.toISOString().slice(0, 16);

    fireEvent.change(screen.getByLabelText(/application id/i), {
      target: { value: 'app-001' },
    });
    fireEvent.change(screen.getByLabelText(/student id/i), {
      target: { value: 'student-001' },
    });
    fireEvent.change(screen.getByLabelText(/award amount/i), {
      target: { value: '500' },
    });
    fireEvent.change(screen.getByLabelText(/award terms/i), {
      target: { value: 'Standard scholarship terms.' },
    });
    fireEvent.change(screen.getByLabelText(/acceptance deadline/i), {
      target: { value: futureDateStr },
    });

    fireEvent.click(screen.getByRole('button', { name: /create award record/i }));

    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent('Conflict detected');
  });

  it('shows success state after creation', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    mockMutateAsync.mockResolvedValue({
      id: 'award-001',
      status: 'pending',
      amountCents: 50000,
      currency: 'USD',
      acceptanceDeadline: futureDate.toISOString(),
      terms: 'Standard scholarship terms.',
      applicationId: 'app-001',
      studentId: 'student-001',
      milestoneIds: [],
      grantedAt: new Date().toISOString(),
    });

    render(<AwardRecordForm />);

    const futureDateStr = futureDate.toISOString().slice(0, 16);

    fireEvent.change(screen.getByLabelText(/application id/i), {
      target: { value: 'app-001' },
    });
    fireEvent.change(screen.getByLabelText(/student id/i), {
      target: { value: 'student-001' },
    });
    fireEvent.change(screen.getByLabelText(/award amount/i), {
      target: { value: '500' },
    });
    fireEvent.change(screen.getByLabelText(/award terms/i), {
      target: { value: 'Standard scholarship terms.' },
    });
    fireEvent.change(screen.getByLabelText(/acceptance deadline/i), {
      target: { value: futureDateStr },
    });

    fireEvent.click(screen.getByRole('button', { name: /create award record/i }));

    expect(await screen.findByText(/award record created successfully/i)).toBeInTheDocument();
    expect(screen.getByText('award-001')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create another award/i })).toBeInTheDocument();
  });

  it('has accessible landmark and heading structure', () => {
    render(<AwardRecordForm />);

    expect(screen.getByRole('region', { name: /create award record/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /create award record/i })).toBeInTheDocument();
  });

  it('has a fieldset with accessible legend', () => {
    render(<AwardRecordForm />);

    expect(screen.getByRole('group', { name: /award details/i })).toBeInTheDocument();
  });

  it('reset button clears the form and shows it again', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    mockMutateAsync.mockResolvedValue({
      id: 'award-001',
      status: 'pending',
      amountCents: 50000,
      currency: 'USD',
      acceptanceDeadline: futureDate.toISOString(),
      terms: 'Terms.',
      applicationId: 'app-001',
      studentId: 'student-001',
      milestoneIds: [],
      grantedAt: new Date().toISOString(),
    });

    render(<AwardRecordForm />);
    const futureDateStr = futureDate.toISOString().slice(0, 16);

    fireEvent.change(screen.getByLabelText(/application id/i), { target: { value: 'app-001' } });
    fireEvent.change(screen.getByLabelText(/student id/i), { target: { value: 'student-001' } });
    fireEvent.change(screen.getByLabelText(/award amount/i), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText(/award terms/i), { target: { value: 'Terms.' } });
    fireEvent.change(screen.getByLabelText(/acceptance deadline/i), { target: { value: futureDateStr } });

    fireEvent.click(screen.getByRole('button', { name: /create award record/i }));
    await screen.findByText(/award record created successfully/i);

    fireEvent.click(screen.getByRole('button', { name: /create another award/i }));
    expect(screen.getByRole('heading', { name: /create award record/i })).toBeInTheDocument();
  });
});
