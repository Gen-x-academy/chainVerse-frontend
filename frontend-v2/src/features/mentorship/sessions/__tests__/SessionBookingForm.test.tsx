import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SessionBookingForm, type SessionBookingFormProps } from '../components/SessionBookingForm';
import type { BookSessionRequest, BookSessionResponse } from '../session-booking.service';
import { FIXTURE_SLOT_END, FIXTURE_SLOT_START } from '../test-fixtures';

const confirmed = (replayed = false): BookSessionResponse => ({
  replayed,
  session: {
    sessionId: 'ses-1',
    startsAt: FIXTURE_SLOT_START,
    endsAt: FIXTURE_SLOT_END,
    mode: 'virtual',
    durationMinutes: 30,
  },
});

function setup(overrides: Partial<SessionBookingFormProps> = {}) {
  let counter = 0;
  const onSubmit = vi.fn<(request: BookSessionRequest) => Promise<BookSessionResponse>>(async () => confirmed());
  const props: SessionBookingFormProps = {
    agreement: { agreementId: 'agr-1', status: 'active' },
    slot: { startsAt: FIXTURE_SLOT_START, endsAt: FIXTURE_SLOT_END },
    timeZone: 'America/New_York',
    allowedDurationsMinutes: [30, 45, 60],
    onSubmit,
    createIdempotencyKey: () => `book-key-${(counter += 1).toString().padStart(4, '0')}`,
    ...overrides,
  };
  const view = render(<SessionBookingForm {...props} />);
  return { onSubmit, user: userEvent.setup(), ...view };
}

describe('SessionBookingForm states', () => {
  it('shows a denied state when the viewer may not book', () => {
    setup({ canBook: false });
    expect(screen.getByRole('alert')).toHaveTextContent('do not have permission');
    expect(screen.queryByRole('button', { name: /book session/i })).not.toBeInTheDocument();
  });

  it('shows an empty state when no agreement is chosen', () => {
    setup({ agreement: null });
    expect(screen.getByRole('status')).toHaveTextContent('No agreement selected');
  });

  it('refuses an agreement that is not active', () => {
    setup({ agreement: { agreementId: 'agr-1', status: 'pending_acceptance' } });
    expect(screen.getByRole('alert')).toHaveTextContent('only be booked while the agreement is active');
  });

  it('asks for a slot first when none is chosen', () => {
    setup({ slot: null });
    expect(screen.getByRole('status')).toHaveTextContent('Pick an available slot first');
  });

  it('shows the slot in local time and UTC', () => {
    setup();
    expect(screen.getByText(/9:00 AM to 9:30 AM EST/)).toBeInTheDocument();
    expect(screen.getByText(/UTC: .*14:00 to 14:30 UTC/)).toBeInTheDocument();
  });
});

describe('SessionBookingForm booking', () => {
  it('books a virtual session and confirms with local time and UTC', async () => {
    const { onSubmit, user } = setup();
    await user.type(screen.getByLabelText(/agenda/i), 'Portfolio review');
    await user.click(screen.getByRole('button', { name: 'Book session' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      startsAt: FIXTURE_SLOT_START,
      durationMinutes: 30,
      mode: 'virtual',
      timeZone: 'America/New_York',
      agenda: 'Portfolio review',
      idempotencyKey: 'book-key-0001',
    });

    const heading = await screen.findByRole('heading', { name: 'Session booked' });
    expect(heading).toHaveFocus();
    expect(screen.getByText(/Your time:/).parentElement).toHaveTextContent('9:00 AM to 9:30 AM EST');
    expect(screen.getByText(/^UTC:/).parentElement).toHaveTextContent('14:00 to 14:30 UTC');
  });

  it('requires a location for in-person sessions and blocks the request', async () => {
    const { onSubmit, user } = setup();
    await user.click(screen.getByRole('radio', { name: 'In person' }));
    await user.click(screen.getByRole('button', { name: 'Book session' }));

    const input = screen.getByLabelText(/location reference/i);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(/Enter a location reference/);

    await user.type(input, 'loc_main-hall');
    await user.click(screen.getByRole('button', { name: 'Book session' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ mode: 'in_person', locationRef: 'loc_main-hall' });
  });

  it('rejects markup in the agenda before anything is sent', async () => {
    const { onSubmit, user } = setup();
    await user.type(screen.getByLabelText(/agenda/i), '<b>hi</b>');
    await user.click(screen.getByRole('button', { name: 'Book session' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Use plain text without markup.')).toBeInTheDocument();
  });

  it('refuses a slot whose length the program does not allow', async () => {
    const { onSubmit, user } = setup({ allowedDurationsMinutes: [60] });
    await user.click(screen.getByRole('button', { name: 'Book session' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Allowed lengths are 60 minutes/)).toBeInTheDocument();
  });

  it('announces a replayed booking without implying a second session', async () => {
    const { user } = setup({ onSubmit: async () => confirmed(true) });
    await user.click(screen.getByRole('button', { name: 'Book session' }));
    expect(await screen.findByText(/already confirmed/)).toBeInTheDocument();
  });
});

describe('SessionBookingForm failures and retries', () => {
  it('shows a stable, actionable message and focuses the alert', async () => {
    const { user } = setup({
      onSubmit: async () => {
        throw new Error(JSON.stringify({ code: 'SLOT_CONFLICT' }));
      },
    });
    await user.click(screen.getByRole('button', { name: 'Book session' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('already has a session at this time. Search for another slot.');
    expect(alert).toHaveFocus();
  });

  it('maps server field issues onto the matching fields', async () => {
    const { user } = setup({
      onSubmit: async () => {
        throw Object.assign(new Error('invalid'), {
          code: 'INVALID_SESSION',
          issues: [{ field: 'agenda', message: 'Agenda is not allowed.' }],
        });
      },
    });
    await user.click(screen.getByRole('button', { name: 'Book session' }));
    expect(await screen.findByLabelText(/agenda/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('reuses the same key when the user retries after a network failure', async () => {
    const calls: string[] = [];
    let attempt = 0;
    const { user } = setup({
      onSubmit: async (request) => {
        calls.push(request.idempotencyKey);
        attempt += 1;
        if (attempt === 1) throw new Error('socket hang up');
        return confirmed();
      },
    });

    await user.click(screen.getByRole('button', { name: 'Book session' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('heading', { name: 'Session booked' });

    expect(calls).toEqual(['book-key-0001', 'book-key-0001']);
  });

  it('uses a new key once the details change', async () => {
    const calls: string[] = [];
    const { user } = setup({
      onSubmit: async (request) => {
        calls.push(request.idempotencyKey);
        throw new Error('socket hang up');
      },
    });

    await user.click(screen.getByRole('button', { name: 'Book session' }));
    await screen.findByRole('alert');
    await user.type(screen.getByLabelText(/agenda/i), 'Changed my mind');
    await user.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(calls).toHaveLength(2));

    expect(calls[0]).not.toBe(calls[1]);
  });

  it('sends only one request when the button is activated twice while pending', async () => {
    let release: (value: BookSessionResponse) => void = () => undefined;
    const pending = new Promise<BookSessionResponse>((resolve) => {
      release = resolve;
    });
    const slowSubmit = vi.fn(() => pending);
    const { user } = setup({ onSubmit: slowSubmit });

    const button = screen.getByRole('button', { name: 'Book session' });
    await user.click(button);
    await user.click(screen.getByRole('button', { name: /booking session/i }));

    expect(slowSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /booking session/i })).toBeDisabled();
    expect(document.querySelector('form')).toHaveAttribute('aria-busy', 'true');

    release(confirmed());
    await screen.findByRole('heading', { name: 'Session booked' });
  });
});

describe('SessionBookingForm keyboard and screen reader support', () => {
  it('can be completed with the keyboard alone', async () => {
    const { onSubmit, user } = setup();

    await user.tab();
    expect(screen.getByRole('radio', { name: 'Virtual' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'In person' })).toBeChecked();

    await user.tab();
    expect(screen.getByLabelText(/location reference/i)).toHaveFocus();
    await user.keyboard('loc-12');
    await user.tab();
    expect(screen.getByLabelText(/agenda/i)).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Book session' })).toHaveFocus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ mode: 'in_person', locationRef: 'loc-12' });
  });

  it('exposes a named region, a labelled radio group and described fields', () => {
    setup();
    expect(screen.getByRole('region', { name: 'Book a session' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Session mode' })).toBeInTheDocument();
    expect(screen.getByLabelText(/agenda/i)).toHaveAccessibleDescription('0 of 2000 characters');
  });
});
