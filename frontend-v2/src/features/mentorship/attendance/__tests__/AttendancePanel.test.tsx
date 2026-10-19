import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AttendancePanel } from '../components/AttendancePanel';
import { computeAttendance, createCorrectionRequest } from '../attendance';
import {
  FIXTURE_MENTEE,
  FIXTURE_MENTOR,
  FIXTURE_OUTSIDER,
  FIXTURE_SESSION as S,
  FIXTURE_SIGNALS,
} from '../attendance.fixtures';

const labels = { [FIXTURE_MENTOR]: 'Mentor Mia', [FIXTURE_MENTEE]: 'Mentee Max' };
const rows = computeAttendance(S, FIXTURE_SIGNALS);
const mentee = { userId: FIXTURE_MENTEE };

describe('AttendancePanel', () => {
  it('shows privacy copy, status, minutes and methods', () => {
    render(<AttendancePanel viewer={mentee} session={S} attendance={rows} labels={labels} rawSignalsExpireAt="2026-04-01T00:00:00.000Z" />);
    expect(screen.getByText(/never collected/i)).toBeInTheDocument();
    expect(screen.getByText(/deleted after/i)).toBeInTheDocument();
    expect(screen.getByText('Partial attendance')).toBeInTheDocument();
    expect(screen.getByText(/20 min present/)).toBeInTheDocument();
    expect(screen.getAllByText(/platform presence/).length).toBeGreaterThan(0);
  });

  it('denies outsiders without rendering attendance', () => {
    render(<AttendancePanel viewer={{ userId: FIXTURE_OUTSIDER }} session={S} attendance={rows} labels={labels} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/do not have access/i);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows loading and empty states', () => {
    const { rerender } = render(<AttendancePanel viewer={mentee} session={S} attendance={[]} labels={labels} loading />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    rerender(<AttendancePanel viewer={mentee} session={S} attendance={[]} labels={labels} />);
    expect(screen.getByText(/no attendance has been recorded/i)).toBeInTheDocument();
  });

  it('explains pending corroboration', () => {
    const pending = [{ participantId: FIXTURE_MENTEE, status: 'pending-corroboration' as const, presentMinutes: 0, ratio: 0, methods: ['self-report' as const], corrected: false }];
    render(<AttendancePanel viewer={mentee} session={S} attendance={pending} labels={labels} />);
    expect(screen.getByText(/needs confirmation/i)).toBeInTheDocument();
  });

  it('records check-in and reuses the key after a failed attempt', async () => {
    const onRecord = vi.fn().mockRejectedValueOnce({ status: 500 }).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<AttendancePanel viewer={mentee} session={S} attendance={rows} labels={labels} onRecord={onRecord} />);
    await user.click(screen.getByRole('button', { name: 'Check in' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Check in' }));
    await waitFor(() => expect(onRecord).toHaveBeenCalledTimes(2));
    expect(onRecord.mock.calls[0][1]).toBe(onRecord.mock.calls[1][1]);
    expect(onRecord.mock.calls[0][0]).toMatchObject({ kind: 'check-in', method: 'platform-presence' });
    expect(await screen.findByText('Attendance recorded.')).toBeInTheDocument();
  });

  it('hides recording controls from coordinators', () => {
    render(<AttendancePanel viewer={{ userId: 'coord', isCoordinator: true }} session={S} attendance={rows} labels={labels} />);
    expect(screen.queryByRole('button', { name: 'Check in' })).not.toBeInTheDocument();
  });

  it('requests a correction by keyboard with a reason', async () => {
    const onRequestCorrection = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AttendancePanel viewer={mentee} session={S} attendance={rows} labels={labels} onRequestCorrection={onRequestCorrection} />);
    const open = screen.getByRole('button', { name: /request correction for mentee max/i });
    open.focus();
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: /send correction request/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/1 to 500/);
    expect(onRequestCorrection).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(/reason for correction/i), 'Dropped call');
    await user.selectOptions(screen.getByLabelText(/correct outcome/i), 'partial');
    await user.click(screen.getByRole('button', { name: /send correction request/i }));
    await waitFor(() => expect(onRequestCorrection).toHaveBeenCalledTimes(1));
    expect(onRequestCorrection.mock.calls[0][0]).toEqual({ participantId: FIXTURE_MENTEE, reason: 'Dropped call', proposedStatus: 'partial' });
    expect(await screen.findByText('Correction requested.')).toBeInTheDocument();
  });

  it('lets only the other participant decide a correction', async () => {
    const correction = createCorrectionRequest(mentee, S, { id: 'c1', participantId: FIXTURE_MENTEE, reason: 'Dropped call', proposedStatus: 'attended' }, new Date('2026-03-03T00:00:00Z'));
    const onDecide = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const { rerender } = render(<AttendancePanel viewer={mentee} session={S} attendance={rows} corrections={[correction]} labels={labels} onDecideCorrection={onDecide} />);
    expect(screen.getByText(/cannot approve your own request/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();

    rerender(<AttendancePanel viewer={{ userId: FIXTURE_MENTOR }} session={S} attendance={rows} corrections={[correction]} labels={labels} onDecideCorrection={onDecide} />);
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(onDecide).toHaveBeenCalledWith(correction, 'approved'));
    expect(await screen.findByText('Correction approved.')).toBeInTheDocument();
  });
});
