'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  FileText,
  GitMerge,
  ShieldCheck,
  X,
} from 'lucide-react';
import { reconcileDraftsSafely } from '../domain';
import type { DraftReconciliationStrategy, ReconciledDraftResult } from '../types';
import type { SupportingDocument } from '../../documents';

interface DraftReconciliationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyReconciliation: (result: ReconciledDraftResult) => void;
  draftA: {
    statementSummary: string;
    requestedAmountCents?: number;
    documents: SupportingDocument[];
    updatedAt: string;
  };
  draftB: {
    statementSummary: string;
    requestedAmountCents?: number;
    documents: SupportingDocument[];
    updatedAt: string;
  };
}

export function DraftReconciliationDialog({
  isOpen,
  onClose,
  onApplyReconciliation,
  draftA,
  draftB,
}: DraftReconciliationDialogProps) {
  const [strategy, setStrategy] = useState<DraftReconciliationStrategy>('combine_documents');

  const reconciledResult = useMemo(() => {
    return reconcileDraftsSafely(draftA, draftB, strategy);
  }, [draftA, draftB, strategy]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reconcile-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-indigo-100 p-2 text-indigo-700">
              <GitMerge className="h-5 w-5" />
            </div>
            <div>
              <h2 id="reconcile-modal-title" className="text-lg font-bold text-slate-900">
                Safe Draft Reconciliation
              </h2>
              <p className="text-xs text-slate-500">
                Concurrent draft updates detected across sessions. Reconcile changes without data loss.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Strategy Selection */}
          <fieldset className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <legend className="text-xs font-bold uppercase tracking-wider text-slate-700 px-1">
              Select Reconciliation Strategy
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              <label
                className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs transition ${
                  strategy === 'combine_documents'
                    ? 'border-indigo-500 bg-white font-semibold text-indigo-900 shadow-xs'
                    : 'border-slate-200 bg-white/70 text-slate-700 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="strategy"
                  value="combine_documents"
                  checked={strategy === 'combine_documents'}
                  onChange={() => setStrategy('combine_documents')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="block font-bold">Combine Documents</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    Preserves all unique files from both draft sessions.
                  </span>
                </div>
              </label>

              <label
                className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs transition ${
                  strategy === 'merge_longest_statement'
                    ? 'border-indigo-500 bg-white font-semibold text-indigo-900 shadow-xs'
                    : 'border-slate-200 bg-white/70 text-slate-700 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="strategy"
                  value="merge_longest_statement"
                  checked={strategy === 'merge_longest_statement'}
                  onChange={() => setStrategy('merge_longest_statement')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="block font-bold">Longest Statement</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    Selects the more detailed personal statement.
                  </span>
                </div>
              </label>

              <label
                className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs transition ${
                  strategy === 'keep_latest'
                    ? 'border-indigo-500 bg-white font-semibold text-indigo-900 shadow-xs'
                    : 'border-slate-200 bg-white/70 text-slate-700 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="strategy"
                  value="keep_latest"
                  checked={strategy === 'keep_latest'}
                  onChange={() => setStrategy('keep_latest')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="block font-bold">Keep Latest Edit</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    Prioritizes the most recent timestamp.
                  </span>
                </div>
              </label>
            </div>
          </fieldset>

          {/* Comparison Side-by-Side */}
          <div className="grid gap-4 sm:grid-cols-2 text-xs">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
              <span className="font-bold text-slate-900 block">Draft Session A (Local)</span>
              <p className="text-[11px] text-slate-500">
                Updated: {new Date(draftA.updatedAt).toLocaleTimeString()} • {draftA.documents.length} document(s)
              </p>
              <div className="rounded-xl bg-slate-50 p-2.5 text-slate-700 line-clamp-3 italic">
                &quot;{draftA.statementSummary || 'No statement entered yet'}&quot;
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
              <span className="font-bold text-slate-900 block">Draft Session B (Cloud / Other Tab)</span>
              <p className="text-[11px] text-slate-500">
                Updated: {new Date(draftB.updatedAt).toLocaleTimeString()} • {draftB.documents.length} document(s)
              </p>
              <div className="rounded-xl bg-slate-50 p-2.5 text-slate-700 line-clamp-3 italic">
                &quot;{draftB.statementSummary || 'No statement entered yet'}&quot;
              </div>
            </div>
          </div>

          {/* Reconciled Output Preview */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-emerald-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Reconciled Draft Output (Zero Data Loss)</span>
            </div>
            <p className="text-emerald-800">{reconciledResult.message}</p>
            <div className="rounded-xl bg-white p-3 border border-emerald-100 text-slate-800">
              <p className="font-semibold mb-1">Preserved Statement:</p>
              <p className="italic text-slate-600 line-clamp-3">
                &quot;{reconciledResult.statementSummary}&quot;
              </p>
              <p className="mt-2 text-[11px] text-emerald-700 font-semibold">
                Total Supporting Documents Preserved: {reconciledResult.documents.length}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onApplyReconciliation(reconciledResult);
              onClose();
            }}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Apply Reconciled Draft</span>
          </button>
        </div>
      </div>
    </div>
  );
}
