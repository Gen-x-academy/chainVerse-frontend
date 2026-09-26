/**
 * DraftConflictBanner — shown when a concurrent-edit version conflict is detected.
 *
 * Gives the student two explicit, destructive-safe resolution options:
 * 1. Keep my changes (force-save local version)
 * 2. Use saved version (discard local changes, accept server's draft)
 *
 * Accessibility:
 * - `role="alertdialog"` with `aria-labelledby` and `aria-describedby`.
 * - Keyboard: first focusable button receives focus when banner mounts.
 */

'use client';

import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface DraftConflictBannerProps {
  serverLastSavedAt: string;
  onKeepLocal: () => void;
  onUseServer: () => void;
  isResolving?: boolean;
}

export function DraftConflictBanner({
  serverLastSavedAt,
  onKeepLocal,
  onUseServer,
  isResolving = false,
}: DraftConflictBannerProps) {
  const keepBtnRef = useRef<HTMLButtonElement>(null);

  // Move focus to first action on mount so keyboard users are aware
  useEffect(() => {
    keepBtnRef.current?.focus();
  }, []);

  const formattedTime = new Date(serverLastSavedAt).toLocaleString();

  return (
    <div
      role="alertdialog"
      aria-labelledby="draft-conflict-title"
      aria-describedby="draft-conflict-desc"
      className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
          aria-hidden="true"
        />
        <div className="flex-1">
          <h3
            id="draft-conflict-title"
            className="text-sm font-bold text-amber-900"
          >
            Draft conflict detected
          </h3>
          <p
            id="draft-conflict-desc"
            className="mt-1 text-xs text-amber-800"
          >
            Another session saved this draft at{' '}
            <strong>{formattedTime}</strong>. Your local changes have not been
            saved. Choose which version to keep.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              ref={keepBtnRef}
              type="button"
              onClick={onKeepLocal}
              disabled={isResolving}
              className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
            >
              Keep my changes
            </button>
            <button
              type="button"
              onClick={onUseServer}
              disabled={isResolving}
              className="rounded-lg border border-amber-400 bg-white px-4 py-2 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
            >
              Use saved version
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
