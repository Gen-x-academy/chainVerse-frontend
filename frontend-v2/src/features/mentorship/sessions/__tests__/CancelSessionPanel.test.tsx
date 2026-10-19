import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CancelSessionPanel, type CancelSessionPanelProps } from '../components/CancelSessionPanel';
import type { CancelSessionRequest, CancelSessionResponse } from '../session-cancellation.service';
import type { SessionCancellation } from '../session-core';
import {
  FIXTURE_NOW,
  FIXTURE_SLOT_END,
  FIXTURE_SLOT_START,
  SESSION_AMOUNT_MINOR,
  cancellationSnapshot,
} from '../test-fixtures';

const cancellation: SessionCancellation = {
  cancelledAt: FIXTURE_NOW.toISOString(),
  cancelledBy: 'user-mentee-1',
  cancelledByRole: 'mentee',
  reasonCode: 'schedule_conflict',
  note: 'Clash with an exam',
  noticeHours: 29,
  policyId: 'pol-standard',
  policyVersion: 3,
  appliedRefundBps: 5000,
  refundMinor: 5000,
  mentorCompensationMinor: 4000,
  platformFeeMinor: 1000,
  settlementInstructionId: 'stl-1',
};

const done = (replayed = false): CancelSessionResponse => ({
  replayed,
  session: { sessionId: 'ses-1', status: 'cancelled', revision: 2 },
  cancellation,
});

const session = {
  sessionId: 'ses-1',
  startsAt: FIXTURE_SLOT_START,
  endsAt: FIXTURE_SLOT_END,
  status: 'booked' as const,
};

function setup(overrides: Partial<CancelSessionPanelProps> = {}) {
  let counter = 0;
  const onCancel = vi.fn<(request: CancelSessionRequest) => Promise<CancelSessionResponse>>(async () => done());
  const props: CancelSessionPanelProps = {
    session,
    viewerRole: 'mentee',
    timeZone: 'America/New_York',
    amountMinor: SESSION_AMOUNT_MINOR,
    currency: 'USD',
    snapshot: cancellationSnapshot,
    now: FIXTURE_NOW,
    onCancel,
    createKey: () => `cancel-key-${(counter += 1).toString().padStart(4, '0')}`,
    ...overrides,
  };
  const view = render(<CancelSessionPanel {...props} />);
  return { onCancel, user: userEvent.setup(), ...view };
}

async function fill(user: ReturnType<typeof userEvent.setup>, reason = 'Schedule conflict') {
  await user.selectOptions(screen.getByLabelText('Reason'), reason);
  await user.click(screen.getByRole('checkbox', { name: /I understand the refund/ }));
}

describe('CancelSessionPanel states', () => {
  it('denies a viewer with no scheduling role', () => {
    setup({ viewerRole: undefined });
    expect(screen.getByRole('alert')).toHaveTextContent('do not have permission');
  });

  it('shows an empty state without a session', () => {
    setup({ session: null });
    expect(screen.getByRole('status')).toHaveTextContent('No session selected');
  });

  it('refuses a session that is completed', () => {
    setup({ session: { ...session, status: 'completed' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Only a booked session');
  });

  it('explains that a started session can no longer be cancelled', () => {
    setup({ now: new Date(Date.parse(FIXTURE_SLOT_START) + 60_000) });
    expect(screen.getByRole('alert')).toHaveTextContent('already started');
    expect(screen.queryByRole('button', { name: 'Cancel session' })).not.toBeInTheDocument();
  });

  it('shows an already cancelled session as a read-only summary with the policy version', () => {
    setup({ session: { ...session, status: 'cancelled', cancellation } });
    const summary = screen.getByRole('status');
    expect(summary).toHaveTextContent('Cancelled by the mentee');
    expect(summary).toHaveTextContent('Refund to the mentee: $50.00');
    expect(summary).toHaveTextContent('Cancellation policy pol-standard, version 3');
    expect(screen.queryByRole('button', { name: 'Cancel session' })).not.toBeInTheDocument();
  });
});

describe('CancelSessionPanel consequences', () => {
  it('shows the time in local time and UTC and the refund before anything is confirmed', () => {
    setup();
    expect(screen.getByText(/9:00 AM to 9:30 AM EST/)).toBeInTheDocument();
    expect(screen.getByText(/UTC: .*14:00 to 14:30 UTC/)).toBeInTheDocument();
    expect(screen.getByText('Refund to the mentee: $50.00 (50%)')).toBeInTheDocument();
    expect(screen.getByText('29 hours until the session starts.')).toBeInTheDocument();
    expect(screen.queryByText(/Payment to the mentor/)).not.toBeInTheDocument();
  });

  it('tells a mentor the mentee is refunded in full and what the mentor is paid', () => {
    setup({ viewerRole: 'mentor' });
    expect(screen.getByText('Refund to the mentee: $100.00 (100%)')).toBeInTheDocument();
    expect(screen.getByText('Payment to the mentor: $0.00')).toBeInTheDocument();
  });

  it('offers coordinators the platform reason and participants only the others', () => {
    const { unmount } = setup();
    expect(screen.queryByRole('option', { name: 'Platform action' })).not.toBeInTheDocument();
    unmount();
    setup({ viewerRole: 'coordinator' });
    expect(screen.getByRole('option', { name: 'Platform action' })).toBeInTheDocument();
  });
});

describe('CancelSessionPanel cancelling', () => {
  it('requires a reason and an explicit confirmation before sending', async () => {
    const { onCancel, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Cancel session' }));

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Reason')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Reason')).toHaveAccessibleDescription('Choose a reason for the cancellation.');
    expect(screen.getByText('Confirm that you understand the refund to continue.')).toBeInTheDocument();
  });

  it('requires a note for the other reason and rejects markup', async () => {
    const { onCancel, user } = setup();
    await fill(user, 'Other');
    await user.click(screen.getByRole('button', { name: 'Cancel session' }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByText(/Add a note of at least 5 characters/)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Note/), '<b>x</b> family matter');
    await user.click(screen.getByRole('button', { name: 'Cancel session' }));
    expect(screen.getByText('Use plain text without markup.')).toBeInTheDocument();
  });

  it('sends the acknowledged refund and shows the summary with focus', async () => {
    const { onCancel, user } = setup();
    await fill(user);
    await user.type(screen.getByLabelText(/Note/), '  Clash with an exam  ');
    await user.click(screen.getByRole('button', { name: 'Cancel session' }));

    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    expect(onCancel).toHaveBeenCalledWith({
      reasonCode: 'schedule_conflict',
      note: 'Clash with an exam',
      acknowledgedRefundMinor: 5000,
      idempotencyKey: 'cancel-key-0001',
    });
    const heading = await screen.findByRole('heading', { name: 'Session cancelled' });
    expect(heading).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('Refund to the mentee: $50.00');
  });

  it('announces a replayed cancellation without implying a second one', async () => {
    const { user } = setup({ onCancel: async () => done(true) });
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Cancel session' }));
    expect(await screen.findByText(/already cancelled. No second cancellation/)).toBeInTheDocument();
  });

  it('shows a stable message and focuses the alert when the refund changed', async () => {
    const { user } = setup({
      onCancel: async () => {
        throw new Error(JSON.stringify({ code: 'PAYMENT_PREVIEW_MISMATCH' }));
      },
    });
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Cancel session' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The fee for this change has changed');
    expect(alert).toHaveFocus();
  });

  it('retries with the same key and rotates it when the details change', async () => {
    const keys: string[] = [];
    const { user } = setup({
      onCancel: async (request) => {
        keys.push(request.idempotencyKey);
        throw new Error('socket hang up');
      },
    });
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Cancel session' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(keys).toHaveLength(2));
    expect(keys[0]).toBe(keys[1]);

    await user.type(screen.getByLabelText(/Note/), 'Changed my mind');
    await user.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(keys).toHaveLength(3));
    expect(keys[2]).not.toBe(keys[0]);
  });

  it('sends one request when activated again while pending', async () => {
    let release: (value: CancelSessionResponse) => void = () => undefined;
    const slow = vi.fn<(request: CancelSessionRequest) => Promise<CancelSessionResponse>>(
      () => new Promise((resolve) => (release = resolve)),
    );
    const { user } = setup({ onCancel: slow });
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Cancel session' }));

    expect(screen.getByRole('button', { name: 'Cancelling…' })).toBeDisabled();
    expect(document.querySelector('form')).toHaveAttribute('aria-busy', 'true');
    await user.click(screen.getByRole('button', { name: 'Cancelling…' }));
    expect(slow).toHaveBeenCalledTimes(1);

    release(done());
    await screen.findByRole('heading', { name: 'Session cancelled' });
  });
});

describe('CancelSessionPanel keyboard and screen reader support', () => {
  it('can be completed with the keyboard alone', async () => {
    const { onCancel, user } = setup();

    await user.tab();
    expect(screen.getByLabelText('Reason')).toHaveFocus();
    await user.selectOptions(screen.getByLabelText('Reason'), 'Illness');
    await user.tab();
    expect(screen.getByLabelText(/Note/)).toHaveFocus();
    await user.tab();
    const confirm = screen.getByRole('checkbox', { name: /I understand the refund/ });
    expect(confirm).toHaveFocus();
    await user.keyboard(' ');
    expect(confirm).toBeChecked();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancel session' })).toHaveFocus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    expect(onCancel.mock.calls[0][0]).toMatchObject({ reasonCode: 'illness' });
  });

  it('exposes a named region, labelled fields and a live consequence summary', () => {
    setup();
    expect(screen.getByRole('region', { name: 'Cancel session' })).toBeInTheDocument();
    expect(screen.getByLabelText('Reason')).toBeRequired();
    expect(screen.getByText('What cancelling means').parentElement).toHaveAttribute('aria-live', 'polite');
  });
});
