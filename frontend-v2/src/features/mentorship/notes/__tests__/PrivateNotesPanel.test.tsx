import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PrivateNotesPanel } from '../components/PrivateNotesPanel';
import { FIXTURE_MENTOR_ID, PRIVATE_NOTE_FIXTURES } from '../private-notes.fixtures';

const viewer = { userId: FIXTURE_MENTOR_ID };

describe('PrivateNotesPanel', () => {
  it('shows only the viewer’s notes with a privacy statement', () => {
    render(<PrivateNotesPanel viewer={viewer} notes={PRIVATE_NOTE_FIXTURES} />);
    expect(screen.getByText(/only you can see these notes/i)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByText(/portfolio feedback/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/deleted draft/i)).not.toBeInTheDocument();
  });

  it('shows loading, empty and denied states', () => {
    const { rerender } = render(<PrivateNotesPanel viewer={viewer} notes={[]} loading />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    rerender(<PrivateNotesPanel viewer={viewer} notes={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent(/no private notes yet/i);
    rerender(<PrivateNotesPanel viewer={{ userId: null }} notes={PRIVATE_NOTE_FIXTURES} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/sign in/i);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('creates a note with an idempotency key and announces success', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<PrivateNotesPanel viewer={viewer} notes={[]} onCreate={onCreate} />);
    await user.type(screen.getByLabelText(/new note/i), '  Follow up  ');
    await user.click(screen.getByRole('button', { name: /save note/i }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith('Follow up', expect.any(String));
    expect(await screen.findByText('Note saved.')).toBeInTheDocument();
  });

  it('reuses the idempotency key when a save fails and is retried', async () => {
    const onCreate = vi
      .fn()
      .mockRejectedValueOnce({ status: 500 })
      .mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<PrivateNotesPanel viewer={viewer} notes={[]} onCreate={onCreate} />);
    await user.type(screen.getByLabelText(/new note/i), 'Retry me');
    await user.click(screen.getByRole('button', { name: /save note/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save note/i }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(2));
    expect(onCreate.mock.calls[0][1]).toBe(onCreate.mock.calls[1][1]);
  });

  it('rejects empty notes without calling the API', async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();
    render(<PrivateNotesPanel viewer={viewer} notes={[]} onCreate={onCreate} />);
    await user.click(screen.getByRole('button', { name: /save note/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/between 1 and/i);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('edits a note by keyboard', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<PrivateNotesPanel viewer={viewer} notes={PRIVATE_NOTE_FIXTURES} onUpdate={onUpdate} />);
    await user.tab(); // new note textarea
    const edit = screen.getByRole('button', { name: /edit note: revisit escrow/i });
    edit.focus();
    await user.keyboard('{Enter}');
    const field = screen.getByRole('textbox', { name: /^edit note$/i });
    await user.clear(field);
    await user.type(field, 'Updated');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(PRIVATE_NOTE_FIXTURES[0], 'Updated'));
  });

  it('requires confirmation before deleting and surfaces policy errors', async () => {
    const onDelete = vi.fn().mockRejectedValue({ status: 409 });
    const user = userEvent.setup();
    render(<PrivateNotesPanel viewer={viewer} notes={PRIVATE_NOTE_FIXTURES} onDelete={onDelete} />);
    await user.click(screen.getByRole('button', { name: /delete note: revisit escrow/i }));
    expect(onDelete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /confirm delete/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/changed elsewhere/i);
    await user.click(screen.getByRole('button', { name: /keep note/i }));
    expect(screen.queryByRole('button', { name: /confirm delete/i })).not.toBeInTheDocument();
  });

  it('filters by search and explains short queries', async () => {
    const user = userEvent.setup();
    render(<PrivateNotesPanel viewer={viewer} notes={PRIVATE_NOTE_FIXTURES} />);
    const search = screen.getByLabelText(/search my notes/i);
    await user.type(search, 'x');
    expect(screen.getByText(/at least 2 characters/i)).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, 'soroban');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    await user.clear(search);
    await user.type(search, 'zzz');
    expect(screen.getByRole('status')).toHaveTextContent(/no notes match/i);
  });
});
