'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import type { SponsorTeamMember } from '../types';

export interface RemoveMemberModalProps {
  isOpen: boolean;
  member: SponsorTeamMember | null;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<boolean>;
  isRemoving?: boolean;
}

export function RemoveMemberModal({
  isOpen,
  member,
  onClose,
  onConfirm,
  isRemoving = false,
}: RemoveMemberModalProps) {
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const descId = `${dialogId}-desc`;
  const modalRef = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !member) return null;

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    const success = await onConfirm(reason.trim() || undefined);
    if (success) {
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id={titleId} className="text-lg font-bold text-slate-900">
                Remove Team Member
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleConfirm} className="p-6 space-y-4">
          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 text-xs text-rose-900 leading-relaxed">
            <p className="font-semibold text-rose-950 mb-1">
              Warning: Immediate Access Revocation
            </p>
            <p id={descId}>
              Are you sure you want to remove <strong>{member.name}</strong> ({member.email}) from this sponsor organization?
              <strong> Removed members lose access immediately.</strong> Active sessions and permissions are terminated without delay.
            </p>
          </div>

          <div>
            <label htmlFor={`${dialogId}-removal-reason`} className="block text-sm font-semibold text-slate-700">
              Reason for Removal <span className="text-slate-400 font-normal">(Optional audit note)</span>
            </label>
            <textarea
              id={`${dialogId}-removal-reason`}
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. End of term or contract departure"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isRemoving}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRemoving}
              aria-busy={isRemoving}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 disabled:opacity-50 transition"
            >
              {isRemoving ? (
                <span>Removing...</span>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span>Remove Member</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
