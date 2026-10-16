/**
 * Invitation tokens must never reach the query cache (issue #1227).
 *
 * `sponsorTeamQueryKeys.validateToken(token)` used to place the raw bearer
 * token in the key, which parked a live credential in the cache and in React
 * Query Devtools — readable by anything with devtools open, and sufficient on
 * its own to accept the invitation as the invitee.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useValidateInvitationToken, useAcceptSponsorInvitation } from '../hooks';
import { useAuthStore } from '@/src/store/authStore';
import { scholarshipQueryKeys } from '../../lib/queryKeys';

vi.mock('../service', () => ({
  sponsorTeamService: {
    validateInvitationToken: vi.fn(),
    acceptInvitation: vi.fn(),
  },
  sponsorOrgService: {},
}));

import { sponsorTeamService } from '../service';

const TOKEN = 'inv_live_9f8a7b6c5d4e3f2a1b0c_secret';

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, isAuthenticated: false });
  vi.mocked(sponsorTeamService.validateInvitationToken).mockResolvedValue({
    valid: true,
    sponsorId: 'sponsor-1',
  } as never);
});

describe('useValidateInvitationToken', () => {
  it('never puts the token in the query key', async () => {
    const client = new QueryClient();
    renderHook(() => useValidateInvitationToken(TOKEN), {
      wrapper: ({ children }) =>
        React.createElement(QueryClientProvider, { client }, children),
    });

    await waitFor(() => expect(sponsorTeamService.validateInvitationToken).toHaveBeenCalled());

    const keys = client.getQueryCache().getAll().map((q) => JSON.stringify(q.queryKey));
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(key).not.toContain(TOKEN);
      expect(key).not.toContain('inv_live');
    }
  });

  it('passes the token to the request', async () => {
    renderHook(() => useValidateInvitationToken(TOKEN), { wrapper: makeWrapper() });
    await waitFor(() =>
      expect(sponsorTeamService.validateInvitationToken).toHaveBeenCalledWith(TOKEN),
    );
  });

  it('drops the result as soon as the view unmounts', async () => {
    const client = new QueryClient();
    const { unmount } = renderHook(() => useValidateInvitationToken(TOKEN), {
      wrapper: ({ children }) =>
        React.createElement(QueryClientProvider, { client }, children),
    });
    await waitFor(() => expect(client.getQueryCache().getAll().length).toBeGreaterThan(0));

    unmount();

    await waitFor(() => expect(client.getQueryCache().getAll()).toHaveLength(0));
  });

  it('refetches when the token changes so a stale verdict is not shown', async () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children);

    const { rerender } = renderHook(
      ({ token }: { token: string }) => useValidateInvitationToken(token),
      { wrapper, initialProps: { token: 'inv_a' } },
    );
    await waitFor(() =>
      expect(sponsorTeamService.validateInvitationToken).toHaveBeenLastCalledWith('inv_a'),
    );

    rerender({ token: 'inv_b' });

    await waitFor(() =>
      expect(sponsorTeamService.validateInvitationToken).toHaveBeenLastCalledWith('inv_b'),
    );
  });

  it('does not call the API without a token', () => {
    renderHook(() => useValidateInvitationToken(''), { wrapper: makeWrapper() });
    expect(sponsorTeamService.validateInvitationToken).not.toHaveBeenCalled();
  });
});

describe('useAcceptSponsorInvitation', () => {
  beforeEach(() => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'u1', role: 'student', tenantId: 'tenant-1' },
    });
  });

  it('invalidates the sponsor-team namespace on success', async () => {
    vi.mocked(sponsorTeamService.acceptInvitation).mockResolvedValue({
      sponsorId: 'sponsor-1',
    } as never);
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);

    const { result } = renderHook(() => useAcceptSponsorInvitation(), {
      wrapper: ({ children }) =>
        React.createElement(QueryClientProvider, { client }, children),
    });
    result.current.mutate({ token: TOKEN } as never);

    await waitFor(() => expect(invalidate).toHaveBeenCalled());
    const identity = { userId: 'u1', role: 'student', tenantId: 'tenant-1' };
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: scholarshipQueryKeys(identity).sponsorTeam.all,
    });
  });

  it('does not invalidate when the write fails', async () => {
    vi.mocked(sponsorTeamService.acceptInvitation).mockRejectedValue(new Error('Invitation expired'));
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);

    const { result } = renderHook(() => useAcceptSponsorInvitation(), {
      wrapper: ({ children }) =>
        React.createElement(QueryClientProvider, { client }, children),
    });
    result.current.mutate({ token: TOKEN } as never);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).not.toHaveBeenCalled();
  });
});
