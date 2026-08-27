'use client';

import React, { useCallback, useEffect } from 'react';
import {
  BookOpen,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';
import type { LoanTimelineEvent, LoanEventType } from '../types/loan.types';

export type { LoanTimelineEvent, LoanEventType };

export interface LoanTimelineProps {
  events: LoanTimelineEvent[];
  isLoading?: boolean;
  error?: string | null;
  /** When true, events are read-only (immutable history). Defaults to true. */
  readOnly?: boolean;
}

const EVENT_CONFIG: Record<
  LoanEventType,
  { icon: React.ElementType; color: string; bgColor: string; label: string }
> = {
  checkout: { icon: BookOpen, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Checked Out' },
  return: { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Returned' },
  renewal: { icon: RotateCcw, color: 'text-indigo-600', bgColor: 'bg-indigo-100', label: 'Renewed' },
  due_date: { icon: Calendar, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Due Date' },
  overdue: { icon: AlertTriangle, color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Overdue' },
  fine: { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Fine Assessed' },
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Sort events newest-first for patron-facing chronological display. */
function sortEvents(events: LoanTimelineEvent[]): LoanTimelineEvent[] {
  return [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function LoanTimeline({
  events,
  isLoading = false,
  error = null,
  readOnly = true,
}: LoanTimelineProps) {
  if (isLoading) {
    return (
      <div aria-label="Loading loan activity" aria-busy="true" className="space-y-4 py-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse flex gap-4 pl-10">
            <div className="h-5 w-5 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 rounded bg-gray-200" />
              <div className="h-5 w-48 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <p className="font-medium">Unable to load loan activity</p>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    );
  }

  const sorted = sortEvents(events);

  if (sorted.length === 0) {
    return (
      <div className="py-8 text-center" role="status">
        <Clock className="mx-auto mb-2 h-8 w-8 text-gray-300" aria-hidden="true" />
        <p className="text-gray-500">No loan activity yet.</p>
      </div>
    );
  }

  return (
    <div
      className="relative"
      role="list"
      aria-label="Loan activity timeline"
      aria-readonly={readOnly || undefined}
    >
      <div className="absolute bottom-0 left-4 top-0 w-0.5 bg-gray-200" aria-hidden="true" />

      <div className="space-y-0">
        {sorted.map((event) => {
          const config = EVENT_CONFIG[event.type];
          const Icon = config.icon;

          return (
            <article
              key={event.id}
              role="listitem"
              className="relative flex items-start gap-4 py-4 pl-10"
              aria-label={`${config.label}: ${event.bookTitle}`}
            >
              <div
                className={`absolute left-2 z-10 flex h-5 w-5 items-center justify-center rounded-full ${config.bgColor} ring-4 ring-white`}
                aria-hidden="true"
              >
                <Icon className={`h-3 w-3 ${config.color}`} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${config.bgColor} ${config.color}`}
                  >
                    {config.label}
                  </span>
                  <time className="text-xs text-gray-400" dateTime={event.timestamp}>
                    {formatTimestamp(event.timestamp)}
                  </time>
                </div>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  <Link
                    href={`/catalog/${event.bookId}`}
                    className="hover:text-indigo-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    {event.bookTitle}
                  </Link>
                </p>
                {event.details && (
                  <p className="mt-0.5 text-sm text-gray-500">{event.details}</p>
                )}
                {event.librarian && (
                  <p className="mt-1 text-xs text-gray-400">Processed by {event.librarian}</p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
