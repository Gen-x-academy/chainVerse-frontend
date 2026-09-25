'use client';

import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { SubmissionCheckKind, SubmissionCheckResult } from '../types';

interface AtomicChecklistProps {
  checks: Record<SubmissionCheckKind, SubmissionCheckResult>;
  isSubmitting?: boolean;
}

const CHECK_ICONS: Record<SubmissionCheckKind, React.ComponentType<{ className?: string }>> = {
  eligibility: ShieldCheck,
  form_completeness: FileText,
  documents: FileCheck2,
  consent: CheckCircle2,
  deadline: Clock,
  uniqueness: Sparkles,
};

export function AtomicChecklist({ checks, isSubmitting = false }: AtomicChecklistProps) {
  const checkList = Object.values(checks);
  const passedCount = checkList.filter((c) => c.passed).length;
  const allPassed = passedCount === checkList.length;

  return (
    <div
      role="region"
      aria-labelledby="checklist-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 id="checklist-heading" className="text-sm font-bold text-slate-900">
            Atomic Submission Readiness
          </h3>
          <p className="text-xs text-slate-500">
            All 6 requirements are validated in one atomic transition.
          </p>
        </div>

        {/* Live readiness counter */}
        <div
          role="status"
          aria-live="polite"
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            allPassed
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-amber-100 text-amber-900'
          }`}
        >
          {passedCount} of {checkList.length} Ready
        </div>
      </div>

      <ul className="mt-4 space-y-3" aria-label="Application validation checklist">
        {checkList.map((check) => {
          const Icon = CHECK_ICONS[check.kind] ?? AlertCircle;

          return (
            <li
              key={check.kind}
              className={`flex items-start gap-3 rounded-xl border p-3 text-xs transition ${
                check.passed
                  ? 'border-emerald-200 bg-emerald-50/50 text-emerald-950'
                  : 'border-slate-200 bg-slate-50/60 text-slate-700'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {check.passed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Passed" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500" aria-label="Pending or Incomplete" />
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">{check.title}</p>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      check.passed ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {check.passed ? 'Verified' : 'Pending'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{check.description}</p>

                {/* Specific check error hints if not passed */}
                {!check.passed && check.errors.length > 0 && (
                  <ul className="mt-2 space-y-1 rounded-lg bg-amber-50/80 p-2 text-[11px] text-amber-900 border border-amber-200/60">
                    {check.errors.map((err, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-amber-600 font-bold">•</span>
                        <span>{err}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
