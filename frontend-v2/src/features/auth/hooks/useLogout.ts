"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authService } from "../services/auth.service";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseLogoutReturn {
  logout: () => Promise<void>;
  isLoggingOut: boolean;
  error: string | null;
}

/** Route the user is redirected to after successful logout. */
const POST_LOGOUT_ROUTE = "/";

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useLogout
 *
 * Encapsulates the full logout flow:
 *   1. Calls authService.logout() — clears tokens, revokes server session.
 *   2. Redirects to the post-logout route (home / login).
 *   3. Exposes isLoggingOut and error so the UI can reflect state.
 *
 * Time:  O(1) — constant-time async initiation.
 * Space: O(1) — two boolean/string state atoms.
 *
 * Usage:
 *   const { logout, isLoggingOut } = useLogout();
 *   <button onClick={logout} disabled={isLoggingOut}>Sign out</button>
 */
export function useLogout(): UseLogoutReturn {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(async () => {
    if (isLoggingOut) return; // guard against double-click
    setIsLoggingOut(true);
    setError(null);
    try {
      await authService.logout();
      router.replace(POST_LOGOUT_ROUTE);
    } catch {
      // authService.logout() swallows network errors internally,
      // so this catch handles any unexpected runtime exception.
      setError("Sign-out failed. Please try again.");
      setIsLoggingOut(false);
    }
  }, [isLoggingOut, router]);

  return { logout, isLoggingOut, error };
}
