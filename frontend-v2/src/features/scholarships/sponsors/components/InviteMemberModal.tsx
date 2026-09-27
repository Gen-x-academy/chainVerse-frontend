'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Clock,
  Coins,
  FileCheck,
  Layers,
  Mail,
  Shield,
  X,
} from 'lucide-react';
import {
  SPONSOR_ROLE_DEFINITIONS,
  type InviteMemberPayload,
  type SponsorTeamRole,
} from '../types';
import { validateInvitePayload } from '../domain';

export interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: InviteMemberPayload) => Promise<boolean>;
  isSubmitting?: boolean;
}

const AVAILABLE_ROLES: { role: SponsorTeamRole; icon: React.ElementType }[] = [
  { role: 'finance', icon: Coins },
  { role: 'program', icon: Layers },
  { role: 'reviewer', icon: FileCheck },
  { role: 'reporting', icon: BarChart3 },
];

export function InviteMemberModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}: InviteMemberModalProps) {
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const descId = `${dialogId}-desc`;
  const modalRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<SponsorTeamRole>('program');
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setRole('program');
      setExpiresInDays(7);
      setNote('');
      setErrors({});
      setTimeout(() => initialFocusRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle Escape key to close
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

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: InviteMemberPayload = {
      email,
      role,
      expiresInDays,
      note: note.trim() || undefined,
    };

    const validation = validateInvitePayload(payload);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    const success = await onSubmit(payload);
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
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Mail className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id={titleId} className="text-lg font-bold text-slate-900">
                Invite Team Member
              </h2>
              <p id={descId} className="text-xs text-slate-500">
                Grant least-privilege access to finance, program, review, or reporting members.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-6 space-y-5" noValidate>
          {/* Email Address */}
          <div>
            <label htmlFor={`${dialogId}-email`} className="block text-sm font-semibold text-slate-700">
              Recipient Email Address <span className="text-rose-500">*</span>
            </label>
            <div className="relative mt-1">
              <input
                ref={initialFocusRef}
                id={`${dialogId}-email`}
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) {
                    setErrors((prev) => ({ ...prev, email: '' }));
                  }
                }}
                placeholder="colleague@organization.org"
                aria-required="true"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? `${dialogId}-email-error` : undefined}
                className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                  errors.email
                    ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200 bg-rose-50/20'
                    : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100'
                }`}
              />
            </div>
            {errors.email && (
              <p id={`${dialogId}-email-error`} className="mt-1 flex items-center gap-1 text-xs text-rose-600">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{errors.email}</span>
              </p>
            )}
          </div>

          {/* Role Selection (Least-Privilege Cards) */}
          <fieldset className="space-y-2">
            <legend className="block text-sm font-semibold text-slate-700">
              Select Role (Least-Privilege Access) <span className="text-rose-500">*</span>
            </legend>
            <p className="text-xs text-slate-500">
              Each role only receives the exact permissions needed for its operational responsibilities.
            </p>

            <div className="grid gap-2.5 sm:grid-cols-2 pt-1">
              {AVAILABLE_ROLES.map(({ role: r, icon: Icon }) => {
                const def = SPONSOR_ROLE_DEFINITIONS[r];
                const isSelected = role === r;
                return (
                  <label
                    key={r}
                    htmlFor={`${dialogId}-role-${r}`}
                    className={`flex flex-col gap-1.5 rounded-xl border p-3.5 cursor-pointer transition ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${isSelected ? 'text-indigo-600' : 'text-slate-500'}`} aria-hidden="true" />
                        <span className={`text-sm font-semibold ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                          {def.title}
                        </span>
                      </div>
                      <input
                        id={`${dialogId}-role-${r}`}
                        type="radio"
                        name="sponsorRole"
                        value={r}
                        checked={isSelected}
                        onChange={() => setRole(r)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                      />
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {def.description}
                    </p>
                    <div className="mt-1 border-t border-slate-100 pt-1 text-[11px] text-slate-500 italic">
                      Scope: {def.leastPrivilegeScope}
                    </div>
                  </label>
                );
              })}
            </div>
            {errors.role && (
              <p className="mt-1 flex items-center gap-1 text-xs text-rose-600">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{errors.role}</span>
              </p>
            )}
          </fieldset>

          {/* Expiration Duration */}
          <div>
            <label htmlFor={`${dialogId}-expiry`} className="block text-sm font-semibold text-slate-700">
              Invitation Expiration Window
            </label>
            <div className="mt-1 flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
              <select
                id={`${dialogId}-expiry`}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value={1}>Expires in 24 hours (1 day - High urgency)</option>
                <option value={7}>Expires in 7 days (Recommended)</option>
                <option value={14}>Expires in 14 days (2 weeks)</option>
                <option value={30}>Expires in 30 days (1 month)</option>
              </select>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Unaccepted invitations automatically expire once this window lapses. Single-use only.
            </p>
          </div>

          {/* Note / Audit context */}
          <div>
            <label htmlFor={`${dialogId}-note`} className="block text-sm font-semibold text-slate-700">
              Internal Note / Audit Reason <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              id={`${dialogId}-note`}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Assigned to Q4 engineering cohort application review"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition"
            >
              {isSubmitting ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
                  <span>Sending Invitation...</span>
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  <span>Send Invitation</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
