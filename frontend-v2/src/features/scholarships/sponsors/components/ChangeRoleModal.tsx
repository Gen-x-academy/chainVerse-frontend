'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, ShieldAlert, X } from 'lucide-react';
import {
  SPONSOR_ROLE_DEFINITIONS,
  type SponsorTeamMember,
  type SponsorTeamRole,
  type UpdateMemberRolePayload,
} from '../types';

export interface ChangeRoleModalProps {
  isOpen: boolean;
  member: SponsorTeamMember | null;
  onClose: () => void;
  onSubmit: (payload: UpdateMemberRolePayload) => Promise<boolean>;
  isSubmitting?: boolean;
}

const ALL_ROLES: SponsorTeamRole[] = ['owner', 'finance', 'program', 'reviewer', 'reporting'];

export function ChangeRoleModal({
  isOpen,
  member,
  onClose,
  onSubmit,
  isSubmitting = false,
}: ChangeRoleModalProps) {
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const descId = `${dialogId}-desc`;
  const modalRef = useRef<HTMLDivElement>(null);

  const [selectedRole, setSelectedRole] = useState<SponsorTeamRole>('reviewer');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      setSelectedRole(member.role);
      setReason('');
      setError(null);
    }
  }, [member, isOpen]);

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

  const currentDef = SPONSOR_ROLE_DEFINITIONS[member.role];
  const newDef = SPONSOR_ROLE_DEFINITIONS[selectedRole];
  const isUnchanged = selectedRole === member.role;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isUnchanged) {
      setError('Please choose a different role.');
      return;
    }
    if (!reason.trim()) {
      setError('An audit justification reason is required for role modification.');
      return;
    }

    setError(null);
    const success = await onSubmit({
      newRole: selectedRole,
      reason: reason.trim(),
    });
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
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id={titleId} className="text-lg font-bold text-slate-900">
                Change Team Role
              </h2>
              <p id={descId} className="text-xs text-slate-500">
                Modifying role for {member.name} ({member.email})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
          <div>
            <label htmlFor={`${dialogId}-select-role`} className="block text-sm font-semibold text-slate-700">
              New Assigned Role
            </label>
            <select
              id={`${dialogId}-select-role`}
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value as SponsorTeamRole);
                setError(null);
              }}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
            >
              {ALL_ROLES.map((r) => {
                const def = SPONSOR_ROLE_DEFINITIONS[r];
                return (
                  <option key={r} value={r}>
                    {def.title} {r === member.role ? '(Current)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Role summary comparison */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-500">
              <span>Current Role: <strong>{currentDef?.title}</strong></span>
              <span>&rarr;</span>
              <span className={isUnchanged ? 'text-slate-500' : 'text-purple-700 font-semibold'}>
                New Role: <strong>{newDef?.title}</strong>
              </span>
            </div>
            <p className="text-slate-600">
              <strong>Least-Privilege Boundary:</strong> {newDef?.leastPrivilegeScope}
            </p>
          </div>

          {/* Audit Reason */}
          <div>
            <label htmlFor={`${dialogId}-reason`} className="block text-sm font-semibold text-slate-700">
              Audit Reason / Justification <span className="text-rose-500">*</span>
            </label>
            <p className="text-xs text-slate-500 mb-1">
              Role changes are permanently recorded in the immutable audit trail.
            </p>
            <textarea
              id={`${dialogId}-reason`}
              rows={2}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
              placeholder="e.g. Promoted to program director for 2026 cohort lifecycle"
              aria-required="true"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
            />
          </div>

          {error && (
            <p role="alert" className="flex items-center gap-1.5 text-xs text-rose-600">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUnchanged}
              aria-busy={isSubmitting}
              className="rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 transition"
            >
              {isSubmitting ? 'Updating Role...' : 'Confirm Role Change'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
