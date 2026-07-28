/**
 * Query-key factory for issue #831.
 * Every key is scoped by the authenticated identity (and wallet, where
 * relevant) so cached React Query data can never leak across accounts.
 */

type Identity = {
  userId: string;
  role: 'student' | 'instructor' | 'organization';
  walletAddress?: string;
  network?: string;
};

export const queryKeys = {
  profile: (identity: Identity) => ['profile', identity.role, identity.userId] as const,

  courses: (identity: Identity) => ['courses', identity.role, identity.userId] as const,

  notifications: (identity: Identity) =>
    ['notifications', identity.role, identity.userId] as const,

  dashboard: (identity: Identity) => ['dashboard', identity.role, identity.userId] as const,

  wallet: (identity: Identity) =>
    [
      'wallet',
      identity.userId,
      identity.walletAddress ?? 'disconnected',
      identity.network ?? 'unknown',
    ] as const,
};
