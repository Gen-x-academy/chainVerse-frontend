import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScholarshipFeatureFlagsPanel } from '../ScholarshipFeatureFlagsPanel';
import type { FlagDefinition } from '../../types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { apiClient } from '@/src/lib/api-client';

const FLAGS: FlagDefinition[] = [
  {
    key: 'applications',
    description: 'Student application flow.',
    defaultEnabled: true,
    environments: { development: true, staging: true, production: false },
    cohort: { kind: 'percentage', percent: 25 },
    owner: 'platform-frontend',
    updatedAt: '2025-02-01T00:00:00.000Z',
    version: 3,
  },
];

const mockGet = vi.mocked(apiClient.get);

describe('ScholarshipFeatureFlagsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('announces loading, then renders the flag rows', async () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<ScholarshipFeatureFlagsPanel />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading feature flag definitions/i);
  });

  it('renders an error state with a retry step', async () => {
    mockGet.mockRejectedValue(new Error('flag service unavailable'));
    render(<ScholarshipFeatureFlagsPanel />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not be loaded/i);
    expect(alert).toHaveTextContent(/flag service unavailable/);
    expect(alert).toHaveTextContent(/stays disabled/i);
    expect(screen.getByRole('button', { name: /retry loading flags/i })).toBeEnabled();
  });

  it('renders an empty state when no flags are defined', async () => {
    mockGet.mockResolvedValue([]);
    render(<ScholarshipFeatureFlagsPanel />);

    expect(await screen.findByText(/no feature flags are defined yet/i)).toBeInTheDocument();
  });

  it('renders the environment matrix, cohort, and a labelled user-id input', async () => {
    mockGet.mockResolvedValue(FLAGS);
    render(<ScholarshipFeatureFlagsPanel />);

    await screen.findByText('applications');
    expect(screen.getByRole('checkbox', { name: 'production' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'staging' })).toBeChecked();
    expect(screen.getByLabelText(/percentage of cohort/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/evaluate for user id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/resolve environment/i)).toBeInTheDocument();
    expect(screen.getByText(/fail-closed policy/i)).toBeInTheDocument();
  });

  it('reports a permission-denied state and disables writes', async () => {
    mockGet.mockResolvedValue(FLAGS);
    render(<ScholarshipFeatureFlagsPanel canManage={false} />);

    expect(await screen.findByRole('note')).toHaveTextContent(/do not have permission/i);
    expect(screen.getByRole('button', { name: /save applications rollout/i })).toBeDisabled();
    expect(screen.getByText(/environment toggles are read-only for your role/i)).toBeInTheDocument();
  });

  it('marks an out-of-range percentage invalid and links the message', async () => {
    mockGet.mockResolvedValue(FLAGS);
    const user = userEvent.setup();
    render(<ScholarshipFeatureFlagsPanel />);

    const input = await screen.findByLabelText(/percentage of cohort/i);
    await user.clear(input);
    await user.type(input, '150');

    const message = await screen.findByRole('alert');
    expect(message).toHaveTextContent(/between 0 and 100/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', message.id);
  });

  it('resolves a flag for the chosen environment and user', async () => {
    mockGet.mockResolvedValue(FLAGS);
    const user = userEvent.setup();
    render(<ScholarshipFeatureFlagsPanel />);

    await screen.findByText('applications');
    await user.selectOptions(screen.getByLabelText(/resolve environment/i), 'development');
    await waitFor(() =>
      expect(screen.getByText('Enabled in development')).toBeInTheDocument()
    );

    await user.selectOptions(screen.getByLabelText(/resolve environment/i), 'production');
    await waitFor(() =>
      expect(screen.getByText('Disabled in production')).toBeInTheDocument()
    );
  });

  it('records an exposure in a live region', async () => {
    mockGet.mockResolvedValue(FLAGS);
    const user = userEvent.setup();
    render(<ScholarshipFeatureFlagsPanel />);

    await screen.findByText('applications');
    await user.click(screen.getByRole('button', { name: /record exposure for applications/i }));
    expect(
      await screen.findByText(/recorded exposure for applications/i)
    ).toBeInTheDocument();
  });
});
