import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  RescheduleSessionPanel,
  type RescheduleSessionPanelProps,
} from '../components/RescheduleSessionPanel';
import type { RescheduleProposal } from '../session-core';
import type { RescheduleResponse } from '../session-reschedule.service';
import {
  FIXTURE_NEW_START,
  FIXTURE_NOW,
  FIXTURE_SLOT_END,
  FIXTURE_SLOT_START,
  MENTEE_ID,
  MENTOR_ID,
  SESSION_AMOUNT_MINOR,
  reschedulePolicy,
} from '../test-fixtures';

const ok: RescheduleResponse = {
  replayed: false,
  proposal: { proposalId: 'rsp-1' } as RescheduleProposal,
  session: { sessionId: 'ses-1', startsAt: FIXTURE_SLOT_START, endsAt: FIXTURE_SLOT_END, revision: 1 },
};

const session = {
  sessionId: 'ses-1',
  startsAt: FIXTURE_SLOT_START,
  endsAt: FIXTURE_SLOT_END,
  originalStartsAt: FIXTURE_SLOT_START,
  status: 'booked' as const,
  timeChanges: [],
};

const proposal = (overrides: Partial<RescheduleProposal> = {}): RescheduleProposal => ({
  proposalId: 'rsp-1',
  sessionId: 'ses-1',
  agreementId: 'agr-1',
  tenantId: 'tenant-a',
  proposedBy: MENTEE_ID,
  baseRevision: 1,
  currentStartsAt: FIXTURE_SLOT_START,
  proposedStartsAt: FIXTURE_NEW_START,
  proposedEndsAt: '2026-11-04T15:30:00.000Z',
  reason: 'An exam moved onto that afternoon',
  status: 'pending',
  feeMinor: 2500,
  createdAt: FIXTURE_NOW.toISOString(),
  expiresAt: '2026-11-04T09:00:00.000Z',
  ...overrides,
});

const slots = [
  { startsAt: FIXTURE_SLOT_START, endsAt: FIXTURE_SLOT_END },
  { startsAt: FIXTURE_NEW_START, endsAt: '2026-11-04T15:30:00.000Z' },
  { startsAt: '2026-11-05T15:00:00.000Z', endsAt: '2026-11-05T15:30:00.000Z' },
];

function setup(overrides: Partial<RescheduleSessionPanelProps> = {}) {
  let counter = 0;
  const handlers = {
    onPropose: vi.fn<NonNullable<RescheduleSessionPanelProps['onPropose']>>(async () => ok),
    onApply: vi.fn<NonNullable<RescheduleSessionPanelProps['onApply']>>(async () => ok),
    onDecide: vi.fn<NonNullable<RescheduleSessionPanelProps['onDecide']>>(async () => ok),
  };
  const props: RescheduleSessionPanelProps = {
    session,
    viewerId: MENTEE_ID,
    viewerRole: 'mentee',
    timeZone: 'America/New_York',
    slots,
    amountMinor: SESSION_AMOUNT_MINOR,
    currency: 'USD',
    policy: reschedulePolicy,
    now: FIXTURE_NOW,
    createKey: () => `resch-key-${(counter += 1).toString().padStart(4, '0')}`,
    onPropose: handlers.onPropose,
    onDecide: handlers.onDecide,
    ...overrides,
  };
  const view = render(<RescheduleSessionPanel {...props} />);
  return { ...handlers, user: userEvent.setup(), ...view };
}

describe('RescheduleSessionPanel states', () => {
  it('denies a viewer with no scheduling role', () => {
    setup({ viewerRole: undefined });
    expect(screen.getByRole('alert')).toHaveTextContent('do not have permission');
  });

  it('shows an empty state without a session and refuses a session that is not booked', () => {
    const { unmount } = setup({ session: null });
    expect(screen.getByRole('status')).toHaveTextContent('No session selected');
    unmount();
    setup({ session: { ...session, status: 'cancelled' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Only a booked session');
  });

  it('shows the current time in local time and UTC', () => {
    setup();
    expect(screen.getByText(/Current time:/).parentElement).toHaveTextContent('9:00 AM to 9:30 AM EST');
    expect(screen.getByText(/UTC: .*14:00 to 14:30 UTC/)).toBeInTheDocument();
  });

  it('keeps the original time and every earlier move visible', () => {
    setup({
      session: {
        ...session,
        startsAt: FIXTURE_NEW_START,
        endsAt: '2026-11-04T15:30:00.000Z',
        timeChanges: [
          {
            proposalId: 'rsp-0',
            fromStartsAt: FIXTURE_SLOT_START,
            toStartsAt: FIXTURE_NEW_START,
            changedAt: FIXTURE_NOW.toISOString(),
            requestedBy: MENTEE_ID,
            approvedBy: MENTOR_ID,
            reason: 'Exam clash',
            override: false,
          },
        ],
      },
    });
    expect(screen.getByText(/Originally scheduled:/).parentElement).toHaveTextContent('Nov 3, 2026');
    const history = screen.getByRole('list', { name: 'Time changes' });
    expect(history).toHaveTextContent('Reason: Exam clash');
  });
});

describe('RescheduleSessionPanel requesting a change', () => {
  it('previews the fee and will not send until the mentee accepts it', async () => {
    const { onPropose, user } = setup();
    expect(screen.getByText('Fee: $25.00')).toBeInTheDocument();
    expect(screen.getByText(/25% of 10000 is 2500/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /Nov 4, 2026/ }));
    await user.type(screen.getByLabelText('Reason'), '  An exam moved onto that afternoon  ');
    await user.click(screen.getByRole('button', { name: 'Send request' }));

    expect(onPropose).not.toHaveBeenCalled();
    expect(screen.getByText('Confirm that you accept the fee to continue.')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /accept the fee of \$25.00/ }));
    await user.click(screen.getByRole('button', { name: 'Send request' }));

    await waitFor(() => expect(onPropose).toHaveBeenCalledTimes(1));
    expect(onPropose).toHaveBeenCalledWith({
      proposedStartsAt: FIXTURE_NEW_START,
      reason: 'An exam moved onto that afternoon',
      acknowledgedFeeMinor: 2500,
      idempotencyKey: 'resch-key-0001',
    });
    const status = await screen.findByText(/Request sent/);
    expect(status).toHaveFocus();
    expect(status).toHaveTextContent('other participant needs to approve');
  });

  it('shows no fee and no confirmation box for a mentor', async () => {
    const { onPropose, user } = setup({ viewerRole: 'mentor', viewerId: MENTOR_ID });
    expect(screen.getByText('No fee for this change.')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /Nov 4, 2026/ }));
    await user.type(screen.getByLabelText('Reason'), 'Travelling that week');
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    await waitFor(() => expect(onPropose).toHaveBeenCalledTimes(1));
    expect(onPropose.mock.calls[0][0]).toMatchObject({ acknowledgedFeeMinor: 0 });
  });

  it('blocks the request inside the minimum notice window', () => {
    setup({ now: new Date(Date.parse(FIXTURE_SLOT_START) - 6 * 3_600_000) });
    expect(screen.getByRole('alert')).toHaveTextContent('too close to the session start');
    expect(screen.getByRole('button', { name: 'Send request' })).toBeDisabled();
  });

  it('validates the time and the reason before anything is sent', async () => {
    const { onPropose, user } = setup({ viewerRole: 'mentor', viewerId: MENTOR_ID });
    await user.type(screen.getByLabelText('Reason'), 'no');
    await user.click(screen.getByRole('button', { name: 'Send request' }));

    expect(onPropose).not.toHaveBeenCalled();
    expect(screen.getByText('Choose a new time.')).toBeInTheDocument();
    expect(screen.getByLabelText('Reason')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Reason')).toHaveAccessibleDescription(/at least 5 characters/);

    await user.clear(screen.getByLabelText('Reason'));
    await user.type(screen.getByLabelText('Reason'), '<b>bold</b> reason');
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(screen.getByText('Use plain text without markup.')).toBeInTheDocument();
  });

  it('shows a stable message and focuses the alert when the fee changed', async () => {
    const { user } = setup({
      viewerRole: 'mentor',
      viewerId: MENTOR_ID,
      onPropose: async () => {
        throw new Error(JSON.stringify({ code: 'PAYMENT_PREVIEW_MISMATCH' }));
      },
    });
    await user.click(screen.getByRole('radio', { name: /Nov 4, 2026/ }));
    await user.type(screen.getByLabelText('Reason'), 'Travelling that week');
    await user.click(screen.getByRole('button', { name: 'Send request' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The fee for this change has changed');
    expect(alert).toHaveFocus();
  });

  it('retries with the same key and rotates it when the details change', async () => {
    const keys: string[] = [];
    const { user } = setup({
      viewerRole: 'mentor',
      viewerId: MENTOR_ID,
      onPropose: async (request) => {
        keys.push(request.idempotencyKey);
        throw new Error('socket hang up');
      },
    });
    await user.click(screen.getByRole('radio', { name: /Nov 4, 2026/ }));
    await user.type(screen.getByLabelText('Reason'), 'Travelling that week');
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(keys).toHaveLength(2));
    expect(keys[0]).toBe(keys[1]);

    await user.type(screen.getByLabelText('Reason'), ' again');
    await user.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(keys).toHaveLength(3));
    expect(keys[2]).not.toBe(keys[0]);
  });
});

describe('RescheduleSessionPanel answering a request', () => {
  const asMentor = { viewerRole: 'mentor' as const, viewerId: MENTOR_ID };

  it('lets the other participant read the reason and approve', async () => {
    const { onDecide, user } = setup({ ...asMentor, pendingProposal: proposal() });
    const group = screen.getByRole('group', { name: 'Open reschedule request' });
    expect(group).toHaveTextContent('Reason: An exam moved onto that afternoon');
    expect(group).toHaveTextContent('Late change fee: $25.00');
    expect(group).toHaveTextContent('10:00 AM to 10:30 AM EST');
    expect(screen.queryByLabelText('Reason')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Approve new time' }));
    await waitFor(() => expect(onDecide).toHaveBeenCalledWith('rsp-1', 'approve'));
    expect(await screen.findByText(/You approved the new time/)).toHaveFocus();
  });

  it('lets the other participant decline', async () => {
    const { onDecide, user } = setup({ ...asMentor, pendingProposal: proposal() });
    await user.click(screen.getByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(onDecide).toHaveBeenCalledWith('rsp-1', 'decline'));
  });

  it('lets the requester withdraw but not approve their own request', async () => {
    const { onDecide, user } = setup({ pendingProposal: proposal() });
    expect(screen.getByText('Your request is waiting for a reply')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve new time' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Withdraw request' }));
    await waitFor(() => expect(onDecide).toHaveBeenCalledWith('rsp-1', 'withdraw'));
  });

  it('offers no answer once the request has expired', () => {
    setup({ ...asMentor, pendingProposal: proposal(), now: new Date('2026-11-04T09:00:00.000Z') });
    expect(screen.getByRole('status')).toHaveTextContent('This request has expired');
    expect(screen.queryByRole('button', { name: 'Approve new time' })).not.toBeInTheDocument();
  });

  it('sends one answer when the buttons are pressed again while pending', async () => {
    let release: (value: RescheduleResponse) => void = () => undefined;
    const onDecide = vi.fn<NonNullable<RescheduleSessionPanelProps['onDecide']>>(
      () => new Promise<RescheduleResponse>((resolve) => (release = resolve)),
    );
    const { user } = setup({ ...asMentor, pendingProposal: proposal(), onDecide });

    await user.click(screen.getByRole('button', { name: 'Approve new time' }));
    expect(screen.getByRole('button', { name: 'Approving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Decline' }));
    expect(onDecide).toHaveBeenCalledTimes(1);

    release(ok);
    await screen.findByText(/You approved/);
  });

  it('reports a stale approval in plain words', async () => {
    const { user } = setup({
      ...asMentor,
      pendingProposal: proposal(),
      onDecide: async () => {
        throw new Error(JSON.stringify({ code: 'PROPOSAL_STALE' }));
      },
    });
    await user.click(screen.getByRole('button', { name: 'Approve new time' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('can no longer be approved');
  });
});

describe('RescheduleSessionPanel coordinator changes', () => {
  it('applies a change directly with a reason and no fee step', async () => {
    const applied = vi.fn<NonNullable<RescheduleSessionPanelProps['onApply']>>(async () => ok);
    const { onPropose, user } = setup({
      viewerRole: 'coordinator',
      viewerId: 'user-coord-1',
      onApply: applied,
    });
    expect(screen.getByText('Coordinator changes are free for both participants.')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /Nov 5, 2026/ }));
    await user.type(screen.getByLabelText('Reason'), 'The venue is closed that morning');
    await user.click(screen.getByRole('button', { name: 'Apply change' }));

    await waitFor(() => expect(applied).toHaveBeenCalledTimes(1));
    expect(applied.mock.calls[0][0]).toEqual({
      proposedStartsAt: '2026-11-05T15:00:00.000Z',
      reason: 'The venue is closed that morning',
      idempotencyKey: 'resch-key-0001',
    });
    expect(onPropose).not.toHaveBeenCalled();
    expect(await screen.findByText(/session has been moved/)).toBeInTheDocument();
  });

  it('shows a coordinator without apply rights a denial', () => {
    setup({ viewerRole: 'coordinator', viewerId: 'user-coord-1', onApply: undefined });
    expect(screen.getByRole('alert')).toHaveTextContent('do not have permission');
  });
});

describe('RescheduleSessionPanel keyboard and screen reader support', () => {
  it('can be completed with the keyboard alone', async () => {
    const { onPropose, user } = setup({ viewerRole: 'mentor', viewerId: MENTOR_ID });

    await user.tab();
    const first = screen.getByRole('radio', { name: /Nov 4, 2026/ });
    expect(first).toHaveFocus();
    await user.keyboard(' ');
    expect(first).toBeChecked();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: /Nov 5, 2026/ })).toBeChecked();

    await user.tab();
    expect(screen.getByLabelText('Reason')).toHaveFocus();
    await user.keyboard('Travelling that week');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Send request' })).toHaveFocus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(onPropose).toHaveBeenCalledTimes(1));
    expect(onPropose.mock.calls[0][0].proposedStartsAt).toBe('2026-11-05T15:00:00.000Z');
  });

  it('exposes a named region, a labelled radio group and a live cost summary', () => {
    setup();
    expect(screen.getByRole('region', { name: 'Reschedule session' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Choose a new time' })).toBeInTheDocument();
    expect(screen.getByText('What this change costs').parentElement).toHaveAttribute('aria-live', 'polite');
  });
});
