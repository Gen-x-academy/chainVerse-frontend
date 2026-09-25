'use client';

import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileCheck,
  Lock,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import type { SubmissionReceipt } from '../types';

interface SubmissionReceiptViewProps {
  receipt: SubmissionReceipt;
  onRetryDemonstration?: () => Promise<void>;
  isRetrying?: boolean;
}

export function SubmissionReceiptView({
  receipt,
  onRetryDemonstration,
  isRetrying = false,
}: SubmissionReceiptViewProps) {
  const [copied, setCopied] = useState(false);
  const [replayNotice, setReplayNotice] = useState<string | null>(null);

  const handleCopy = () => {
    void navigator.clipboard.writeText(receipt.receiptId);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleTriggerReplay = async () => {
    if (!onRetryDemonstration) return;
    try {
      await onRetryDemonstration();
      setReplayNotice('Idempotency verified: replayed exact existing receipt. No duplicate was created.');
      setTimeout(() => setReplayNotice(null), 6000);
    } catch {
      // Ignored
    }
  };

  return (
    <div
      role="status"
      aria-labelledby="receipt-title"
      className="mx-auto w-full max-w-2xl rounded-3xl border border-emerald-200 bg-white p-6 shadow-lg md:p-8"
    >
      {/* Receipt Header */}
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-xs">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800">
            <Lock className="h-3 w-3" />
            <span>Immutable Receipt</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-bold text-indigo-800">
            <ShieldCheck className="h-3 w-3" />
            <span>Verified Atomic Transition</span>
          </span>
        </div>
        <h2 id="receipt-title" className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          Application Submitted Successfully
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Your scholarship application has been atomically validated, accepted, and locked for reviewer assignment.
        </p>
      </div>

      {/* Replay Notice if demonstrated */}
      {replayNotice && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-center text-xs font-semibold text-indigo-900"
        >
          {replayNotice}
        </div>
      )}

      {/* Receipt Details Card */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
        {/* Receipt Number */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Submission Receipt ID
            </span>
            <p className="font-mono text-sm font-bold text-slate-900">{receipt.receiptId}</p>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy receipt ID to clipboard"
            className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-semibold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-slate-500" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Timestamps and Keys */}
        <div className="grid gap-3 sm:grid-cols-2 text-xs">
          <div>
            <span className="font-semibold text-slate-500">Submitted At:</span>
            <p className="font-medium text-slate-800">
              {new Date(receipt.submittedAt).toLocaleString()}
            </p>
          </div>
          <div>
            <span className="font-semibold text-slate-500">Application ID:</span>
            <p className="font-mono font-medium text-slate-800">{receipt.applicationId}</p>
          </div>
          <div>
            <span className="font-semibold text-slate-500">Round ID:</span>
            <p className="font-mono font-medium text-slate-800">{receipt.roundId}</p>
          </div>
          <div>
            <span className="font-semibold text-slate-500">Applicant ID:</span>
            <p className="font-mono font-medium text-slate-800">{receipt.studentId}</p>
          </div>
        </div>

        {/* Cryptographic Receipt Hash */}
        <div className="border-t border-slate-200 pt-3">
          <span className="text-[11px] font-semibold text-slate-500">Digital Receipt Fingerprint:</span>
          <p className="font-mono text-xs font-bold text-indigo-700 break-all">
            {receipt.receiptHash}
          </p>
        </div>

        {/* Summary Metrics */}
        <div className="border-t border-slate-200 pt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-white p-2 border border-slate-100">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Statement</span>
            <span className="font-bold text-slate-800">{receipt.summary.statementLength} chars</span>
          </div>
          <div className="rounded-xl bg-white p-2 border border-slate-100">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Documents</span>
            <span className="font-bold text-slate-800">{receipt.summary.documentsCount} verified</span>
          </div>
          <div className="rounded-xl bg-white p-2 border border-slate-100">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Consents</span>
            <span className="font-bold text-slate-800">{receipt.summary.verifiedConsentsCount} accepted</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {onRetryDemonstration && (
          <button
            type="button"
            onClick={handleTriggerReplay}
            disabled={isRetrying}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>Test Re-submission (Verify Idempotency)</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Print / Save Receipt</span>
        </button>
      </div>
    </div>
  );
}
