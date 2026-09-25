'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Globe,
  Lock,
  ShieldCheck,
  X,
} from 'lucide-react';
import { computeUtcInstant, evaluateDeadlineChange } from '../domain';
import { mockSubmittedApplications } from '../fixtures';
import type { ApplicationWindow, UpdateWindowPayload } from '../types';

interface DeadlineChangePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  window: ApplicationWindow;
  onConfirmUpdate: (payload: UpdateWindowPayload) => Promise<void>;
  isUpdating?: boolean;
}

export function DeadlineChangePreviewModal({
  isOpen,
  onClose,
  window: appWindow,
  onConfirmUpdate,
  isUpdating = false,
}: DeadlineChangePreviewModalProps) {
  const [newCloseDate, setNewCloseDate] = useState(appWindow.closeDate);
  const [newCloseTime, setNewCloseTime] = useState(appWindow.closeTime);
  const [changeReason, setChangeReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setNewCloseDate(appWindow.closeDate);
    setNewCloseTime(appWindow.closeTime);
    setChangeReason('');
    setErrorMsg(null);
  }, [appWindow, isOpen]);

  // Compute proposed UTC boundary
  const proposedCloseUtc = React.useMemo(() => {
    try {
      return computeUtcInstant(newCloseDate, newCloseTime, appWindow.timeZone);
    } catch {
      return null;
    }
  }, [newCloseDate, newCloseTime, appWindow.timeZone]);

  // Assess impact on submitted applications
  const assessment = React.useMemo(() => {
    if (!proposedCloseUtc) return null;
    return evaluateDeadlineChange(appWindow, proposedCloseUtc, mockSubmittedApplications);
  }, [appWindow, proposedCloseUtc]);

  // Keyboard navigation: Escape key closes modal
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeReason.trim()) {
      setErrorMsg('A brief reason for changing the deadline is required for the audit log.');
      return;
    }
    if (!proposedCloseUtc) {
      setErrorMsg('Invalid proposed date or time format.');
      return;
    }

    try {
      await onConfirmUpdate({
        id: appWindow.id,
        closeDate: newCloseDate,
        closeTime: newCloseTime,
        changeReason: changeReason.trim(),
      });
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update deadline.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="deadline-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="deadline-modal-title" className="text-xl font-bold text-slate-900">
              Adjust Program Deadline
            </h2>
            <p className="text-xs text-slate-500">
              Modify the closing deadline window with historical grandfathering protection.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {errorMsg && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {errorMsg}
            </div>
          )}

          {/* Current vs Proposed Inputs */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Current Deadline ({appWindow.timeZone})
              </span>
              <p className="font-semibold text-slate-800 text-sm">
                {appWindow.closeDate} at {appWindow.closeTime}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                UTC: {new Date(appWindow.closeInstantUtc).toUTCString()}
              </p>
            </div>

            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 block">
                Proposed Deadline ({appWindow.timeZone})
              </span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  required
                  value={newCloseDate}
                  onChange={(e) => setNewCloseDate(e.target.value)}
                  aria-label="Proposed deadline date"
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="time"
                  required
                  value={newCloseTime}
                  onChange={(e) => setNewCloseTime(e.target.value)}
                  aria-label="Proposed deadline time"
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {proposedCloseUtc && (
                <p className="text-[11px] text-indigo-800 font-medium">
                  UTC: {new Date(proposedCloseUtc).toUTCString()}
                </p>
              )}
            </div>
          </div>

          {/* Grandfathering Invariant & Assessment Banner */}
          {assessment && (
            <div
              role="region"
              aria-labelledby="grandfathering-heading"
              className={`rounded-2xl border p-4 text-xs ${
                assessment.isShortened
                  ? 'border-amber-200 bg-amber-50/80 text-amber-950'
                  : 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
              }`}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-600 shrink-0" />
                <h3 id="grandfathering-heading" className="font-bold text-sm">
                  Historical Invariance Guarantee: Zero Silent Invalidation
                </h3>
              </div>

              <p className="mt-1.5 leading-relaxed">
                {assessment.warningMessage ??
                  'This deadline change extends the application window safely for all applicants.'}
              </p>

              {assessment.affectedApplicationsCount > 0 && (
                <div className="mt-3 rounded-xl border border-amber-300 bg-white/90 p-3 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>
                      {assessment.affectedApplicationsCount} submitted application(s) are permanently grandfathered.
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    ID(s): {assessment.grandfatheredApplicationIds.join(', ')}.
                    These submissions were valid when submitted and will NOT be invalidated or canceled.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Reason for Change (Audit Requirement) */}
          <div>
            <label htmlFor="change-reason-input" className="block text-xs font-semibold text-slate-700">
              Reason for Deadline Modification <span className="text-red-500">*</span>
            </label>
            <p id="reason-help" className="text-[11px] text-slate-500 mb-1">
              Required for the administrative compliance and audit log.
            </p>
            <textarea
              id="change-reason-input"
              required
              rows={2}
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="e.g., Extension granted per sponsor request for regional semester alignment."
              aria-describedby="reason-help"
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUpdating}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isUpdating && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
              <span>Confirm Deadline Modification</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
