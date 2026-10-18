import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MutualSlotFinder } from '../components/MutualSlotFinder';
import type { SessionSlotCandidate } from '../slot-finder';

const SLOTS: SessionSlotCandidate[] = [
  {
    startsAt: '2026-01-05T10:00:00.000Z',
    endsAt: '2026-01-05T10:30:00.000Z',
    availableCapacity: 1,
  },
  {
    startsAt: '2026-01-05T10:30:00.000Z',
    endsAt: '2026-01-05T11:00:00.000Z',
    availableCapacity: 2,
  },
];

describe('MutualSlotFinder', () => {
  it('renders candidates with deterministic times and capacity', () => {
    render(<MutualSlotFinder slots={SLOTS} timeZone="UTC" />);

    expect(screen.getByRole('heading', { name: /mutually available session slots/i })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /available session slots/i })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText(/1 place available/i)).toBeInTheDocument();
    expect(screen.getByText(/2 places available/i)).toBeInTheDocument();
  });

  it('runs a search and announces an empty result', async () => {
    const onSearch = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<MutualSlotFinder slots={[]} onSearch={onSearch} />);

    expect(screen.getByRole('status')).toHaveTextContent(/no mutual slots found/i);
    await user.click(screen.getByRole('button', { name: /find available slots/i }));
    await waitFor(() => expect(onSearch).toHaveBeenCalledTimes(1));
  });

  it('selects a slot with the mouse', async () => {
    const onSelect = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<MutualSlotFinder slots={SLOTS} onSelect={onSelect} />);

    await user.click(screen.getAllByRole('button', { name: /select slot/i })[0]);

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(SLOTS[0]));
  });

  it('selects a slot from the keyboard', async () => {
    const onSelect = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<MutualSlotFinder slots={SLOTS} onSelect={onSelect} />);

    screen.getAllByRole('button', { name: /select slot/i })[1].focus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(SLOTS[1]));
  });

  it('loads the next page when a cursor is present', async () => {
    const onLoadMore = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <MutualSlotFinder slots={SLOTS} nextCursor="cursor-2" onLoadMore={onLoadMore} />,
    );

    await user.click(screen.getByRole('button', { name: /load more slots/i }));
    await waitFor(() => expect(onLoadMore).toHaveBeenCalledTimes(1));
  });

  it('shows loading, error and denied states', () => {
    const { rerender } = render(<MutualSlotFinder slots={[]} loading />);
    expect(screen.getByRole('status')).toHaveTextContent(/finding available slots/i);

    rerender(
      <MutualSlotFinder slots={[]} error="The slot search is temporarily unavailable." />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/temporarily unavailable/i);

    rerender(<MutualSlotFinder slots={[]} canSearch={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/only participants/i);
    expect(screen.getByRole('button', { name: /find available slots/i })).toBeDisabled();
  });

  it('reports a failed search without leaving the control disabled', async () => {
    const onSearch = vi.fn().mockRejectedValue(new Error('Search failed. Retry.'));
    const user = userEvent.setup();
    render(<MutualSlotFinder slots={[]} onSearch={onSearch} />);

    await user.click(screen.getByRole('button', { name: /find available slots/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/search failed/i);
    expect(screen.getByRole('button', { name: /find available slots/i })).toBeEnabled();
  });
});
