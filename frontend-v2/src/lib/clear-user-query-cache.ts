/**
 * User-scoped cache teardown for issue #830.
 * Cached profile/course/notification/dashboard responses could survive
 * logout and flash to the next signed-in user. Call this before navigating
 * away on logout or identity switch.
 *
 * Issue #1227: scholarship queries are identity-scoped
 * (`['scholarships', tenant, role, userId]`, see
 * `features/scholarships/lib/queryKeys.ts`). Leaving them in the cache across
 * a logout or a user switch would let the next session render the previous
 * user's applications, awards and payment history. The root is imported rather
 * than re-typed so renaming the factory root cannot silently break teardown.
 */
import type { QueryClient } from '@tanstack/react-query';
import { SCHOLARSHIP_QUERY_ROOT } from '@/src/features/scholarships/lib/queryKeys';

const USER_SCOPED_PREFIXES = [
  'profile',
  'courses',
  'notifications',
  'dashboard',
  'wallet',
  SCHOLARSHIP_QUERY_ROOT,
];

/**
 * True when a query key belongs to the signed-in user rather than to public
 * catalogue data. Public keys are intentionally left alone so logging out does
 * not throw away anonymous, non-sensitive reads.
 */
export function isUserScopedQueryKey(queryKey: readonly unknown[]): boolean {
  const [prefix] = queryKey;
  return typeof prefix === 'string' && USER_SCOPED_PREFIXES.includes(prefix);
}

export async function clearUserScopedCache(queryClient: QueryClient) {
  // Cancel only the user-scoped queries. A bare `cancelQueries()` also aborts
  // in-flight public catalogue requests, which then needlessly refetch on the
  // next page load.
  for (const prefix of USER_SCOPED_PREFIXES) {
    await queryClient.cancelQueries({ queryKey: [prefix] });
  }

  queryClient.removeQueries({
    predicate: (query) => isUserScopedQueryKey(query.queryKey as readonly unknown[]),
  });
}
