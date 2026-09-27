'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';

export interface WordLimitIndicatorProps {
  currentWords: number;
  minWords?: number;
  maxWords?: number;
  fieldId: string;
  className?: string;
}

export function WordLimitIndicator({
  currentWords,
  minWords,
  maxWords,
  fieldId,
  className = '',
}: WordLimitIndicatorProps) {
  const hasMin = minWords !== undefined && minWords > 0;
  const hasMax = maxWords !== undefined && maxWords > 0;

  if (!hasMin && !hasMax) return null;

  const isBelowMin = hasMin && currentWords < minWords;
  const isOverMax = hasMax && currentWords > maxWords;
  const isNearMax = hasMax && currentWords >= maxWords * 0.85 && !isOverMax;

  // Percentage of max
  const percentage = hasMax ? Math.min(100, Math.round((currentWords / maxWords) * 100)) : 0;

  let statusColor = 'text-slate-500';
  let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
  let barColor = 'bg-indigo-500';

  if (isOverMax) {
    statusColor = 'text-rose-600 font-semibold';
    badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
    barColor = 'bg-rose-500';
  } else if (isNearMax) {
    statusColor = 'text-amber-600 font-medium';
    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
    barColor = 'bg-amber-500';
  } else if (!isBelowMin && currentWords > 0) {
    statusColor = 'text-emerald-600 font-medium';
    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    barColor = 'bg-emerald-500';
  }

  const screenReaderMessage = isOverMax
    ? `Warning: Word limit exceeded. You have ${currentWords} words, which is ${currentWords - (maxWords ?? 0)} words over the maximum of ${maxWords}.`
    : isBelowMin
    ? `Notice: Minimum word requirement not met. Currently ${currentWords} of ${minWords} minimum words.`
    : `Word count: ${currentWords} words.`;

  return (
    <div
      id={`${fieldId}-word-count-meter`}
      className={`mt-1.5 flex flex-col gap-1 text-xs ${className}`}
      aria-label={`Word count indicator for ${fieldId}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${badgeColor}`}>
            {isOverMax && <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />}
            {!isOverMax && !isBelowMin && currentWords > 0 && (
              <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600" aria-hidden="true" />}
            {isBelowMin && <Clock className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />}
            <span>
              {currentWords}
              {hasMax ? ` / ${maxWords}` : ''} words
            </span>
          </span>

          {hasMin && isBelowMin && (
            <span className="text-[11px] text-amber-700">
              (Minimum {minWords} words required)
            </span>
          )}

          {isOverMax && (
            <span className="text-[11px] font-semibold text-rose-600">
              ({currentWords - (maxWords ?? 0)} words over limit)
            </span>
          )}
        </div>

        {hasMax && (
          <span className="text-[11px] text-slate-400" aria-hidden="true">
            {percentage}% of limit
          </span>
        )}
      </div>

      {hasMax && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full transition-all duration-200 ${barColor}`}
            style={{ width: `${percentage}%` }}
            role="progressbar"
            aria-valuenow={currentWords}
            aria-valuemin={0}
            aria-valuemax={maxWords}
            aria-label="Word count progress"
          />
        </div>
      )}

      {/* Screen-reader live update */}
      <span className="sr-only" aria-live="polite">
        {screenReaderMessage}
      </span>
    </div>
  );
}
