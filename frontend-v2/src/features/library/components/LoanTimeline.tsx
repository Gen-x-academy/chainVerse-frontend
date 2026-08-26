'use client';

import React from 'react';
import { BookOpen, RotateCcw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface TimelineEvent {
  id: string;
  type: 'checkout' | 'return' | 'renewal' | 'overdue' | 'fine';
  bookTitle: string;
  bookId: string;
  timestamp: string;
  details?: string;
  librarian?: string;
}

interface LoanTimelineProps {
  events: TimelineEvent[];
}

const EVENT_CONFIG: Record<TimelineEvent['type'], {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  label: string;
}> = {
  checkout: { icon: BookOpen, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Checked Out' },
  return: { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Returned' },
  renewal: { icon: RotateCcw, color: 'text-indigo-600', bgColor: 'bg-indigo-100', label: 'Renewed' },
  overdue: { icon: AlertTriangle, color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Overdue' },
  fine: { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Fine Assessed' },
};

export function LoanTimeline({ events }: LoanTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500">No loan activity yet.</p>
      </div>
    );
  }

  return (
    <div className="relative" role="list" aria-label="Loan activity timeline">
      {/* Vertical line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" aria-hidden="true" />

      <div className="space-y-0">
        {events.map((event, index) => {
          const config = EVENT_CONFIG[event.type];
          const Icon = config.icon;

          return (
            <div
              key={event.id}
              role="listitem"
              className="relative flex items-start gap-4 py-4 pl-10"
            >
              {/* Icon circle */}
              <div
                className={`absolute left-2 w-5 h-5 rounded-full ${config.bgColor} flex items-center justify-center ring-4 ring-white z-10`}
                aria-hidden="true"
              >
                <Icon className={`w-3 h-3 ${config.color}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.bgColor} ${config.color}`}>
                    {config.label}
                  </span>
                  <time className="text-xs text-gray-400" dateTime={event.timestamp}>
                    {new Date(event.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
                <p className="text-sm font-medium text-gray-900 mt-1">{event.bookTitle}</p>
                {event.details && (
                  <p className="text-sm text-gray-500 mt-0.5">{event.details}</p>
                )}
                {event.librarian && (
                  <p className="text-xs text-gray-400 mt-1">Processed by {event.librarian}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
