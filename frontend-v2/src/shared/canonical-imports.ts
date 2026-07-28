/**
 * Canonical import map for issue #821.
 * frontend-v2 has parallel top-level and src-level lib/hooks/services
 * directories (e.g. `lib/query-client.ts` vs `src/lib/query-client.ts`).
 * This documents the single canonical path new code should import from
 * until the duplicates are removed and callers migrated.
 */

export const CANONICAL_IMPORTS = {
  queryClient: '@/src/lib/query-client',
  apiClient: '@/src/lib/api-client',
  authStore: '@/src/store/authStore',
  walletContext: '@/src/context/WalletContext',
} as const;

/**
 * Paths still duplicated outside `src/`; do not add new imports from these —
 * migrate call sites to the matching entry in CANONICAL_IMPORTS instead.
 */
export const DEPRECATED_DUPLICATE_PATHS = ['@/lib/query-client'] as const;
