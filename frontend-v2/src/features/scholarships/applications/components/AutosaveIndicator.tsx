/**
 * AutosaveIndicator — real-time autosave status badge.
 *
 * Accessible:
 * - Uses `role="status"` and `aria-live="polite"` so screen readers
 *   announce state changes without interrupting the user.
 * - Uses `aria-label` for icon-only states.
 */

'use client';

import React from 'react';
import { CheckCircle2, AlertCircle, Loader2, Clock, GitMerge } from 'lucide-react';
import type { AutosaveStatus } from '../draft.types';

export interface AutosaveIndicatorProps {
  status: AutosaveStatus;
  lastSavedAt: string | null;
  errorMessage: string | null;
}

export function AutosaveIndicator({
  status,
  lastSavedAt,
  errorMessage,
}: AutosaveIndicatorProps) {
  const formattedTime = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null;

  const config: Record<
    AutosaveStatus,
    {
      icon: React.ReactNode;
      text: string;
      className: string;
    }
  > = {
    idle: {
      icon: <Clock className="h-3.5 w-3.5" aria-hidden="true" />,
      text: 'Autosave ready',
      className: 'text-slate-400',
    },
    pending: {
      icon: <Clock className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />,
      text: 'Unsaved changes',
      className: 'text-amber-600',
    },
    saving: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />,
      text: 'Saving draft…',
      className: 'text-indigo-600',
    },
    saved: {
      icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />,
      text: formattedTime ? `Saved at ${formattedTime}` : 'Draft saved',
      className: 'text-emerald-600',
    },
    conflict: {
      icon: <GitMerge className="h-3.5 w-3.5" aria-hidden="true" />,
      text: 'Conflict detected',
      className: 'text-red-600',
    },
    error: {
      icon: <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />,
      text: errorMessage ?? 'Save error',
      className: 'text-red-600',
    },
  };

  const { icon, text, className } = config[status];

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={`Autosave status: ${text}`}
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${className}`}
    >
      {icon}
      <span>{text}</span>
    </span>
  );
}
