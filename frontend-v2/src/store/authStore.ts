import { create } from "zustand";
import { persist } from "zustand/middleware";
import { clearUserScopedCache } from "@/src/lib/clear-user-query-cache";
import { queryClient } from "@/src/lib/query-client";

/**
 * Roles a user can hold inside a capstone / research workspace
 * (CAPSTONE-070, -071, -073, -075). Navigation and action affordances are
 * derived from these roles, never from client-side guesses.
 */
export type WorkspaceRole =
  | "owner"
  | "manager"
  | "contributor"
  | "reviewer"
  | "approver"
  | "observer";

/**
 * Capabilities the workspace UI gates on. Deny-by-default: an unknown
 * capability or a missing tenant resolves to `false`.
 */
export type WorkspaceCapability =
  | "workspace:view"
  | "workspace:manage"
  | "decision:record"
  | "decision:supersede"
  | "source-control:connect"
  | "source-control:revoke"
  | "review-queue:view"
  | "review-queue:assign"
  | "review:submit";

const ROLE_CAPABILITIES: Record<WorkspaceRole, readonly WorkspaceCapability[]> =
  {
    owner: [
      "workspace:view",
      "workspace:manage",
      "decision:record",
      "decision:supersede",
      "source-control:connect",
      "source-control:revoke",
      "review-queue:view",
      "review-queue:assign",
      "review:submit",
    ],
    manager: [
      "workspace:view",
      "workspace:manage",
      "decision:record",
      "decision:supersede",
      "source-control:connect",
      "source-control:revoke",
      "review-queue:view",
      "review-queue:assign",
    ],
    contributor: [
      "workspace:view",
      "decision:record",
      "source-control:connect",
      "review-queue:view",
    ],
    reviewer: ["workspace:view", "review-queue:view", "review:submit"],
    approver: [
      "workspace:view",
      "decision:record",
      "decision:supersede",
      "review-queue:view",
    ],
    observer: ["workspace:view"],
  };

interface AuthUser {
=======
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?:
    | "admin"
    | "administrator"
    | "instructor"
    | "student"
    | "mentor"
    | "tutor"
    | "guardian"
    | "moderator";
  avatarUrl?: string;
  /**
   * Owning tenant. Scholarship query keys are scoped by tenant as well as user
   * (issue #1227), so a user who is a member of more than one tenant must not
   * reuse another tenant's cached applications or awards.
   */
  tenantId?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  token: string | null;
  /**
   * Workspace roles for the current identity (CAPSTONE-070/-071/-073/-075).
   * Cleared on every identity change so stale capabilities cannot survive a
   * sign-out or account switch.
   */
  workspaceRoles: WorkspaceRole[];
  /**
   * Returns `true` only when the user is authenticated, has a tenant, and at
   * least one of their workspace roles grants the capability.
   */
  hasWorkspaceCapability: (capability: WorkspaceCapability) => boolean;
  /**
   * Stellar public key currently connected via the wallet (issue #694).
   * Mirrored from WalletContext so enrollment / payment flows can read it
   * from a single source of truth without importing the wallet context.
   */
  walletPublicKey: string | null;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  /** Alias for logout — clears all auth state. */
  clearAuth: () => void;
  setWalletPublicKey: (key: string | null) => void;
}

const ACCESS_TOKEN_KEY = "accessToken";
const USER_KEY = "auth_user";

/**
 * Workspace capability flags (CAPSTONE-067/069/077/078).
 *
 * Deny-by-default: every flag is `false` unless the session, tenant and role
 * checks below all pass. Private researcher notes are owner-only and never
 * exposed to moderators, reviewers or team members.
 */
export interface WorkspacePermissions {
  canViewNotes: boolean;
  canModerateDiscussions: boolean;
  canAggregateReviews: boolean;
  canRequestRevisions: boolean;
}

const DENIED: WorkspacePermissions = {
  canViewNotes: false,
  canModerateDiscussions: false,
  canAggregateReviews: false,
  canRequestRevisions: false,
};

const MODERATOR_ROLES: ReadonlyArray<NonNullable<AuthUser["role"]>> = [
  "admin",
  "administrator",
  "moderator",
  "instructor",
  "mentor",
  "tutor",
];

const REVIEWER_ROLES: ReadonlyArray<NonNullable<AuthUser["role"]>> = [
  "admin",
  "administrator",
  "moderator",
  "instructor",
  "mentor",
];

export interface WorkspaceAccessInput {
  isAuthenticated?: boolean;
  user?: AuthUser | null;
  /** Tenant the route/component is scoped to, if any. */
  tenantId?: string | null;
  /** Owner id of the private note being viewed, if any. */
  noteOwnerId?: string | null;
}

/**
 * Derive workspace permissions from the current session. Returns all-false
 * when the session, tenant or user identity is missing, or when the caller
 * asks for a tenant other than the one the user belongs to.
 */
export function resolveWorkspacePermissions({
  isAuthenticated,
  user,
  tenantId,
  noteOwnerId,
}: WorkspaceAccessInput): WorkspacePermissions {
  if (!isAuthenticated || !user || !user.id) return DENIED;
  // Tenant boundary: a user without a tenant cannot reach workspace routes,
  // and a route scoped to a different tenant is rejected outright.
  if (!user.tenantId) return DENIED;
  if (tenantId && tenantId !== user.tenantId) return DENIED;

  const role = user.role;
  const isModerator = !!role && MODERATOR_ROLES.includes(role);
  const isReviewer = !!role && REVIEWER_ROLES.includes(role);

  return {
    // Private notes are strictly owner-only — moderators and reviewers are
    // excluded even though they can moderate or aggregate.
    canViewNotes: noteOwnerId ? noteOwnerId === user.id : true,
    canModerateDiscussions: isModerator,
    canAggregateReviews: isReviewer,
    canRequestRevisions: isReviewer,
  };
}

/** Read the persisted session without subscribing (safe outside React). */
export function getWorkspacePermissions(
  tenantId?: string | null,
  noteOwnerId?: string | null,
): WorkspacePermissions {
  const state = useAuthStore.getState();
  return resolveWorkspacePermissions({
    isAuthenticated: state.isAuthenticated,
    user: state.user,
    tenantId,
    noteOwnerId,
  });
}

function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      token: null,
      workspaceRoles: [],
      walletPublicKey: null,
      login: (user, token) => {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        localStorage.setItem(ACCESS_TOKEN_KEY, token);
        // Identity switch: purge before publishing the new identity so no
        // subscriber can read a key that still belongs to the previous user.
        // A first sign-in has nothing cached, so skip the teardown there.
        if (get().isAuthenticated || get().user) {
          void clearUserScopedCache(queryClient);
        }
        // Roles are re-fetched for the new identity; never carry them over.
        set({ isAuthenticated: true, user, token, workspaceRoles: [] });
      },
      logout: () => {
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("token_expiry");
        set({
          isAuthenticated: false,
          user: null,
          token: null,
          workspaceRoles: [],
          walletPublicKey: null,
        });
        // Issue #1227: drop identity-scoped query data so the next session
        // cannot render the previous user's scholarship records. Sign-out
        // stays synchronous; teardown runs in the background.
        void clearUserScopedCache(queryClient);
      },
      clearAuth: () => {
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        set({
          isAuthenticated: false,
          user: null,
          token: null,
          workspaceRoles: [],
        });
        void clearUserScopedCache(queryClient);
      },
      hasWorkspaceCapability: (capability) => {
        const { isAuthenticated, user, workspaceRoles } = get();
        // Deny-by-default: no session, no tenant, or no roles means no access.
        if (!isAuthenticated || !user?.tenantId) return false;
        if (!Array.isArray(workspaceRoles) || workspaceRoles.length === 0) {
          return false;
        }
        return workspaceRoles.some((role) =>
          ROLE_CAPABILITIES[role]?.includes(capability),
        );
      },
      setWalletPublicKey: (key) => set({ walletPublicKey: key }),
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        token: state.token,
        // tenantId lives on `user`, which is persisted above, so role-aware
        // navigation survives a reload without persisting anything extra.
        // walletPublicKey is intentionally NOT persisted: the wallet
        // extension is the source of truth and re-syncs on mount.
        // workspaceRoles is intentionally NOT persisted: it is re-fetched
        // per session so a stale capability can never outlive an identity.
      }),
    },
  ),
);

/**
 * React hook exposing deny-by-default workspace permissions for the current
 * session. Re-renders when identity, tenant or role changes.
 */
export function useWorkspacePermissions(
  tenantId?: string | null,
  noteOwnerId?: string | null,
): WorkspacePermissions {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  return resolveWorkspacePermissions({
    isAuthenticated,
    user,
    tenantId,
    noteOwnerId,
  });
}
