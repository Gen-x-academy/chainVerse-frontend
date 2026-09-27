'use client';

import type { WcagStatus } from '../types';

const STATUS_TEXT: Record<WcagStatus, string> = {
  pass: 'Pass',
  fail: 'Fail',
  untested: 'Untested',
  'not-applicable': 'Not applicable',
};

/**
 * Status is never conveyed by colour alone: each badge carries a glyph and a
 * word, and the word is what screen readers announce.
 */
const STATUS_GLYPH: Record<WcagStatus, string> = {
  pass: '✓',
  fail: '✕',
  untested: '—',
  'not-applicable': 'n/a',
};

const STATUS_CLASS: Record<WcagStatus, string> = {
  pass: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  fail: 'border-red-300 bg-red-50 text-red-800',
  untested: 'border-slate-300 bg-slate-100 text-slate-700',
  'not-applicable': 'border-slate-200 bg-white text-slate-500',
};

export type A11yStatusBadgeProps = {
  status: WcagStatus;
  /** Criterion id, so the badge reads sensibly out of table context. */
  criterionId?: string;
};

export function A11yStatusBadge({ status, criterionId }: A11yStatusBadgeProps) {
  const label = criterionId ? `${criterionId}: ${STATUS_TEXT[status]}` : STATUS_TEXT[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[status]}`}
      data-status={status}
    >
      <span aria-hidden="true">{STATUS_GLYPH[status]}</span>
      <span>{label}</span>
    </span>
  );
}
