import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ExternalCalendarPanel } from '../components/ExternalCalendarPanel';
import type { CalendarConnection } from '../external-calendar';

const CONNECTION: CalendarConnection = {
  id: 'connection-1',
  mentorId: 'mentor-1',
  tenantId: 'tenant-a',
  provider: 'google',
  tokenRef: 'vault:encrypted-ref',
  tokenKeyVersion: 'k1',
  scopes: ['calendar.freebusy'],
  status: 'connected',
  connectedAt: '2026-05-01T09:00:00.000Z',
  lastSyncedAt: '2026-05-01T10:00:00.000Z',
};

describe('ExternalCalendarPanel', () => {
  it('shows the privacy boundary and empty state', () => {
    render(<ExternalCalendarPanel connections={[]} />);

    expect(screen.getByRole('heading', { name: /external calendar/i })).toBeInTheDocument();
    expect(screen.getByText(/only free\/busy windows are imported/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/no calendar connections yet/i);
    expect(screen.getByText(/busy windows retained:/i)).toHaveTextContent('0');
  });

  it('connects the selected provider', async () => {
    const onConnect = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ExternalCalendarPanel connections={[]} onConnect={onConnect} />);

    await user.selectOptions(screen.getByLabelText(/calendar provider/i), 'microsoft');
    await user.click(screen.getByRole('button', { name: /connect calendar/i }));

    await waitFor(() => expect(onConnect).toHaveBeenCalledWith('microsoft'));
  });

  it('syncs and disconnects an active connection', async () => {
    const onSync = vi.fn().mockResolvedValue(undefined);
    const onDisconnect = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <ExternalCalendarPanel
        connections={[CONNECTION]}
        busyWindowCount={3}
        onSync={onSync}
        onDisconnect={onDisconnect}
      />,
    );

    expect(screen.getByText(/busy windows retained:/i)).toHaveTextContent('3');
    await user.click(screen.getByRole('button', { name: /sync busy times/i }));
    await waitFor(() => expect(onSync).toHaveBeenCalledWith('connection-1'));

    await user.click(screen.getByRole('button', { name: /disconnect/i }));
    await waitFor(() => expect(onDisconnect).toHaveBeenCalledWith('connection-1'));
  });

  it('disables actions for a revoked connection', () => {
    render(
      <ExternalCalendarPanel
        connections={[{ ...CONNECTION, status: 'revoked' }]}
      />,
    );

    expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sync busy times/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeDisabled();
  });

  it('denies management when the role lacks permission', () => {
    render(<ExternalCalendarPanel connections={[]} canManage={false} />);

    expect(screen.getByLabelText(/calendar provider/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /connect calendar/i })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/role cannot manage/i);
  });

  it('renders stable error and success feedback', () => {
    render(
      <ExternalCalendarPanel
        connections={[CONNECTION]}
        error="The calendar provider is unavailable."
        successMessage="Calendar synced."
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/provider is unavailable/i);
    expect(screen.getByRole('status')).toHaveTextContent(/calendar synced/i);
  });

  it('reports an action failure without leaving the panel disabled', async () => {
    const onSync = vi.fn().mockRejectedValue(new Error('Provider unavailable. Retry later.'));
    const user = userEvent.setup();
    render(<ExternalCalendarPanel connections={[CONNECTION]} onSync={onSync} />);

    await user.click(screen.getByRole('button', { name: /sync busy times/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/provider unavailable/i);
    expect(screen.getByRole('button', { name: /sync busy times/i })).toBeEnabled();
  });

  it('supports keyboard connection', async () => {
    const onConnect = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ExternalCalendarPanel connections={[]} onConnect={onConnect} />);

    screen.getByRole('button', { name: /connect calendar/i }).focus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(onConnect).toHaveBeenCalledWith('google'));
  });
});
