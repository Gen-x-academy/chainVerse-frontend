import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RecurringAvailabilityPanel } from '../components/RecurringAvailabilityPanel';
import type {
  RecurringAvailability,
  WeeklyAvailabilityWindow,
} from '../recurring-availability';

function schedule(overrides: Partial<RecurringAvailability> = {}): RecurringAvailability {
  return {
    id: 'availability-1',
    mentorId: 'mentor-1',
    timeZone: 'UTC',
    windows: [
      { dayOfWeek: 1, start: '10:00', end: '12:00' },
      { dayOfWeek: 1, start: '09:00', end: '11:00' },
    ],
    exceptions: [],
    effectiveFrom: '2026-01-01',
    effectiveUntil: '2026-12-31',
    leadTimeMinutes: 60,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    bookingHorizonDays: 30,
    version: 1,
    ...overrides,
  };
}

describe('RecurringAvailabilityPanel', () => {
  it('renders the weekly windows and booking policy', () => {
    render(<RecurringAvailabilityPanel schedule={schedule()} />);

    expect(screen.getByRole('heading', { name: /recurring weekly availability/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/time zone/i)).toHaveValue('UTC');
    expect(screen.getByLabelText(/lead time/i)).toHaveValue(60);
    expect(screen.getAllByLabelText(/^day$/i)).toHaveLength(2);
    expect(screen.getAllByLabelText(/^start$/i)).toHaveLength(2);
    expect(screen.getAllByLabelText(/^end$/i)).toHaveLength(2);
  });

  it('normalizes overlapping windows before saving', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<RecurringAvailabilityPanel schedule={schedule()} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: /save availability/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        windows: [{ dayOfWeek: 1, start: '09:00', end: '12:00' }],
      }),
    );
    expect(await screen.findByText(/availability saved/i)).toBeInTheDocument();
  });

  it('shows a clear validation error and does not save an invalid window', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <RecurringAvailabilityPanel
        schedule={schedule({ windows: [{ dayOfWeek: 1, start: '12:00', end: '09:00' }] })}
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole('button', { name: /save availability/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/end after it starts/i);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('reports an error returned while saving', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Existing bookings conflict.'));
    const user = userEvent.setup();
    render(<RecurringAvailabilityPanel schedule={schedule()} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: /save availability/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/existing bookings conflict/i);
  });

  it('denies editing when the role cannot manage availability', () => {
    render(<RecurringAvailabilityPanel schedule={schedule()} canManage={false} />);

    expect(screen.getByLabelText(/time zone/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /save availability/i })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/role cannot change/i);
  });

  it('can be submitted from the keyboard', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<RecurringAvailabilityPanel schedule={schedule()} onSave={onSave} />);

    screen.getByRole('button', { name: /save availability/i }).focus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });
});
