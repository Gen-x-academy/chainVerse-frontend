import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScholarshipReminderSchedule } from '../ScholarshipReminderSchedule';
import { buildSchedule, schedulingPolicy } from '../../service';
import type { ReminderSchedule } from '../../types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const NOW = new Date('2026-05-04T10:00:00.000Z');
const SUBJECT = { kind: 'application' as const, id: 'app-42' };

function scheduled(): ReminderSchedule {
  return buildSchedule('incomplete-application', SUBJECT, {
    now: NOW,
    timezone: 'Europe/London',
    policy: { offsetsHours: [4], quietHours: undefined, respectRecipientTimezone: true },
  }).schedule;
}

describe('ScholarshipReminderSchedule', () => {
  it('renders a loading status', () => {
    render(<ScholarshipReminderSchedule state="loading" />);
    expect(screen.getByRole('status')).toHaveTextContent(/Loading reminders/i);
  });

  it('renders an error alert with a next step', () => {
    render(<ScholarshipReminderSchedule state="error" errorMessage="Reminder service down" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Reminder service down');
    expect(alert).toHaveTextContent(/Next step/i);
  });

  it('renders a permission-denied note', () => {
    render(<ScholarshipReminderSchedule state="ready" schedules={[]} canManage={false} />);
    expect(screen.getByTestId('reminders-denied')).toHaveTextContent(/Next step/i);
    expect(screen.getByLabelText('Reminder kind')).toBeDisabled();
  });

  it('renders an empty table state with a next step', () => {
    render(<ScholarshipReminderSchedule state="ready" schedules={[]} />);
    expect(screen.getByTestId('reminders-empty')).toHaveTextContent(/Next step/i);
  });

  it('exposes labelled controls for kind, timezone, quiet hours, and offsets', () => {
    render(<ScholarshipReminderSchedule state="ready" schedules={[]} />);
    expect(screen.getByLabelText('Reminder kind')).toBeInTheDocument();
    expect(screen.getByLabelText(/Recipient timezone/)).toBeInTheDocument();
    expect(screen.getByLabelText('Policy offsets in hours')).toHaveValue('72, 24, 2');
    expect(screen.getByLabelText('Quiet start (local)')).toHaveValue('22:00');
    expect(screen.getByLabelText('Quiet end (local)')).toHaveValue('07:00');
    expect(screen.getByLabelText(/Defer reminders out of quiet hours/)).toBeChecked();

    const timezoneOptions = within(screen.getByLabelText(/Recipient timezone/)).getAllByRole('option');
    expect(timezoneOptions.length).toBeGreaterThan(5);
    expect(timezoneOptions.map((option) => option.getAttribute('value'))).toContain('Asia/Tokyo');
  });

  it('previews occurrences with a per-occurrence reason', async () => {
    const user = userEvent.setup();
    render(<ScholarshipReminderSchedule state="ready" schedules={[]} />);
    expect(screen.getByTestId('reminders-preview-status')).toHaveTextContent(/No preview run yet/i);

    await user.selectOptions(screen.getByLabelText('Recipient timezone (IANA)'), 'UTC');
    await user.click(screen.getByRole('button', { name: 'Preview schedule' }));

    const list = screen.getByTestId('reminders-preview-list');
    expect(list).toHaveTextContent('2026-05-04T12:00');
    expect(list).toHaveTextContent('2026-05-05T10:00');
    expect(list).toHaveTextContent('2026-05-07T10:00');
    // A status word is always present, so the reason is never colour-only.
    expect(within(list).getAllByText('scheduled')).toHaveLength(3);
  });

  it('shows a deferred reason for an occurrence inside quiet hours', async () => {
    const user = userEvent.setup();
    render(<ScholarshipReminderSchedule state="ready" schedules={[]} />);
    await user.selectOptions(screen.getByLabelText('Recipient timezone (IANA)'), 'UTC');
    await user.clear(screen.getByLabelText('Policy offsets in hours'));
    await user.type(screen.getByLabelText('Policy offsets in hours'), '13');
    await user.click(screen.getByRole('button', { name: 'Preview schedule' }));

    const list = screen.getByTestId('reminders-preview-list');
    expect(within(list).getByText('deferred-to-quiet-hours-end')).toBeInTheDocument();
    expect(list).toHaveTextContent('2026-05-05T07:00');
  });

  it('reports an invalid offset with aria-invalid and a described error', async () => {
    const user = userEvent.setup();
    render(<ScholarshipReminderSchedule state="ready" schedules={[]} />);
    await user.clear(screen.getByLabelText('Policy offsets in hours'));
    await user.type(screen.getByLabelText('Policy offsets in hours'), 'soon');
    await user.click(screen.getByRole('button', { name: 'Preview schedule' }));

    const field = screen.getByLabelText('Policy offsets in hours');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(/positive offset in hours/i);
    expect(field).toHaveAccessibleDescription(/positive offset in hours/i);
  });

  it('reports an invalid quiet-hours time', async () => {
    const user = userEvent.setup();
    render(<ScholarshipReminderSchedule state="ready" schedules={[]} />);
    await user.clear(screen.getByLabelText('Quiet start (local)'));
    await user.type(screen.getByLabelText('Quiet start (local)'), 'night');
    await user.click(screen.getByRole('button', { name: 'Preview schedule' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/24-hour HH:MM/i);
    expect(screen.getByLabelText('Quiet start (local)')).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders a real table and cancels a schedule with a recorded reason', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ScholarshipReminderSchedule state="ready" schedules={[scheduled()]} onCancel={onCancel} />
    );

    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Kind',
      'Subject',
      'Sends at (local)',
      'Status',
      'Dedupe key',
      'Actions',
    ]);
    expect(table).toHaveTextContent('application:app-42');
    expect(table).toHaveTextContent('2026-05-04T15:00');
    expect(table).toHaveTextContent(
      'reminder:incomplete-application:application:app-42:2026-05-04T15:00'
    );

    await user.click(screen.getByRole('button', { name: 'Cancel reminder' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(table).toHaveTextContent('cancelled');
    expect(table).toHaveTextContent(/Cancelled by an administrator/);
    expect(screen.getByRole('button', { name: 'Cancel reminder' })).toBeDisabled();
  });

  it('shows default offsets for the selected kind', async () => {
    const user = userEvent.setup();
    render(<ScholarshipReminderSchedule state="ready" schedules={[]} />);
    await user.selectOptions(screen.getByLabelText('Reminder kind'), 'payout-setup');
    expect(screen.getByText(/Default offsets:/)).toHaveTextContent(
      schedulingPolicy('payout-setup').offsetsHours.map((h) => `${h}h`).join(', ')
    );
  });
});
