"use client";

import React from "react";
import { LogOut, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLogout } from "@/src/features/auth/hooks/useLogout";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogoutButtonProps {
  /** Visual variant of the button. */
  variant?: "default" | "menu-item" | "icon-only";
  /** Additional Tailwind classes. */
  className?: string;
}

// ─── Variant styles ───────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<NonNullable<LogoutButtonProps["variant"]>, string> = {
  "default":
    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
  "menu-item":
    "flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
  "icon-only":
    "p-2 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * LogoutButton
 *
 * Reusable logout trigger that delegates all logout logic to useLogout().
 * Renders a loading spinner while logging out and disables to prevent
 * double-submission.
 *
 * Variants:
 *  - "default"    → standard button (use in settings, profile pages)
 *  - "menu-item"  → full-width for dropdown menus
 *  - "icon-only"  → icon-only for compact headers
 *
 * Time:  O(1) render.
 * Space: O(1) — no internal state; delegates to useLogout.
 */
export const LogoutButton: React.FC<LogoutButtonProps> = ({
  variant = "default",
  className,
}) => {
  const { logout, isLoggingOut, error } = useLogout();

  return (
    <>
      <button
        id="logout-button"
        onClick={logout}
        disabled={isLoggingOut}
        className={cn(VARIANT_STYLES[variant], className)}
        aria-label="Sign out of your account"
        aria-busy={isLoggingOut}
      >
        {isLoggingOut ? (
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        ) : (
          <LogOut size={16} aria-hidden="true" />
        )}
        {variant !== "icon-only" && (
          <span>{isLoggingOut ? "Signing out…" : "Sign out"}</span>
        )}
      </button>

      {/* Inline error — non-intrusive, shown below the trigger */}
      {error && (
        <p role="alert" className="mt-1 text-xs text-rose-500 text-center">
          {error}
        </p>
      )}
    </>
  );
};
