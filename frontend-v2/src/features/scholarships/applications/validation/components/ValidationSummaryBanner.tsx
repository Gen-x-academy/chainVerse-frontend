'use client';

import React from 'react';
import { AlertCircle, ArrowRight } from 'lucide-react';
import type { FieldValidationError } from '../types';

export interface ValidationSummaryBannerProps {
  errors: FieldValidationError[];
  onFocusField?: (fieldId: string) => void;
  className?: string;
}

export function ValidationSummaryBanner({
  errors,
  onFocusField,
  className = '',
}: ValidationSummaryBannerProps) {
  if (errors.length === 0) return null;

  return (
    <div
      role="alert"
      aria-labelledby="validation-summary-title"
      className={`rounded-2xl border border-rose-200 bg-rose-50/80 p-5 shadow-xs ${className}`}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 space-y-2">
          <h3 id="validation-summary-title" className="text-sm font-bold text-rose-900">
            Please correct the following {errors.length === 1 ? 'error' : `${errors.length} errors`} before submitting:
          </h3>
          <ul className="space-y-1.5 text-xs text-rose-800">
            {errors.map((error, idx) => (
              <li key={`${error.fieldId}-${idx}`} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] bg-rose-100 text-rose-900 px-1.5 py-0.5 rounded-md">
                    {error.fieldPath}
                  </span>
                  <span>&mdash;</span>
                  <span>{error.message}</span>
                </div>
                {onFocusField && (
                  <button
                    type="button"
                    onClick={() => onFocusField(error.fieldId)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 underline hover:text-rose-900 focus:outline-none focus:ring-1 focus:ring-rose-500 rounded"
                  >
                    <span>Fix</span>
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
