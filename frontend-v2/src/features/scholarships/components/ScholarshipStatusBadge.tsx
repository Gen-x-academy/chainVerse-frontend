'use client';

import React from 'react';
import type {
  AwardStatus,
  DisbursementStatus,
  ScholarshipApplicationStatus,
  ScholarshipRoundStatus,
} from '../types/scholarship.types';

type BadgeStatus =
  | ScholarshipApplicationStatus
  | ScholarshipRoundStatus
  | AwardStatus
  | DisbursementStatus;

const STYLES: Record<BadgeStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-50 text-blue-700',
  under_review: 'bg-indigo-50 text-indigo-700',
  shortlisted: 'bg-purple-50 text-purple-700',
  approved: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
  withdrawn: 'bg-gray-100 text-gray-600',
  open: 'bg-green-50 text-green-700',
  review: 'bg-amber-50 text-amber-700',
  closed: 'bg-red-50 text-red-700',
  archived: 'bg-gray-100 text-gray-600',
  pending: 'bg-amber-50 text-amber-700',
  accepted: 'bg-green-50 text-green-700',
  declined: 'bg-red-50 text-red-700',
  disbursed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-600',
  scheduled: 'bg-blue-50 text-blue-700',
  processing: 'bg-indigo-50 text-indigo-700',
  completed: 'bg-green-50 text-green-700',
  failed: 'bg-red-50 text-red-700',
};

function label(status: BadgeStatus): string {
  return status.replace(/_/g, ' ');
}

export function ScholarshipStatusBadge({ status }: { status: BadgeStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STYLES[status]}`}
    >
      {label(status)}
    </span>
  );
}