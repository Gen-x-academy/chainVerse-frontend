'use client';

import React from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type { ComplianceTier, SponsorVerificationStatus } from '../types';

export interface VerificationBadgeProps {
  status?: SponsorVerificationStatus;
  tier?: ComplianceTier;
  verifiedAt?: string;
  size?: 'sm' | 'md' | 'lg';
  showTier?: boolean;
  className?: string;
}

const TIER_LABELS: Record<ComplianceTier, { label: string; badgeClass: string }> = {
  tier1_standard: {
    label: 'Tier 1 Standard',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  tier2_enhanced: {
    label: 'Tier 2 Enhanced',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  tier3_institutional: {
    label: 'Tier 3 Institutional',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
  },
};

export function VerificationBadge({
  status = 'unverified',
  tier = 'tier1_standard',
  verifiedAt,
  size = 'md',
  showTier = true,
  className = '',
}: VerificationBadgeProps) {
  const isVerified = status === 'verified';
  const isPending = status === 'pending';
  const isRejected = status === 'rejected';
  const isRevoked = status === 'revoked';

  const tierInfo = TIER_LABELS[tier] || TIER_LABELS.tier1_standard;

  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      {/* Primary Verification Status Badge */}
      {isVerified && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200"
          title={verifiedAt ? `Verified on ${new Date(verifiedAt).toLocaleDateString()}` : 'Verified Sponsor Organization'}
          aria-label="Verified sponsor organization"
        >
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
          <span>Verified Sponsor</span>
        </span>
      )}

      {isPending && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200"
          title="Verification is currently pending compliance review"
          aria-label="Verification pending compliance review"
        >
          <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
          <span>Pending Verification</span>
        </span>
      )}

      {isRejected && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200"
          title="Verification rejected. Review notes and resubmit documents."
          aria-label="Verification rejected"
        >
          <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-600" aria-hidden="true" />
          <span>Verification Rejected</span>
        </span>
      )}

      {isRevoked && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800 border border-rose-300"
          title="Sponsor verification was revoked by platform administrators."
          aria-label="Verification revoked"
        >
          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-rose-700" aria-hidden="true" />
          <span>Verification Revoked</span>
        </span>
      )}

      {!isVerified && !isPending && !isRejected && !isRevoked && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200"
          title="Unverified organization. Compliance credentials have not been submitted."
          aria-label="Unverified sponsor organization"
        >
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          <span>Unverified</span>
        </span>
      )}

      {/* Compliance Tier Badge */}
      {showTier && isVerified && (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border ${tierInfo.badgeClass}`}
          title={`Compliance Classification: ${tierInfo.label}`}
        >
          <Award className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{tierInfo.label}</span>
        </span>
      )}
    </div>
  );
}
