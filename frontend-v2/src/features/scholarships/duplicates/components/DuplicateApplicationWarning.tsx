'use client';

import React from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, FileText, Lock } from 'lucide-react';
import type { ExistingApplicationSummary } from '../types';

interface DuplicateApplicationWarningProps {
  existingApplication: ExistingApplicationSummary;
  programName?: string;
  onViewReceipt?: () => void;
  className?: string;
}

export function DuplicateApplicationWarning({
  existingApplication,
  programName = 'this program',
  onViewReceipt,
  className = '',
}: DuplicateApplicationWarningProps) {
  return (
    <div
      role="alert"
      aria-labelledby="dup-warning-title"
      className={`rounded-3xl border border-amber-200 bg-amber-50/80 p-6 text-amber-950 shadow-sm ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700 shrink-0">
          <Lock className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 id="dup-warning-title" className="text-base font-bold text-amber-900">
            Active Application Already on File
          </h2>
          <p className="text-xs text-amber-800">
            You have already submitted an active application for <span className="font-semibold">{programName}</span>.
            Under the program uniqueness policy, multiple simultaneous submissions are restricted to ensure fair consideration for all applicants.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-amber-200 bg-white/80 p-4 text-xs space-y-2">
        <div className="flex justify-between">
          <span className="text-slate-500">Submission Date:</span>
          <span className="font-medium text-slate-800">
            {new Date(existingApplication.submittedAt).toLocaleDateString()} at{' '}
            {new Date(existingApplication.submittedAt).toLocaleTimeString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Current Status:</span>
          <span className="font-bold uppercase tracking-wider text-indigo-700">
            {existingApplication.status.replace('_', ' ')}
          </span>
        </div>
        {existingApplication.receiptId && (
          <div className="flex justify-between">
            <span className="text-slate-500">Receipt ID:</span>
            <span className="font-mono font-bold text-slate-800">{existingApplication.receiptId}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-500">Documents Attached:</span>
          <span className="font-medium text-slate-800">
            {existingApplication.documents.length} verified file(s)
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-amber-800">
          Duplicate attempts are idempotent. Retrying this request returns your verified receipt without creating duplicate entries.
        </p>

        {onViewReceipt && (
          <button
            type="button"
            onClick={onViewReceipt}
            className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <span>View Submission Receipt</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
