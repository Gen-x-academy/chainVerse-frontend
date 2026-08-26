'use client';

import React from 'react';
import { Clock, Users, ChevronRight } from 'lucide-react';

interface HoldQueueEntry {
  position: number;
  bookTitle: string;
  bookId: string;
  estimatedWait?: string;
  totalHolders: number;
  status: 'waiting' | 'ready' | 'expired';
}

interface HoldQueueStatusProps {
  holds: HoldQueueEntry[];
}

const STATUS_STYLES: Record<HoldQueueStatus['status'], { bg: string; text: string; label: string }> = {
  waiting: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Waiting' },
  ready: { bg: 'bg-green-50', text: 'text-green-700', label: 'Ready for Pickup' },
  expired: { bg: 'bg-red-50', text: 'text-red-700', label: 'Expired' },
};

export function HoldQueueStatus({ holds }: HoldQueueStatusProps) {
  if (holds.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500">No active holds.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {holds.map((hold) => {
        const style = STATUS_STYLES[hold.status];
        return (
          <div
            key={hold.bookId}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 truncate">{hold.bookTitle}</h3>
                <div className="flex items-center gap-4 mt-1.5 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    Position {hold.position} of {hold.totalHolders}
                  </span>
                  {hold.estimatedWait && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      ~{hold.estimatedWait}
                    </span>
                  )}
                </div>

                {/* Progress bar showing position */}
                <div className="mt-3">
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-indigo-500 h-1.5 rounded-full transition-all"
                      style={{
                        width: `${((hold.totalHolders - hold.position + 1) / hold.totalHolders) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {hold.totalHolders - hold.position + 1} of {hold.totalHolders} ahead of you
                  </p>
                </div>
              </div>

              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                {style.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
