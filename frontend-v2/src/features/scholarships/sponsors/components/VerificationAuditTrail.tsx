'use client';

import React from 'react';
import {
  CheckCircle2,
  Clock,
  FileCheck,
  History,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react';
import type { SponsorVerificationAction, SponsorVerificationAuditEvent } from '../types';

export interface VerificationAuditTrailProps {
  events: SponsorVerificationAuditEvent[];
  isLoading?: boolean;
  className?: string;
}

const ACTION_LABELS: Record<
  SponsorVerificationAction,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  'profile.created': {
    label: 'Organization Profile Created',
    icon: History,
    color: 'text-slate-600 bg-slate-100',
  },
  'profile.updated': {
    label: 'Profile Information Updated',
    icon: History,
    color: 'text-indigo-600 bg-indigo-50',
  },
  'verification.requested': {
    label: 'Official Verification Requested',
    icon: Clock,
    color: 'text-amber-600 bg-amber-50',
  },
  'verification.approved': {
    label: 'Verification Approved',
    icon: CheckCircle2,
    color: 'text-emerald-600 bg-emerald-50',
  },
  'verification.rejected': {
    label: 'Verification Rejected',
    icon: XCircle,
    color: 'text-rose-600 bg-rose-50',
  },
  'verification.revoked': {
    label: 'Verification Revoked',
    icon: ShieldAlert,
    color: 'text-rose-700 bg-rose-100',
  },
  'verification.tier_updated': {
    label: 'Compliance Tier Adjusted',
    icon: ShieldCheck,
    color: 'text-purple-600 bg-purple-50',
  },
  'verification.document_uploaded': {
    label: 'Compliance Document Uploaded',
    icon: FileCheck,
    color: 'text-blue-600 bg-blue-50',
  },
  'verification.document_reviewed': {
    label: 'Compliance Document Reviewed',
    icon: UserCheck,
    color: 'text-indigo-600 bg-indigo-50',
  },
};

export function VerificationAuditTrail({
  events = [],
  isLoading = false,
  className = '',
}: VerificationAuditTrailProps) {
  if (isLoading) {
    return (
      <div
        role="status"
        aria-busy="true"
        className="rounded-2xl border border-slate-200 bg-white p-6 text-center"
      >
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mx-auto" />
        <span className="mt-2 block text-xs text-slate-500">Loading verification audit trail...</span>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Verification audit log"
      className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4 ${className}`}
    >
      <div className="border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-indigo-600 shrink-0" aria-hidden="true" />
          <h3 className="text-sm font-bold text-slate-900">Verification Audit Trail</h3>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          Immutable cryptographic log of all compliance requests, approvals, and credentials.
        </p>
      </div>

      {events.length === 0 ? (
        <div role="status" className="rounded-xl border border-slate-100 bg-slate-50 p-6 text-center">
          <p className="text-xs text-slate-500">No verification events recorded yet.</p>
        </div>
      ) : (
        <ol className="relative border-l border-slate-200 ml-3 space-y-4">
          {events.map((event) => {
            const meta = ACTION_LABELS[event.action] || {
              label: event.action,
              icon: History,
              color: 'text-slate-600 bg-slate-100',
            };
            const Icon = meta.icon;

            return (
              <li key={event.id} className="ml-6 space-y-1">
                <span
                  className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white ${meta.color}`}
                >
                  <Icon className="h-3 w-3" aria-hidden="true" />
                </span>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h4 className="text-xs font-bold text-slate-900">{meta.label}</h4>
                  <time className="text-[11px] text-slate-400 font-mono">
                    {new Date(event.occurredAt).toLocaleString()}
                  </time>
                </div>

                <p className="text-xs text-slate-600">
                  By <strong className="text-slate-800">{event.actorEmail}</strong> ({event.actorRole})
                  {event.newStatus && (
                    <span>
                      {' '}&bull; Status: <span className="font-semibold">{event.newStatus}</span>
                    </span>
                  )}
                  {event.newTier && (
                    <span>
                      {' '}&bull; Tier: <span className="font-semibold">{event.newTier}</span>
                    </span>
                  )}
                </p>

                {event.reason && (
                  <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 italic">
                    &ldquo;{event.reason}&rdquo;
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
