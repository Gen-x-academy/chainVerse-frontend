/**
 * Identity-scoped keys and the logout teardown (issue #1227).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/src/store/authStore';
import { clearUserScopedCache, isUserScopedQueryKey } from '@/src/lib/clear-user-query-cache';
import { queryClient as appQueryClient } from '@/src/lib/query-client';
import { SCHOLARSHIP_QUERY_ROOT, scholarshipQueryKeys } from '../queryKeys';
import { useScholarshipIdentity, useScholarshipKeys } from '../useScholarshipKeys';

const originalUser = useAuthStore.getState().user;
const originalAuth = useAuthStore.getState().isAuthenticated;

beforeEach(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false, token: null });
  localStorage.clear();
});

describe('useScholarshipIdentity', () => {
  it('is anonymous while signed out', () => {
    const { result } = renderHook(() => useScholarshipIdentity());
    expect(result.current).toEqual({ userId: 'anonymous', role: 'anonymous' });
  });

  it('scopes to the signed-in user, role and tenant', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'user-1', role: 'student', tenantId: 'tenant-7' },
    });
    const { result } = renderHook(() => useScholarshipIdentity());
    expect(result.current).toEqual({ userId: 'user-1', role: 'student', tenantId: 'tenant-7' });
  });

  it('re-keys when the user changes, so one user never reads another cache entry', async () => {
    const { result, rerender } = renderHook(() => useScholarshipKeys());
    const before = result.current.awards.all;

    await act(async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        user: { id: 'user-2', role: 'student', tenantId: 'tenant-7' },
      });
    });
    rerender();

    expect(result.current.awards.all).not.toEqual(before);
  });

  it('re-keys on sign-out', async () => {
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-1', role: 'student' } });
    const { result, rerender } = renderHook(() => useScholarshipIdentity());
    const signedIn = result.current;

    await act(async () => {
      useAuthStore.getState().logout();
    });
    rerender();

    expect(result.current).not.toEqual(signedIn);
    expect(result.current.userId).toBe('anonymous');
  });

  it('stays anonymous when authenticated but the user has no id', () => {
    // An authenticated session with no subject cannot be trusted to scope a
    // cache, so it must not borrow another identity's entries.
    useAuthStore.setState({ isAuthenticated: true, user: { role: 'admin' } });
    const { result } = renderHook(() => useScholarshipIdentity());
    expect(result.current.userId).toBe('anonymous');
  });
});

describe('isUserScopedQueryKey', () => {
  it('treats scholarship keys as user scoped', () => {
    expect(isUserScopedQueryKey(scholarshipQueryKeys({ userId: 'u', role: 'r' }).awards.all)).toBe(
      true,
    );
  });

  it('leaves public catalogue data alone', () => {
    // Public reads are not sensitive and are expensive to refetch; logging out
    // should not throw them away.
    expect(isUserScopedQueryKey(['catalog', 'search', 'rust'])).toBe(false);
    expect(isUserScopedQueryKey(['instructors'])).toBe(false);
  });

  it('rejects a malformed key', () => {
    expect(isUserScopedQueryKey([])).toBe(false);
    expect(isUserScopedQueryKey([42, 'x'])).toBe(false);
  });
});

describe('clearUserScopedCache', () => {
  function seed(queryClient: QueryClient) {
    const scoped = scholarshipQueryKeys({ userId: 'user-1', role: 'student', tenantId: 'tenant-1' });
    queryClient.setQueryData(scoped.awards.lists(), ['award-a']);
    queryClient.setQueryData(scoped.applications.list({ page: 1 }), ['app-a']);
    queryClient.setQueryData(scoped.milestones.detail('m-1'), { id: 'm-1' });
    queryClient.setQueryData(['profile', 'me'], { id: 'user-1' });
    queryClient.setQueryData(['catalog', 'search'], ['book-a']);
    return scoped;
  }

  it('removes every scholarship view but keeps public data', async () => {
    const queryClient = new QueryClient();
    const scoped = seed(queryClient);

    await clearUserScopedCache(queryClient);

    expect(queryClient.getQueryData(scoped.awards.lists())).toBeUndefined();
    expect(queryClient.getQueryData(scoped.applications.list({ page: 1 }))).toBeUndefined();
    expect(queryClient.getQueryData(scoped.milestones.detail('m-1'))).toBeUndefined();
    expect(queryClient.getQueryData(['profile', 'me'])).toBeUndefined();
    // Public catalogue data survives.
    expect(queryClient.getQueryData(['catalog', 'search'])).toEqual(['book-a']);
  });

  it('cancels in-flight user-scoped queries so a late response cannot repopulate the cache', async () => {
    const queryClient = new QueryClient();
    const cancel = vi.spyOn(queryClient, 'cancelQueries').mockResolvedValue(undefined);
    seed(queryClient);

    await clearUserScopedCache(queryClient);

    const cancelled = cancel.mock.calls.map(([arg]) => (arg as { queryKey: unknown[] }).queryKey[0]);
    expect(cancelled).toContain(SCHOLARSHIP_QUERY_ROOT);
  });

  it('does not cancel public queries', async () => {
    const queryClient = new QueryClient();
    const cancel = vi.spyOn(queryClient, 'cancelQueries').mockResolvedValue(undefined);
    seed(queryClient);

    await clearUserScopedCache(queryClient);

    const cancelled = cancel.mock.calls.map(([arg]) => (arg as { queryKey: unknown[] }).queryKey[0]);
    expect(cancelled).not.toContain('catalog');
  });

  it('runs on logout without blocking sign-out', async () => {
    // The auth store tears down the app's QueryClient singleton, which is the
    // one the provider hands to components, so that is the one to seed.
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-1', role: 'student' } });
    const scoped = seed(appQueryClient);
    expect(appQueryClient.getQueryData(scoped.awards.lists())).toEqual(['award-a']);

    act(() => {
      useAuthStore.getState().logout();
    });

    await waitFor(() => {
      expect(appQueryClient.getQueryData(scoped.awards.lists())).toBeUndefined();
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    // Public data is not sensitive, so it survives sign-out.
    expect(appQueryClient.getQueryData(['catalog', 'search'])).toEqual(['book-a']);
  });

  it('purges on an identity switch so the next user starts clean', async () => {
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-1', role: 'student' } });
    const scoped = seed(appQueryClient);

    act(() => {
      useAuthStore.getState().login({ id: 'user-2', role: 'student' }, 'token-2');
    });

    await waitFor(() => {
      expect(appQueryClient.getQueryData(scoped.awards.lists())).toBeUndefined();
    });
  });

  it('does not purge on a first sign-in, when nothing is cached', async () => {
    const cancel = vi.spyOn(appQueryClient, 'cancelQueries').mockResolvedValue(undefined);
    useAuthStore.setState({ user: null, isAuthenticated: false });

    act(() => {
      useAuthStore.getState().login({ id: 'user-1', role: 'student' }, 'token-1');
    });

    expect(cancel).not.toHaveBeenCalled();
  });
});

afterEach(() => {
  // The auth store and the QueryClient are module singletons; restore them so
  // ordering between files cannot leak a signed-in session or cached records.
  useAuthStore.setState({ user: originalUser, isAuthenticated: originalAuth });
  appQueryClient.clear();
});
