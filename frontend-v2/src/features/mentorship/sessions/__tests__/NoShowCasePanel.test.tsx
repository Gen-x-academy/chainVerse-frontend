import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NoShowCasePanel, type NoShowCasePanelProps } from '../components/NoShowCasePanel';
import type { NoShowReportResponse, ResolveNoShowRequest, RespondToNoShowRequest } from '../no-show-reports.service';
import type { NoShowReport } from '../session-core';
import { MENTEE_ID, MENTOR_ID, NO_SHOW_NOW, noShowPolicy } from '../test-fixtures';

const base: NoShowReport = {
  reportId: 'nsr-1',
  sessionId: 'ses-1',
  agreementId: 'agr-1',
  tenantId: 'tenant-a',
  status: 'open',
  claims: [
    {
      claimId: 'nsc-1',
      reporterId: MENTEE_ID,
      reporterRole: 'mentee',
      type: 'mentor',
      statement: 'The mentor never joined the call',
      evidence: [{ kind: 'note', text: 'Waited 15 minutes' }, { kind: 'attachment', restricted: true }],
      reportedAt: NO_SHOW_NOW.toISOString(),
    },
  ],
  responses: [],
  conflicting: false,
  responseDeadline: '2026-11-05T14:20:00.000Z',
  consequence: 'pending_policy',
  createdAt: NO_SHOW_NOW.toISOString(),
};

const reply: NoShowReportResponse = { report: base, merged: false, replayed: false };
const participants = { mentorId: MENTOR_ID, menteeId: MENTEE_ID };
const afterDeadline = new Date('2026-11-05T14:21:00.000Z');

function setup(overrides: Partial<NoShowCasePanelProps> = {}) {
  const onRespond = vi.fn<(request: RespondToNoShowRequest) => Promise<NoShowReportResponse>>(async () => reply);
  const onResolve = vi.fn<(request: ResolveNoShowRequest) => Promise<NoShowReportResponse>>(async () => reply);
  const props: NoShowCasePanelProps = {
    report: base,
    participants,
    viewerId: MENTOR_ID,
    viewerRole: 'mentor',
    timeZone: 'America/New_York',
    policy: noShowPolicy,
    now: NO_SHOW_NOW,
    onRespond,
    onResolve,
    ...overrides,
  };
  const view = render(<NoShowCasePanel {...props} />);
  return { onRespond, onResolve, user: userEvent.setup(), ...view };
}

describe('NoShowCasePanel states', () => {
  it('denies a viewer with no role and shows an empty state without a report', () => {
    const { unmount } = setup({ viewerRole: undefined });
    expect(screen.getByRole('alert')).toHaveTextContent('do not have permission');
    unmount();
    setup({ report: null });
    expect(screen.getByRole('status')).toHaveTextContent('no report for this session');
  });

  it('says that no consequence has been applied while the report is open', () => {
    setup();
    expect(screen.getByText(/No consequence has been applied. Consequences wait for review/)).toBeInTheDocument();
  });

  it('shows the claim, its statement and its notes, but only that an attachment exists', () => {
    setup();
    const claims = screen.getByRole('list', { name: 'Reports' });
    expect(claims).toHaveTextContent('Mentee reported: The mentor did not attend');
    expect(claims).toHaveTextContent('The mentor never joined the call');
    expect(claims).toHaveTextContent('Note: Waited 15 minutes');
    expect(claims).toHaveTextContent('Attachment (restricted)');
    expect(claims).not.toHaveTextContent('att-');
  });

  it('flags disagreement so participants know a coordinator will decide', () => {
    setup({ report: { ...base, conflicting: true } });
    expect(screen.getByText('The participants disagree. A coordinator will decide.')).toBeInTheDocument();
  });

  it('shows a resolved report as a read-only outcome with the note and consequence', () => {
    setup({
      report: {
        ...base,
        status: 'resolved',
        outcome: 'uphold_mentor_no_show',
        consequence: 'refund_mentee',
        resolutionNote: 'Reviewed the call logs',
      },
    });
    expect(screen.getByText('Outcome: Mentor did not attend')).toBeInTheDocument();
    expect(screen.getByText('Note: Reviewed the call logs')).toBeInTheDocument();
    expect(screen.getByText(/The mentee will be refunded/)).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Respond to this report' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resolve report' })).not.toBeInTheDocument();
  });
});

describe('NoShowCasePanel accused participant', () => {
  it('is told they can respond, until when, and that nothing is decided before then', () => {
    setup();
    const form = screen.getByRole('form', { name: 'Respond to this report' });
    expect(form).toHaveTextContent('You can respond until Thu, Nov 5, 2026, 9:20 AM');
    expect(form).toHaveTextContent('14:20');
    expect(form).toHaveTextContent('Nothing is decided against you before you have had the chance');
  });

  it('validates the response before sending', async () => {
    const { onRespond, user } = setup();
    await user.type(screen.getByLabelText('Your response'), 'no');
    await user.click(screen.getByRole('button', { name: 'Send response' }));
    expect(onRespond).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Your response')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Your response')).toHaveAccessibleDescription(/at least 5 characters/);

    await user.clear(screen.getByLabelText('Your response'));
    await user.type(screen.getByLabelText('Your response'), '<b>I was there</b>');
    await user.click(screen.getByRole('button', { name: 'Send response' }));
    expect(screen.getByText('Use plain text without markup.')).toBeInTheDocument();
  });

  it('sends the response with evidence, confirms it and hides the form', async () => {
    const { onRespond, user } = setup();
    await user.type(screen.getByLabelText('Your response'), '  I was waiting in the room  ');
    await user.type(screen.getByLabelText('Evidence note'), 'Logged in at 14:00');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await user.click(screen.getByRole('button', { name: 'Send response' }));

    await waitFor(() => expect(onRespond).toHaveBeenCalledTimes(1));
    expect(onRespond).toHaveBeenCalledWith({
      statement: 'I was waiting in the room',
      evidence: [{ kind: 'note', text: 'Logged in at 14:00' }],
    });
    const done = await screen.findByText('Your response has been sent to the coordinator.');
    expect(done).toHaveFocus();
    expect(screen.queryByRole('form', { name: 'Respond to this report' })).not.toBeInTheDocument();
  });

  it('does not offer the form to the person who made the claim or to someone who already responded', () => {
    const { unmount } = setup({ viewerId: MENTEE_ID, viewerRole: 'mentee' });
    expect(screen.queryByRole('form', { name: 'Respond to this report' })).not.toBeInTheDocument();
    unmount();
    setup({
      report: {
        ...base,
        responses: [{ responderId: MENTOR_ID, statement: 'I was there', evidence: [], respondedAt: NO_SHOW_NOW.toISOString() }],
      },
    });
    expect(screen.queryByRole('form', { name: 'Respond to this report' })).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Responses' })).toHaveTextContent('I was there');
  });

  it('shows a stable message and focuses the alert on failure', async () => {
    const { user } = setup({
      onRespond: async () => {
        throw new Error(JSON.stringify({ code: 'NO_SHOW_ALREADY_RESOLVED' }));
      },
    });
    await user.type(screen.getByLabelText('Your response'), 'I was waiting in the room');
    await user.click(screen.getByRole('button', { name: 'Send response' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This report has already been resolved.');
    expect(alert).toHaveFocus();
  });

  it('sends one response when activated again while pending', async () => {
    let release: (value: NoShowReportResponse) => void = () => undefined;
    const slow = vi.fn<(request: RespondToNoShowRequest) => Promise<NoShowReportResponse>>(
      () => new Promise((resolve) => (release = resolve)),
    );
    const { user } = setup({ onRespond: slow });
    await user.type(screen.getByLabelText('Your response'), 'I was waiting in the room');
    await user.click(screen.getByRole('button', { name: 'Send response' }));
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Sending…' }));
    expect(slow).toHaveBeenCalledTimes(1);
    release(reply);
    await screen.findByText(/Your response has been sent/);
  });
});

describe('NoShowCasePanel coordinator resolution', () => {
  const asCoordinator = { viewerId: 'user-coord-1', viewerRole: 'coordinator' as const };
  const option = (name: string) => screen.getByRole('option', { name });

  it('holds back outcomes that go against a participant until due process is satisfied', () => {
    setup(asCoordinator);
    expect(option('Mentor did not attend')).toBeDisabled();
    expect(option('Mentee did not attend')).toBeDisabled();
    expect(option('Neither attended')).toBeDisabled();
    expect(option('Dismiss the report')).toBeEnabled();
    expect(option('Technical problem')).toBeEnabled();
    expect(screen.getByLabelText('Outcome')).toHaveAccessibleDescription(/waits until they respond or Thu, Nov 5, 2026, 9:20 AM/);
  });

  it('enables every outcome once the accused has responded or the deadline has passed', () => {
    const { unmount } = setup({
      ...asCoordinator,
      report: { ...base, responses: [{ responderId: MENTOR_ID, statement: 'I was there', evidence: [], respondedAt: NO_SHOW_NOW.toISOString() }] },
    });
    expect(option('Mentor did not attend')).toBeEnabled();
    expect(screen.getByLabelText('Outcome')).toHaveAccessibleDescription(/has had the chance to respond/);
    unmount();
    setup({ ...asCoordinator, now: afterDeadline });
    expect(option('Mentor did not attend')).toBeEnabled();
  });

  it('shows the coordinator the full report and offers no response form', () => {
    setup(asCoordinator);
    expect(screen.queryByRole('form', { name: 'Respond to this report' })).not.toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Resolve this report' })).toBeInTheDocument();
  });

  it('requires an outcome and rejects a markup note', async () => {
    const { onResolve, user } = setup(asCoordinator);
    await user.click(screen.getByRole('button', { name: 'Resolve report' }));
    expect(onResolve).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Outcome')).toHaveAttribute('aria-invalid', 'true');

    await user.selectOptions(screen.getByLabelText('Outcome'), 'Dismiss the report');
    await user.type(screen.getByLabelText(/Note/), '<b>x</b>');
    await user.click(screen.getByRole('button', { name: 'Resolve report' }));
    expect(screen.getByText('Use plain text without markup.')).toBeInTheDocument();
    expect(onResolve).not.toHaveBeenCalled();
  });

  it('resolves with the chosen outcome and note and confirms with focus', async () => {
    const { onResolve, user } = setup({ ...asCoordinator, now: afterDeadline });
    await user.selectOptions(screen.getByLabelText('Outcome'), 'Mentor did not attend');
    await user.type(screen.getByLabelText(/Note/), '  Reviewed the call logs  ');
    await user.click(screen.getByRole('button', { name: 'Resolve report' }));

    await waitFor(() => expect(onResolve).toHaveBeenCalledTimes(1));
    expect(onResolve).toHaveBeenCalledWith({ outcome: 'uphold_mentor_no_show', note: 'Reviewed the call logs' });
    expect(await screen.findByText(/The report has been resolved/)).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Resolve report' })).not.toBeInTheDocument();
  });

  it('shows the server due process message if the clock and the server disagree', async () => {
    const { user } = setup({
      ...asCoordinator,
      now: afterDeadline,
      onResolve: async () => {
        throw new Error(JSON.stringify({ code: 'DUE_PROCESS_PENDING' }));
      },
    });
    await user.selectOptions(screen.getByLabelText('Outcome'), 'Mentor did not attend');
    await user.click(screen.getByRole('button', { name: 'Resolve report' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('has not yet had the chance to respond');
    expect(alert).toHaveFocus();
  });

  it('can be completed with the keyboard alone', async () => {
    const { onResolve, user } = setup(asCoordinator);
    await user.tab();
    expect(screen.getByLabelText('Outcome')).toHaveFocus();
    await user.selectOptions(screen.getByLabelText('Outcome'), 'Technical problem');
    await user.tab();
    expect(screen.getByLabelText(/Note/)).toHaveFocus();
    await user.tab();
    const button = screen.getByRole('button', { name: 'Resolve report' });
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(onResolve).toHaveBeenCalledWith({ outcome: 'technical_issue' }));
  });

  it('exposes named regions and lists for screen readers', () => {
    setup(asCoordinator);
    expect(screen.getByRole('region', { name: 'No-show report' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Reports' }).children).toHaveLength(1);
    expect(screen.getByLabelText('Outcome')).toBeRequired();
  });
});
