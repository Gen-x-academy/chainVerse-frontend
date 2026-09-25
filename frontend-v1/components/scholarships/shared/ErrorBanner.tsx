"use client";

import { AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Inline error banner. Uses role="alert" so screen readers announce it
 * immediately when it appears without requiring user focus.
 */
export function ErrorBanner({
  message,
  onDismiss,
  className,
}: ErrorBannerProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4",
        className
      )}
    >
      <AlertCircle
        className="h-5 w-5 text-red-500 shrink-0 mt-0.5"
        aria-hidden="true"
      />
      <p className="flex-1 text-sm text-red-700">{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="shrink-0 text-red-400 hover:text-red-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
