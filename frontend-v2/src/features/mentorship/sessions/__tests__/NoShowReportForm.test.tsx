import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NoShowReportForm, type NoShowReportFormProps } from '../components/NoShowReportForm';
import type { CreateNoShowReportRequest, NoShowReportResponse } from '../no-show-reports.service';
import type { NoShowReport } from '../session-core';
import {
  FIXTURE_SLOT_END,
  FIXTURE_SLOT_START,
  MENTEE_ID,
  NO_SHOW_NOW,
  noShowPolicy,
} from '../test-fixtures';

const report: NoShowReport = {
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
      evidence: [],
      reportedAt: NO_SHOW_NOW.toISOString(),
    },
  ],
  responses: [],
  conflicting: false,
  responseDeadline: '2026-11-05T14:20:00.000Z',
  consequence: 'pending_policy',
  createdAt: NO_SHOW_NOW.toISOString(),
};

const reply = (overrides: Partial<NoShowReportResponse> = {}): NoShowReportResponse => ({
  report,
  merged: false,
  replayed: false,
  ...overrides,
});

const session = { sessionId: 'ses-1', startsAt: FIXTURE_SLOT_START, endsAt: FIXTURE_SLOT_END, status: 'booked' as const };

function setup(overrides: Partial<NoShowReportFormProps> = {}) {
  let counter = 0;
  const onSubmit = vi.fn<(request: CreateNoShowReportRequest) => Promise<NoShowReportResponse>>(async () => reply());
  const props: NoShowReportFormProps = {
    session,
    viewerId: MENTEE_ID,
    viewerRole: 'mentee',
    timeZone: 'America/New_York',
    policy: noShowPolicy,
    now: NO_SHOW_NOW,
    onSubmit,
    createKey: () => `noshow-key-${(counter += 1).toString().padStart(4, '0')}`,
    ...overrides,
  };
  const view = render(<NoShowReportForm {...props} />);
  return { onSubmit, user: userEvent.setup(), ...view };
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('radio', { name: 'The mentor did not attend' }));
  await user.type(screen.getByLabelText('Statement'), '  The mentor never joined the call  ');
}

describe('NoShowReportForm states', () => {
  it('denies a viewer who is not a participant', () => {
    setup({ viewerRole: 'coordinator' });
    expect(screen.getByRole('alert')).toHaveTextContent('do not have permission');
  });

  it('shows an empty state and refuses a cancelled session', () => {
    const { unmount } = setup({ session: null });
    expect(screen.getByRole('status')).toHaveTextContent('No session selected');
    unmount();
    setup({ session: { ...session, status: 'cancelled' } });
    expect(screen.getByRole('alert')).toHaveTextContent('cancelled session cannot have a no-show report');
  });

  it('waits for the grace period and says when reporting opens, in local time and UTC', () => {
    setup({ now: new Date('2026-11-03T14:05:00.000Z') });
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('9:10 AM');
    expect(status).toHaveTextContent('14:10');
    expect(screen.queryByRole('button', { name: 'Submit report' })).not.toBeInTheDocument();
  });

  it('says plainly when the reporting window has closed', () => {
    setup({ now: new Date('2026-11-04T14:31:00.000Z') });
    expect(screen.getByRole('alert')).toHaveTextContent('window for reporting a no-show for this session has closed');
  });

  it('shows the viewer their own report instead of the form, with the response deadline', () => {
    setup({ existingReport: report });
    expect(screen.queryByRole('button', { name: 'Submit report' })).not.toBeInTheDocument();
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Your report is open');
    expect(status).toHaveTextContent('Nov 5, 2026, 9:20 AM');
    expect(status).toHaveTextContent('No consequence is applied automatically');
  });
});

describe('NoShowReportForm reporting', () => {
  it('offers a mentee and a mentor only the options that make sense for them', () => {
    const { unmount } = setup();
    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual(['mentor', 'both', 'technical']);
    unmount();
    setup({ viewerRole: 'mentor', viewerId: 'user-mentor-1' });
    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual(['mentee', 'both', 'technical']);
  });

  it('requires a type and a statement before sending', async () => {
    const { onSubmit, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Submit report' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Choose what happened.')).toBeInTheDocument();
    expect(screen.getByLabelText('Statement')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Statement')).toHaveAccessibleDescription(/at least 5 characters/);
  });

  it('rejects markup in the statement', async () => {
    const { onSubmit, user } = setup();
    await user.click(screen.getByRole('radio', { name: 'The mentor did not attend' }));
    await user.type(screen.getByLabelText('Statement'), '<b>they</b> never came');
    await user.click(screen.getByRole('button', { name: 'Submit report' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Use plain text without markup.')).toBeInTheDocument();
  });

  it('sends the report, explains what happens next and moves focus to the confirmation', async () => {
    const { onSubmit, user } = setup();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Submit report' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      type: 'mentor',
      statement: 'The mentor never joined the call',
      evidence: [],
      idempotencyKey: 'noshow-key-0001',
    });
    const heading = await screen.findByRole('heading', { name: 'Report submitted' });
    expect(heading).toHaveFocus();
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Nothing happens to them before then');
    expect(status).toHaveTextContent('No consequence is applied automatically');
  });

  it('says when the report joined one the other participant opened, and when it was a repeat', async () => {
    const { user, unmount } = setup({ onSubmit: async () => reply({ merged: true }) });
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Submit report' }));
    expect(await screen.findByText(/added to the report already opened/)).toBeInTheDocument();
    unmount();

    const second = setup({ onSubmit: async () => reply({ replayed: true }) });
    await fillValid(second.user);
    await second.user.click(screen.getByRole('button', { name: 'Submit report' }));
    expect(await screen.findByText(/already submitted. No second report/)).toBeInTheDocument();
  });

  it('shows a stable message and focuses the alert', async () => {
    const { user } = setup({
      onSubmit: async () => {
        throw new Error(JSON.stringify({ code: 'NO_SHOW_WINDOW_CLOSED' }));
      },
    });
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Submit report' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('window for reporting a no-show');
    expect(alert).toHaveFocus();
  });

  it('retries with the same key and rotates it when the details change', async () => {
    const keys: string[] = [];
    const { user } = setup({
      onSubmit: async (request) => {
        keys.push(request.idempotencyKey);
        throw new Error('socket hang up');
      },
    });
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Submit report' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(keys).toHaveLength(2));
    expect(keys[0]).toBe(keys[1]);

    await user.type(screen.getByLabelText('Statement'), ' again');
    await user.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(keys).toHaveLength(3));
    expect(keys[2]).not.toBe(keys[0]);
  });

  it('sends one request when activated again while pending', async () => {
    let release: (value: NoShowReportResponse) => void = () => undefined;
    const slow = vi.fn<(request: CreateNoShowReportRequest) => Promise<NoShowReportResponse>>(
      () => new Promise((resolve) => (release = resolve)),
    );
    const { user } = setup({ onSubmit: slow });
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Submit report' }));

    expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
    expect(document.querySelector('form')).toHaveAttribute('aria-busy', 'true');
    await user.click(screen.getByRole('button', { name: 'Submitting…' }));
    expect(slow).toHaveBeenCalledTimes(1);

    release(reply());
    await screen.findByRole('heading', { name: 'Report submitted' });
  });
});

describe('NoShowReportForm evidence', () => {
  it('adds and removes notes and sends them with the report', async () => {
    const { onSubmit, user } = setup();
    await fillValid(user);
    await user.type(screen.getByLabelText('Evidence note'), 'Waited 15 minutes');
    await user.click(screen.getByRole('button', { name: 'Add note' }));

    const list = screen.getByRole('list', { name: 'Evidence added' });
    expect(within(list).getByText('Note: Waited 15 minutes')).toBeInTheDocument();
    expect(screen.getByText(/1 of 3 added/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Evidence note'), 'Second note');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await user.click(screen.getByRole('button', { name: 'Remove note 1' }));
    expect(screen.queryByText('Note: Waited 15 minutes')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Submit report' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].evidence).toEqual([{ kind: 'note', text: 'Second note' }]);
  });

  it('stops at the evidence limit and rejects empty or markup notes', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    expect(screen.getByText('Write a note before adding it.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Evidence note'), '<b>x</b>');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    expect(screen.getByText('Use plain text without markup.')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Evidence note'));

    for (const text of ['one', 'two', 'three']) {
      await user.type(screen.getByLabelText('Evidence note'), text);
      await user.click(screen.getByRole('button', { name: 'Add note' }));
    }
    expect(screen.getByLabelText('Evidence note')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add note' })).toBeDisabled();
    expect(screen.getByText(/3 of 3 added/)).toBeInTheDocument();
  });

  it('offers file upload only when an uploader is provided, limited to the allowed types', () => {
    const { unmount } = setup();
    expect(screen.queryByLabelText('Attach a file')).not.toBeInTheDocument();
    unmount();
    setup({ onUploadAttachment: vi.fn() });
    expect(screen.getByLabelText('Attach a file')).toHaveAttribute('accept', 'image/png,image/jpeg,application/pdf');
  });

  it('uploads a file and keeps only its reference, type and size', async () => {
    const attachment = { kind: 'attachment' as const, attachmentRef: 'att-0001-abcd', mimeType: 'image/png', sizeBytes: 2048 };
    const upload = vi.fn(async () => attachment);
    const { onSubmit, user } = setup({ onUploadAttachment: upload });
    await fillValid(user);
    await user.upload(screen.getByLabelText('Attach a file'), new File(['x'.repeat(2048)], 'proof.png', { type: 'image/png' }));

    expect(await screen.findByText('Attachment: PNG, 2 KB')).toBeInTheDocument();
    expect(screen.queryByText(/proof\.png/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Submit report' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].evidence).toEqual([attachment]);
  });

  it('refuses a disallowed or oversized file without uploading it, and reports a failed upload', async () => {
    const upload = vi.fn(async () => {
      throw new Error('network');
    });
    const user = userEvent.setup({ applyAccept: false });
    render(
      <NoShowReportForm
        session={session}
        viewerId={MENTEE_ID}
        viewerRole="mentee"
        timeZone="UTC"
        policy={noShowPolicy}
        now={NO_SHOW_NOW}
        onSubmit={async () => reply()}
        onUploadAttachment={upload}
      />,
    );
    const input = screen.getByLabelText('Attach a file');

    await user.upload(input, new File(['x'], 'run.exe', { type: 'application/x-msdownload' }));
    expect(screen.getByText(/Attach a PNG, JPEG, PDF file/)).toBeInTheDocument();
    const big = new File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 });
    await user.upload(input, big);
    expect(screen.getByText('A file must be under 5 MB.')).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();

    await user.upload(input, new File(['x'], 'ok.png', { type: 'image/png' }));
    expect(await screen.findByText('The file could not be uploaded. Try again.')).toBeInTheDocument();
  });
});

describe('NoShowReportForm keyboard and screen reader support', () => {
  it('can be completed with the keyboard alone', async () => {
    const { onSubmit, user } = setup();

    await user.tab();
    expect(screen.getByRole('radio', { name: 'The mentor did not attend' })).toHaveFocus();
    await user.keyboard(' ');
    expect(screen.getByRole('radio', { name: 'The mentor did not attend' })).toBeChecked();
    await user.tab();
    expect(screen.getByLabelText('Statement')).toHaveFocus();
    await user.keyboard('The mentor never joined the call');
    await user.tab();
    expect(screen.getByLabelText('Evidence note')).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Submit report' })).toHaveFocus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it('exposes a named region, a labelled radio group and described fields', () => {
    setup();
    expect(screen.getByRole('region', { name: 'Report a no-show' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'What happened?' })).toBeInTheDocument();
    expect(screen.getByLabelText('Statement')).toBeRequired();
    expect(screen.getByRole('group', { name: /Evidence/ })).toBeInTheDocument();
  });
});
