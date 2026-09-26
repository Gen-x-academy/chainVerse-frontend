import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScholarshipAbuseControlsPanel } from '../ScholarshipAbuseControlsPanel';
import type { RateLimitPolicy } from '../../types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { apiClient } from '@/src/lib/api-client';

const NOW = new Date('2025-03-01T00:00:00.000Z');

const POLICIES: RateLimitPolicy[] = [
  { surface: 'application-submit', riskTier: 'standard', limit: 2, windowSeconds: 60, burstAllowance: 1 },
  { surface: 'application-submit', riskTier: 'high', limit: 1, windowSeconds: 60, burstAllowance: 0 },
  { surface: 'messaging', riskTier: 'standard', limit: 4, windowSeconds: 60, burstAllowance: 2 },
];

const mockGet = vi.mocked(apiClient.get);

describe('ScholarshipAbuseControlsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('announces loading first', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<ScholarshipAbuseControlsPanel now={NOW} />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading rate limit policies/i);
  });

  it('renders an error state that denies requests rather than assuming no limit', async () => {
    mockGet.mockRejectedValue(new Error('abuse service unreachable'));
    render(<ScholarshipAbuseControlsPanel now={NOW} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not be loaded/i);
    expect(alert).toHaveTextContent(/abuse service unreachable/);
    expect(alert).toHaveTextContent(/never assumes a limit is unlimited/i);
  });

  it('renders an empty state when no policies are published', async () => {
    mockGet.mockResolvedValue([]);
    render(<ScholarshipAbuseControlsPanel now={NOW} />);

    expect(await screen.findByText(/no rate limit policies are configured/i)).toBeInTheDocument();
  });

  it('renders an empty state when a surface and tier have no policy', async () => {
    mockGet.mockResolvedValue([POLICIES[0]]);
    const user = userEvent.setup();
    render(<ScholarshipAbuseControlsPanel now={NOW} />);

    await screen.findByLabelText(/surface/i);
    await user.selectOptions(screen.getByLabelText(/surface/i), 'payout-action');

    expect(await screen.findByText(/no policy for this surface and tier/i)).toBeInTheDocument();
  });

  it('exposes a labelled surface, tier, and an accessible limit meter', async () => {
    mockGet.mockResolvedValue(POLICIES);
    render(<ScholarshipAbuseControlsPanel now={NOW} />);

    expect(await screen.findByLabelText(/surface/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/risk tier/i)).toBeInTheDocument();

    const meter = await screen.findByRole('progressbar');
    expect(meter).toHaveAttribute('aria-valuenow', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '2');
    expect(meter).toHaveAttribute('aria-valuetext', expect.stringContaining('of 2 requests used'));
  });

  it('denies a request past the limit and states the retry guidance', async () => {
    mockGet.mockResolvedValue(POLICIES);
    const user = userEvent.setup();
    render(<ScholarshipAbuseControlsPanel now={NOW} />);

    await screen.findByRole('progressbar');
    await user.click(screen.getByRole('button', { name: /simulate request/i }));
    await user.click(screen.getByRole('button', { name: /simulate request/i }));
    await user.click(screen.getByRole('button', { name: /simulate request/i }));

    await waitFor(() => expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3'));
    expect(screen.getByText(/^Denied$/)).toBeInTheDocument();
    expect(
      screen.getByText(/retry after 60 second\(s\) \(Retry-After: 60\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/saved draft is unchanged/i)).toBeInTheDocument();
  });

  it('keeps the bypass denied without a service authorization', async () => {
    mockGet.mockResolvedValue(POLICIES);
    const user = userEvent.setup();
    render(<ScholarshipAbuseControlsPanel now={NOW} />);

    await screen.findByRole('progressbar');
    await user.click(screen.getByRole('button', { name: /simulate request/i }));
    await user.click(screen.getByRole('button', { name: /simulate request/i }));
    await user.click(screen.getByRole('button', { name: /simulate request/i }));
    await user.click(screen.getByRole('button', { name: /request bypass/i }));

    const message = await screen.findByRole('alert');
    expect(message).toHaveTextContent(/never granted without one/i);
    const input = screen.getByLabelText(/service authorization id/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', message.id);
    expect(screen.getByText(/bypass denied\. a rate limit can only be lifted/i)).toBeInTheDocument();
  });

  it('grants the bypass once a service authorization id is supplied', async () => {
    mockGet.mockResolvedValue(POLICIES);
    const user = userEvent.setup();
    render(<ScholarshipAbuseControlsPanel now={NOW} />);

    await screen.findByRole('progressbar');
    await user.click(screen.getByRole('button', { name: /simulate request/i }));
    await user.click(screen.getByRole('button', { name: /simulate request/i }));
    await user.click(screen.getByRole('button', { name: /simulate request/i }));
    await user.type(screen.getByLabelText(/service authorization id/i), 'svc-auth-42');
    await user.click(screen.getByRole('button', { name: /request bypass/i }));

    expect(await screen.findByText(/bypass granted under svc-auth-42/i)).toBeInTheDocument();
  });

  it('reports a permission-denied state and disables the bypass request', async () => {
    mockGet.mockResolvedValue(POLICIES);
    render(<ScholarshipAbuseControlsPanel canManage={false} now={NOW} />);

    expect(await screen.findByRole('note')).toHaveTextContent(/do not have permission to request a bypass/i);
    expect(screen.getByRole('button', { name: /request bypass/i })).toBeDisabled();
  });

  it('keeps the draft intact and explains how to recover a local edit', async () => {
    mockGet.mockResolvedValue(POLICIES);
    const user = userEvent.setup();
    render(<ScholarshipAbuseControlsPanel now={NOW} />);

    expect(await screen.findByText(/draft intact/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/unsaved local note/i), 'half typed');
    expect(await screen.findByText(/local edits pending/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /discard local edits/i }));
    await waitFor(() => expect(screen.getByText(/draft intact/i)).toBeInTheDocument());
  });
});
