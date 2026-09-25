import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DisbursementScheduleBuilder } from '../components/DisbursementScheduleBuilder';
import type { DisbursementSchedule } from '../types';

vi.mock('../../hooks/useScholarships', () => ({
  useCreateDisbursementSchedule: vi.fn(),
}));

import { useCreateDisbursementSchedule } from '../../hooks/useScholarships';

const createMutateAsync = vi.fn();

function mockIdle() {
  vi.mocked(useCreateDisbursementSchedule).mockReturnValue({
    mutateAsync: createMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useCreateDisbursementSchedule>);
}

const BASE_PROPS = {
  awardId: 'award-001',
  awardAmountCents: 100000,
  currency: 'USD',
};

describe('DisbursementScheduleBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIdle();
  });

  it('renders the form with one default milestone', () => {
    render(<DisbursementScheduleBuilder {...BASE_PROPS} />);

    expect(screen.getByRole('heading', { name: /define disbursement milestones/i })).toBeInTheDocument();
    expect(screen.getByText(/milestone 1/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add milestone/i })).toBeInTheDocument();
  });

  it('starts with 0% total which shows amber indicator', () => {
    render(<DisbursementScheduleBuilder {...BASE_PROPS} />);

    expect(screen.getByText(/total: 0\.0% \/ 100%/i)).toBeInTheDocument();
  });

  it('adding a milestone increases the milestone count', () => {
    render(<DisbursementScheduleBuilder {...BASE_PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: /add milestone/i }));

    expect(screen.getByText(/milestone 2/i)).toBeInTheDocument();
  });

  it('removing a milestone decreases the count', () => {
    render(<DisbursementScheduleBuilder {...BASE_PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: /add milestone/i }));
    expect(screen.getByText(/milestone 2/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /remove milestone 2/i }));
    expect(screen.queryByText(/milestone 2/i)).not.toBeInTheDocument();
  });

  it('cannot remove the last remaining milestone', () => {
    render(<DisbursementScheduleBuilder {...BASE_PROPS} />);

    expect(screen.queryByRole('button', { name: /remove milestone 1/i })).not.toBeInTheDocument();
  });

  it('percentage total updates as user enters values', () => {
    render(<DisbursementScheduleBuilder {...BASE_PROPS} />);

    const pctInput = screen.getByLabelText(/share \(%\)/i);
    fireEvent.change(pctInput, { target: { value: '60' } });

    expect(screen.getByText(/total: 60\.0% \/ 100%/i)).toBeInTheDocument();
  });

  it('shows estimated amount next to percentage', () => {
    render(<DisbursementScheduleBuilder {...BASE_PROPS} />);

    const pctInput = screen.getByLabelText(/share \(%\)/i);
    fireEvent.change(pctInput, { target: { value: '50' } });

    expect(screen.getByText(/\$500/i)).toBeInTheDocument();
  });

  it('submit succeeds when percentages total 100%', async () => {
    const future1 = '2027-01-01';
    const future2 = '2027-06-01';

    const createdSchedule: DisbursementSchedule = {
      id: 'sched-001',
      awardId: 'award-001',
      status: 'draft',
      milestones: [
        {
          id: 'ms-1',
          scheduleId: 'sched-001',
          milestoneType: 'enrollment',
          label: 'Enrollment',
          percentageShare: 50,
          amountCents: 50000,
          dueDate: future1,
          status: 'pending',
        },
        {
          id: 'ms-2',
          scheduleId: 'sched-001',
          milestoneType: 'completion',
          label: 'Completion',
          percentageShare: 50,
          amountCents: 50000,
          dueDate: future2,
          status: 'pending',
        },
      ],
      createdAt: new Date().toISOString(),
    };
    createMutateAsync.mockResolvedValue(createdSchedule);

    render(<DisbursementScheduleBuilder {...BASE_PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: /add milestone/i }));

    const pctInputs = screen.getAllByLabelText(/share \(%\)/i);
    fireEvent.change(pctInputs[0], { target: { value: '50' } });
    fireEvent.change(pctInputs[1], { target: { value: '50' } });

    const labelInputs = screen.getAllByLabelText(/label/i);
    fireEvent.change(labelInputs[0], { target: { value: 'Enrollment' } });
    fireEvent.change(labelInputs[1], { target: { value: 'Completion' } });

    const dateInputs = screen.getAllByLabelText(/due date/i);
    fireEvent.change(dateInputs[0], { target: { value: future1 } });
    fireEvent.change(dateInputs[1], { target: { value: future2 } });

    fireEvent.click(screen.getByRole('button', { name: /save disbursement schedule/i }));

    expect(await screen.findByText(/disbursement schedule created/i)).toBeInTheDocument();
    expect(screen.getByText(/2 milestones defined/i)).toBeInTheDocument();
  });

  it('shows validation errors when percentages do not total 100', async () => {
    render(<DisbursementScheduleBuilder {...BASE_PROPS} />);

    const pctInput = screen.getByLabelText(/share \(%\)/i);
    fireEvent.change(pctInput, { target: { value: '70' } });

    fireEvent.click(screen.getByRole('button', { name: /save disbursement schedule/i }));

    const alerts = await screen.findAllByRole('alert');
    const validationList = alerts.find((el) => el.getAttribute('aria-label') === 'Validation errors');
    expect(validationList).toBeTruthy();
    expect(validationList).toHaveTextContent(/percentages must total 100%/i);
  });

  it('shows validation error when dates are not in ascending order', async () => {
    render(<DisbursementScheduleBuilder {...BASE_PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: /add milestone/i }));

    const pctInputs = screen.getAllByLabelText(/share \(%\)/i);
    fireEvent.change(pctInputs[0], { target: { value: '50' } });
    fireEvent.change(pctInputs[1], { target: { value: '50' } });

    const labelInputs = screen.getAllByLabelText(/label/i);
    fireEvent.change(labelInputs[0], { target: { value: 'First' } });
    fireEvent.change(labelInputs[1], { target: { value: 'Second' } });

    const dateInputs = screen.getAllByLabelText(/due date/i);
    fireEvent.change(dateInputs[0], { target: { value: '2027-06-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2027-01-01' } });

    fireEvent.click(screen.getByRole('button', { name: /save disbursement schedule/i }));

    const alerts = await screen.findAllByRole('alert');
    const validationList = alerts.find((el) => el.getAttribute('aria-label') === 'Validation errors');
    expect(validationList).toBeTruthy();
    expect(validationList).toHaveTextContent(/strictly ascending order/i);
  });

  it('shows read-only view for an active schedule', () => {
    const activeSchedule: DisbursementSchedule = {
      id: 'sched-001',
      awardId: 'award-001',
      status: 'active',
      milestones: [
        {
          id: 'ms-1',
          scheduleId: 'sched-001',
          milestoneType: 'enrollment',
          label: 'Enrollment',
          percentageShare: 100,
          amountCents: 100000,
          dueDate: '2027-01-01',
          status: 'pending',
        },
      ],
      activatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    render(<DisbursementScheduleBuilder {...BASE_PROPS} existingSchedule={activeSchedule} />);

    expect(screen.queryByRole('button', { name: /add milestone/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save disbursement schedule/i })).not.toBeInTheDocument();
    expect(screen.getByText(/immutable after activation/i)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /disbursement milestones/i })).toBeInTheDocument();
  });

  it('shows error alert on API failure', async () => {
    createMutateAsync.mockRejectedValue(new Error('Schedule already exists'));

    render(<DisbursementScheduleBuilder {...BASE_PROPS} />);

    const pctInput = screen.getByLabelText(/share \(%\)/i);
    fireEvent.change(pctInput, { target: { value: '100' } });

    const labelInput = screen.getByLabelText(/label/i);
    fireEvent.change(labelInput, { target: { value: 'Completion' } });

    const dateInput = screen.getByLabelText(/due date/i);
    fireEvent.change(dateInput, { target: { value: '2027-01-01' } });

    fireEvent.click(screen.getByRole('button', { name: /save disbursement schedule/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Schedule already exists');
  });

  it('has accessible region landmark', () => {
    render(<DisbursementScheduleBuilder {...BASE_PROPS} />);

    expect(screen.getByRole('region', { name: /define disbursement schedule/i })).toBeInTheDocument();
  });

  it('milestone type options include all expected types', () => {
    render(<DisbursementScheduleBuilder {...BASE_PROPS} />);

    const typeSelect = screen.getByLabelText(/^type$/i);
    expect(typeSelect).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /enrollment/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /attendance/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /coursework/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /completion/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /custom/i })).toBeInTheDocument();
  });
});
