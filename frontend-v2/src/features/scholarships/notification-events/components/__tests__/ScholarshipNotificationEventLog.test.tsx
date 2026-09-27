import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScholarshipNotificationEventLog } from '../ScholarshipNotificationEventLog';
import { emitNotificationEvent } from '../../service';
import type { EmittedEventRecord } from '../../types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const NOW = new Date('2026-05-04T10:00:00.000Z');

function record(overrides: Partial<Parameters<typeof emitNotificationEvent>[0]> = {}): EmittedEventRecord {
  const result = emitNotificationEvent(
    {
      name: 'review.assigned',
      occurredAt: '2026-05-04T10:00:00.000Z',
      correlationId: 'corr-1',
      subject: { kind: 'application', id: 'app-42' },
      programId: 'chainverse-scholarship',
      channel: 'email',
      recipientRef: 'user:applicant-001',
      payload: {
        applicationId: 'app-42',
        roundId: 'round-2026',
        assignedAt: '2026-05-04T10:00:00.000Z',
        applicantName: 'Ada Lovelace',
        applicantEmail: 'ada@example.edu',
        essayText: 'essay text that must not be emitted',
      },
      ...overrides,
    },
    undefined,
    [],
    NOW
  );
  return { event: result.event, result, recordedAt: NOW.toISOString() };
}

describe('ScholarshipNotificationEventLog', () => {
  it('renders a loading status', () => {
    render(<ScholarshipNotificationEventLog state="loading" />);
    expect(screen.getByRole('status')).toHaveTextContent(/Loading notification events/i);
  });

  it('renders an error alert with a next step', () => {
    render(<ScholarshipNotificationEventLog state="error" errorMessage="Upstream 500" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Upstream 500');
    expect(alert).toHaveTextContent(/Next step/i);
  });

  it('renders a permission-denied note', () => {
    render(<ScholarshipNotificationEventLog state="ready" canView={false} />);
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(/do not have permission/i);
    expect(note).toHaveTextContent(/Next step/i);
  });

  it('renders an empty state with a next step', () => {
    render(<ScholarshipNotificationEventLog state="ready" events={[]} />);
    expect(screen.getByTestId('event-log-empty')).toHaveTextContent(/Next step/i);
  });

  it('renders a real table with the allowlisted payload only', () => {
    render(<ScholarshipNotificationEventLog state="ready" events={[record()]} />);
    const table = screen.getByRole('table');
    const headers = within(table).getAllByRole('columnheader').map((cell) => cell.textContent);
    expect(headers).toEqual([
      'Event',
      'Channel',
      'Subject reference',
      'Mandatory',
      'Outcome',
      'Idempotency key',
      'Payload',
    ]);

    const row = within(table).getByRole('row', { name: /review.assigned/ });
    expect(row).toHaveTextContent('application:app-42');
    expect(row).toHaveTextContent('review.assigned:application:app-42:2026-05-04T10:00:00.000Z');
    expect(row).toHaveTextContent('Optional');
    expect(row).toHaveTextContent('emitted');
    expect(table.textContent).not.toContain('Ada Lovelace');
    expect(table.textContent).not.toContain('ada@example.edu');
    expect(table.textContent).not.toContain('essay');
  });

  it('marks a mandatory event in text, not colour alone', () => {
    render(
      <ScholarshipNotificationEventLog
        state="ready"
        events={[
          record({
            name: 'decision.recorded',
            payload: { outcome: 'awarded', decidedAt: '2026-05-04T09:00:00.000Z' },
          }),
        ]}
      />
    );
    expect(screen.getByRole('table')).toHaveTextContent('Mandatory (required notice)');
  });

  it('filters by event name and channel', async () => {
    const user = userEvent.setup();
    render(
      <ScholarshipNotificationEventLog
        state="ready"
        events={[record(), record({ name: 'review.assigned', channel: 'push' })]}
      />
    );
    expect(screen.getAllByRole('row')).toHaveLength(3);

    await user.selectOptions(screen.getByLabelText('Channel'), 'push');
    expect(screen.getAllByRole('row')).toHaveLength(2);

    await user.selectOptions(screen.getByLabelText('Event name'), 'decision.recorded');
    expect(screen.getByTestId('event-log-empty')).toBeInTheDocument();
  });

  it('demonstrates preference suppression and duplicate suppression', async () => {
    const user = userEvent.setup();
    render(<ScholarshipNotificationEventLog state="ready" events={[]} />);
    const status = screen.getByTestId('event-log-status');

    await user.click(screen.getByRole('button', { name: /Emit review.assigned on email/ }));
    expect(status).toHaveTextContent(/Rejected review.assigned on email: PREFERENCE_SUPPRESSED/);

    await user.click(screen.getByLabelText(/Email channel is opted in/));
    await user.click(screen.getByRole('button', { name: /Emit review.assigned on email/ }));
    expect(status).toHaveTextContent(/Emitted review.assigned on email/);

    await user.click(screen.getByRole('button', { name: /Emit review.assigned on email/ }));
    expect(status).toHaveTextContent(/Suppressed duplicate of review.assigned on email/);
  });

  it('demonstrates a mandatory event overriding an opt-out', async () => {
    const user = userEvent.setup();
    render(<ScholarshipNotificationEventLog state="ready" events={[]} />);
    await user.click(screen.getByRole('button', { name: /Emit decision.recorded on in-app/ }));
    expect(screen.getByTestId('event-log-status')).toHaveTextContent(
      /Emitted decision.recorded on in-app/
    );
  });

  it('proves PII is never carried in a payload inspection view', async () => {
    const user = userEvent.setup();
    render(<ScholarshipNotificationEventLog state="ready" events={[record()]} />);
    await user.click(screen.getByRole('button', { name: 'Inspect payload' }));
    const panel = screen.getByRole('region', { name: 'Payload inspection' });
    expect(panel).toHaveTextContent(/every other key/i);
    expect(panel.textContent).not.toContain('applicantEmail');
  });
});
