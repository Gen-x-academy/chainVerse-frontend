import type { TransactionStatus } from '../types';

type Props = {
  status: TransactionStatus;
  className?: string;
};

const STYLES: Record<TransactionStatus, string> = {
  submitted: 'bg-blue-100 text-blue-800',
  pending: 'bg-amber-100 text-amber-800',
  successful: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
  expired: 'bg-slate-100 text-slate-600',
  reversed: 'bg-purple-100 text-purple-800',
};

const LABELS: Record<TransactionStatus, string> = {
  submitted: 'Submitted',
  pending: 'Pending',
  successful: 'Successful',
  failed: 'Failed',
  expired: 'Expired',
  reversed: 'Reversed',
};

export function TransactionStatusBadge({ status, className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]} ${className}`}
      aria-label={`Transaction status: ${LABELS[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}

export default TransactionStatusBadge;
