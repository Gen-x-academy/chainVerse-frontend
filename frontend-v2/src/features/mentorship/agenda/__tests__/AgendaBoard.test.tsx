import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AgendaBoard } from '../components/AgendaBoard';
import { applyAgendaCommand, type Agenda } from '../agenda';
import {
  AFTER_CUTOFF,
  BEFORE_CUTOFF,
  FIXTURE_AGENDA,
  FIXTURE_MENTEE,
  FIXTURE_MENTOR,
  FIXTURE_OUTSIDER,
  envelope,
} from '../agenda.fixtures';

const labels = { [FIXTURE_MENTOR]: 'Mentor Mia', [FIXTURE_MENTEE]: 'Mentee Max' };
const mentor = { userId: FIXTURE_MENTOR };

function seeded(): Agenda {
  let a = applyAgendaCommand(FIXTURE_AGENDA, mentor, envelope('a', 0, { type: 'propose', title: 'Escrow basics' }), BEFORE_CUTOFF);
  a = applyAgendaCommand(a, { userId: FIXTURE_MENTEE }, envelope('b', 1, { type: 'propose', title: 'Portfolio review' }), BEFORE_CUTOFF);
  return a;
}

const base = { viewer: mentor, labels, now: BEFORE_CUTOFF };

describe('AgendaBoard', () => {
  it('shows ordered items with visible authorship and history', () => {
    render(<AgendaBoard {...base} agenda={seeded()} />);
    const items = screen.getAllByRole('listitem', { name: undefined });
    expect(screen.getByRole('list', { name: /agenda items/i })).toBeInTheDocument();
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/1\. Escrow basics/)).toBeInTheDocument();
    expect(screen.getByText(/Proposed by Mentee Max/)).toBeInTheDocument();
    expect(screen.getByText(/Revision history \(2\)/)).toBeInTheDocument();
  });

  it('denies outsiders and shows loading and empty states', () => {
    const { rerender } = render(<AgendaBoard {...base} viewer={{ userId: FIXTURE_OUTSIDER }} agenda={seeded()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/do not have permission/i);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    rerender(<AgendaBoard {...base} agenda={FIXTURE_AGENDA} loading />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    rerender(<AgendaBoard {...base} agenda={FIXTURE_AGENDA} />);
    expect(screen.getByText(/no agenda items yet/i)).toBeInTheDocument();
  });

  it('proposes an item with a command id and base version, then clears the form', async () => {
    const onCommand = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AgendaBoard {...base} agenda={seeded()} onCommand={onCommand} />);
    await user.type(screen.getByLabelText(/propose an agenda item/i), 'Career goals');
    await user.click(screen.getByRole('button', { name: /propose item/i }));
    await waitFor(() => expect(onCommand).toHaveBeenCalledTimes(1));
    expect(onCommand.mock.calls[0][0]).toMatchObject({ baseVersion: 2, command: { type: 'propose', title: 'Career goals' } });
    expect(await screen.findByText('Agenda item proposed.')).toBeInTheDocument();
    expect(screen.getByLabelText(/propose an agenda item/i)).toHaveValue('');
  });

  it('reuses the command id when a failed action is retried', async () => {
    const onCommand = vi.fn().mockRejectedValueOnce({ status: 500 }).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<AgendaBoard {...base} agenda={seeded()} onCommand={onCommand} />);
    await user.type(screen.getByLabelText(/propose an agenda item/i), 'Retry me');
    await user.click(screen.getByRole('button', { name: /propose item/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /propose item/i }));
    await waitFor(() => expect(onCommand).toHaveBeenCalledTimes(2));
    expect(onCommand.mock.calls[0][0].commandId).toBe(onCommand.mock.calls[1][0].commandId);
  });

  it('shows a conflict with a reload action', async () => {
    const onCommand = vi.fn().mockRejectedValue({ status: 409 });
    const onReload = vi.fn();
    const user = userEvent.setup();
    render(<AgendaBoard {...base} agenda={seeded()} onCommand={onCommand} onReload={onReload} />);
    await user.type(screen.getByLabelText(/propose an agenda item/i), 'Clash');
    await user.click(screen.getByRole('button', { name: /propose item/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/someone else changed the agenda/i);
    await user.click(screen.getByRole('button', { name: /reload agenda/i }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('reorders by keyboard with up/down buttons', async () => {
    const onCommand = vi.fn().mockResolvedValue(undefined);
    const a = seeded();
    const user = userEvent.setup();
    render(<AgendaBoard {...base} agenda={a} onCommand={onCommand} />);
    expect(screen.getByRole('button', { name: /move item 1: escrow basics up/i })).toBeDisabled();
    const down = screen.getByRole('button', { name: /move item 1: escrow basics down/i });
    down.focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(onCommand).toHaveBeenCalledTimes(1));
    expect(onCommand.mock.calls[0][0].command).toEqual({ type: 'reorder', itemId: a.items[0].id, toIndex: 1 });
  });

  it('assigns an item', async () => {
    const onCommand = vi.fn().mockResolvedValue(undefined);
    const a = seeded();
    const user = userEvent.setup();
    render(<AgendaBoard {...base} agenda={a} onCommand={onCommand} />);
    await user.selectOptions(screen.getByLabelText(/assignee for item 1/i), FIXTURE_MENTEE);
    await waitFor(() => expect(onCommand).toHaveBeenCalled());
    expect(onCommand.mock.calls[0][0].command).toEqual({ type: 'assign', itemId: a.items[0].id, assigneeId: FIXTURE_MENTEE });
  });

  it('resolves with an outcome and keeps resolved items listed', async () => {
    const onCommand = vi.fn().mockResolvedValue(undefined);
    const a = seeded();
    const user = userEvent.setup();
    render(<AgendaBoard {...base} agenda={a} onCommand={onCommand} />);
    await user.click(screen.getByRole('button', { name: /resolve item 1/i }));
    await user.selectOptions(screen.getByLabelText(/outcome/i), 'deferred');
    await user.click(screen.getByRole('button', { name: /confirm resolve/i }));
    await waitFor(() => expect(onCommand).toHaveBeenCalled());
    expect(onCommand.mock.calls[0][0].command).toEqual({ type: 'resolve', itemId: a.items[0].id, outcome: 'deferred' });

    const resolved = applyAgendaCommand(a, mentor, envelope('r', 2, { type: 'resolve', itemId: a.items[0].id, outcome: 'deferred' }), BEFORE_CUTOFF);
    render(<AgendaBoard {...base} agenda={resolved} />);
    expect(screen.getByText('Resolved: Deferred')).toBeInTheDocument();
    expect(screen.getByText(/Resolved by Mentor Mia/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reopen item 1/i })).toBeInTheDocument();
  });

  it('locks structural controls after the cutoff but keeps resolve', () => {
    render(<AgendaBoard {...base} now={AFTER_CUTOFF} agenda={seeded()} />);
    expect(screen.getByRole('status')).toHaveTextContent(/locked/i);
    expect(screen.queryByLabelText(/propose an agenda item/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /move item/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /withdraw/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /resolve item/i }).length).toBe(2);
  });

  it('offers withdraw only on your own items and hides controls from coordinators', () => {
    const { rerender } = render(<AgendaBoard {...base} agenda={seeded()} />);
    expect(screen.getByRole('button', { name: /withdraw item 1/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /withdraw item 2/i })).not.toBeInTheDocument();
    rerender(<AgendaBoard {...base} viewer={{ userId: 'coord', isCoordinator: true }} agenda={seeded()} />);
    expect(screen.queryByRole('button', { name: /resolve/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/propose an agenda item/i)).not.toBeInTheDocument();
  });
});
