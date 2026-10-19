import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SessionWorkspace } from '../components/SessionWorkspace';
import {
  FIXTURE_MENTEE,
  FIXTURE_MENTOR,
  FIXTURE_OUTSIDER,
  FIXTURE_STAFF,
  FIXTURE_WORKSPACE as W,
  NOW,
} from '../workspace.fixtures';

const labels = { [FIXTURE_MENTOR]: 'Mentor Mia', [FIXTURE_MENTEE]: 'Mentee Max' };
const base = { viewer: { userId: FIXTURE_MENTOR }, workspace: W, labels, now: NOW };

describe('SessionWorkspace', () => {
  it('shows every section with navigation for a participant', () => {
    render(<SessionWorkspace {...base} />);
    const nav = screen.getByRole('navigation', { name: /workspace sections/i });
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Overview', 'Agenda', 'Shared goals', 'Resources', 'Attendance', 'Follow-up actions', 'My private notes',
    ]);
    expect(screen.getByText('Escrow basics')).toBeInTheDocument();
    expect(screen.getByText(/Ship a first Soroban contract/)).toBeInTheDocument();
    expect(screen.getByText(/Mentee Max: Not started/)).toBeInTheDocument();
    expect(screen.getByText(/Owner: Mentee Max · Added by Mentor Mia/)).toBeInTheDocument();
  });

  it('keeps private notes separate and renders only the supplied slot', () => {
    render(<SessionWorkspace {...base} privateNotesSlot={<p>slot content</p>} />);
    expect(screen.getByText(/kept separate from this workspace/i)).toBeInTheDocument();
    expect(screen.getByText('slot content')).toBeInTheDocument();
  });

  it('shows staff a read-only view without private notes', () => {
    render(<SessionWorkspace {...base} viewer={{ userId: FIXTURE_STAFF }} privateNotesSlot={<p>slot content</p>} />);
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent(/read-only access/i);
    expect(screen.queryByText('slot content')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /private notes/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/add a follow-up action/i)).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.queryByText('Private reading list')).not.toBeInTheDocument();
    expect(screen.getByText('Soroban docs')).toBeInTheDocument();
  });

  it('denies outsiders without rendering any content', () => {
    render(<SessionWorkspace {...base} viewer={{ userId: FIXTURE_OUTSIDER }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/do not have access/i);
    expect(screen.queryByText('Escrow basics')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('shows loading and empty states', () => {
    const { rerender } = render(<SessionWorkspace {...base} loading />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    const empty = { ...W, agenda: [], goals: [], resources: [], attendance: [], followUps: [] };
    rerender(<SessionWorkspace {...base} workspace={empty} />);
    expect(screen.getByText(/no agenda items yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no shared goals yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no resources have been shared/i)).toBeInTheDocument();
    expect(screen.getByText(/attendance will appear/i)).toBeInTheDocument();
    expect(screen.getByText(/no follow-up actions yet/i)).toBeInTheDocument();
  });

  it('makes cancelled sessions read-only', () => {
    render(<SessionWorkspace {...base} workspace={{ ...W, status: 'cancelled' }} />);
    expect(screen.getByText(/session was cancelled/i)).toBeInTheDocument();
    expect(screen.getByText('Escrow basics')).toBeInTheDocument();
    expect(screen.queryByLabelText(/add a follow-up action/i)).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('withholds contents past retention', () => {
    render(<SessionWorkspace {...base} now={new Date('2027-06-01T00:00:00Z')} />);
    expect(screen.getByText(/past its retention period/i)).toBeInTheDocument();
    expect(screen.queryByText('Escrow basics')).not.toBeInTheDocument();
    expect(screen.queryByText(/private notes/i)).not.toBeInTheDocument();
  });

  it('renders only https links, safely', () => {
    render(<SessionWorkspace {...base} />);
    const link = screen.getByRole('link', { name: /soroban docs/i });
    expect(link).toHaveAttribute('href', 'https://developers.stellar.org');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('Unsafe link').closest('a')).toBeNull();
  });

  it('adds a follow-up, reusing the command id on retry', async () => {
    const onCommand = vi.fn().mockRejectedValueOnce({ status: 500 }).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<SessionWorkspace {...base} onCommand={onCommand} />);
    await user.type(screen.getByLabelText(/add a follow-up action/i), 'Book next session');
    await user.click(screen.getByRole('button', { name: /add follow-up/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /add follow-up/i }));
    await waitFor(() => expect(onCommand).toHaveBeenCalledTimes(2));
    expect(onCommand.mock.calls[0][0].commandId).toBe(onCommand.mock.calls[1][0].commandId);
    expect(onCommand.mock.calls[1][0]).toMatchObject({ baseVersion: 3, command: { type: 'add-follow-up', title: 'Book next session', ownerId: FIXTURE_MENTOR } });
    expect(await screen.findByText('Follow-up added.')).toBeInTheDocument();
  });

  it('toggles a follow-up with the keyboard', async () => {
    const onCommand = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SessionWorkspace {...base} onCommand={onCommand} />);
    screen.getByRole('checkbox', { name: /share draft contract/i }).focus();
    await user.keyboard(' ');
    await waitFor(() => expect(onCommand).toHaveBeenCalledTimes(1));
    expect(onCommand.mock.calls[0][0].command).toEqual({ type: 'set-follow-up-done', followUpId: 'fu_1', done: true });
  });

  it('offers a reload on conflict', async () => {
    const onCommand = vi.fn().mockRejectedValue({ status: 409 });
    const onReload = vi.fn();
    const user = userEvent.setup();
    render(<SessionWorkspace {...base} onCommand={onCommand} onReload={onReload} />);
    await user.type(screen.getByLabelText(/add a follow-up action/i), 'Clash');
    await user.click(screen.getByRole('button', { name: /add follow-up/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/someone else changed/i);
    await user.click(screen.getByRole('button', { name: /reload workspace/i }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});
