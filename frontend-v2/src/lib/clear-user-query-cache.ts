/**
 * User-scoped cache teardown for issue #830.
 * Cached profile/course/notification/dashboard responses could survive
 * logout and flash to the next signed-in user. Call this before navigating
 * away on logout or identity switch.
 */
import type { QueryClient } from '@tanstack/react-query';

const USER_SCOPED_PREFIXES = ['profile', 'courses', 'notifications', 'dashboard', 'wallet'];

export async function clearUserScopedCache(queryClient: QueryClient) {
  await queryClient.cancelQueries();

  queryClient.removeQueries({
    predicate: (query) => {
      const [prefix] = query.queryKey as [string?];
      return typeof prefix === 'string' && USER_SCOPED_PREFIXES.includes(prefix);
    },
  });
}
