import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MentorshipCapabilityConfigPanel } from '../MentorshipCapabilityConfigPanel';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { apiClient } from '@/src/lib/api-client';

const mockGet = vi.mocked(apiClient.get);
const mockPut = vi.mocked(apiClient.put);

const REMOTE = {
  featureFlags: { discovery: true, sessions: true },
  limits: { maxSessionsPerEngagement: 24 },
  supportedCurrencies: ['USD', 'EUR'],
  defaultCurrency: 'USD',
};

describe('MentorshipCapabilityConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('announces loading first', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<MentorshipCapabilityConfigPanel />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading mentorship capability/i);
  });

  it('renders the resolved configuration with flags and a currency list', async () => {
    mockGet.mockResolvedValue(REMOTE);
    render(<MentorshipCapabilityConfigPanel environment="staging" />);

    const flag = await screen.findByRole('checkbox', { name: 'sessions' });
    expect(flag).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'payments' })).not.toBeChecked();
    expect(screen.getByText(/USD \(default\)/)).toBeInTheDocument();
    expect(screen.getByText(/Live capabilities: discovery, sessions/i)).toBeInTheDocument();
  });

  it('falls back to safe defaults when the remote document cannot be fetched', async () => {
    mockGet.mockRejectedValue(new Error('offline'));
    render(<MentorshipCapabilityConfigPanel />);

    expect(await screen.findByRole('note')).toHaveTextContent(/safe defaults are active/i);
    expect(screen.getByRole('checkbox', { name: 'discovery' })).not.toBeChecked();
  });

  it('reports a permission-denied state and disables writes', async () => {
    mockGet.mockResolvedValue(REMOTE);
    render(<MentorshipCapabilityConfigPanel canManage={false} />);

    expect(await screen.findByText(/do not have permission to change this configuration/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save configuration/i })).toBeDisabled();
  });

  it('flags an invalid limit and links the message to the field', async () => {
    mockGet.mockResolvedValue(REMOTE);
    const user = userEvent.setup();
    render(<MentorshipCapabilityConfigPanel />);

    const input = await screen.findByLabelText(/max sessions per engagement/i);
    await user.clear(input);
    await user.type(input, '0');

    const message = await screen.findByRole('alert');
    expect(message).toHaveTextContent(/must be a positive number/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: /save configuration/i })).toBeDisabled();
  });

  it('saves a valid configuration', async () => {
    mockGet.mockResolvedValue(REMOTE);
    mockPut.mockResolvedValue({ ...REMOTE, version: 4 } as never);
    const user = userEvent.setup();
    render(<MentorshipCapabilityConfigPanel />);

    await screen.findByRole('checkbox', { name: 'sessions' });
    await user.click(screen.getByRole('button', { name: /save configuration/i }));

    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/saved the staging capability configuration/i)).toBeInTheDocument();
  });
});
