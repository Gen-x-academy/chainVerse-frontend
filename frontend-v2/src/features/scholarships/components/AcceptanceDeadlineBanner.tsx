'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';
import type { AwardRecord } from '../types/scholarship.types';

function msUntilDeadline(deadline: string): number {
  return new Date(deadline).getTime() - Date.now();
}

function formatTimeRemaining(ms: number): string {
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

export interface AcceptanceDeadlineBannerProps {
  award: AwardRecord;
  /** Awards the student already holds that conflict with this one. */
  conflictingAwardIds?: string[];
}

export function AcceptanceDeadlineBanner({
  award,
  conflictingAwardIds = [],
}: AcceptanceDeadlineBannerProps) {
  const [remainingMs, setRemainingMs] = useState(() => msUntilDeadline(award.acceptanceDeadline));

  useEffect(() => {
    const interval = setInterval(() => {
      const ms = msUntilDeadline(award.acceptanceDeadline);
      setRemainingMs(ms);
    }, 60_000);
    return () => clearInterval(interval);
  }, [award.acceptanceDeadline]);

  if (award.status === 'accepted') {
    return (
      <div
        role="status"
        className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"
      >
        <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
        <p className="text-sm font-medium text-emerald-800">
          You have accepted this award. Agreement is on record.
        </p>
      </div>
    );
  }

  if (award.status === 'declined' || award.status === 'expired' || award.status === 'cancelled') {
    return (
      <div
        role="status"
        className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
      >
        <XCircle className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
        <p className="text-sm font-medium text-gray-600">This offer is no longer available.</p>
      </div>
    );
  }

  if (award.status !== 'pending') return null;

  const isExpired = remainingMs <= 0;
  const isUrgent = !isExpired && remainingMs < 24 * 60 * 60 * 1000;

  return (
    <div className="space-y-3">
      {isExpired ? (
        <div
          role="status"
          className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3"
        >
          <Clock className="h-5 w-5 shrink-0 text-orange-500" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-orange-800">This offer has expired.</p>
            <p className="text-xs text-orange-600 mt-0.5">
              The acceptance window closed on{' '}
              <time dateTime={award.acceptanceDeadline}>
                {new Date(award.acceptanceDeadline).toLocaleString()}
              </time>
              . The reservation has been released.
            </p>
          </div>
        </div>
      ) : (
        <div
          role="status"
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
            isUrgent
              ? 'border-amber-200 bg-amber-50'
              : 'border-blue-200 bg-blue-50'
          }`}
        >
          <Clock
            className={`h-5 w-5 shrink-0 ${isUrgent ? 'text-amber-500' : 'text-blue-500'}`}
            aria-hidden="true"
          />
          <div>
            <p
              className={`text-sm font-semibold ${isUrgent ? 'text-amber-800' : 'text-blue-800'}`}
            >
              {isUrgent ? 'Offer expires soon — ' : 'Offer open — '}
              {formatTimeRemaining(remainingMs)}
            </p>
            <p className={`text-xs mt-0.5 ${isUrgent ? 'text-amber-600' : 'text-blue-600'}`}>
              Deadline:{' '}
              <time dateTime={award.acceptanceDeadline}>
                {new Date(award.acceptanceDeadline).toLocaleString()}
              </time>
            </p>
          </div>
        </div>
      )}

      {conflictingAwardIds.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-red-800">Conflicting awards detected</p>
            <p className="text-xs text-red-600 mt-0.5">
              You currently hold {conflictingAwardIds.length} award
              {conflictingAwardIds.length !== 1 ? 's' : ''} that may conflict with this offer.
              Acceptance is subject to conflict resolution by the administrator.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default AcceptanceDeadlineBanner;
