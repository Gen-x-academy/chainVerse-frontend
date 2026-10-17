'use client';

/** Visual mapping for every mentor availability status. */
const STATUS_STYLES: Record<string, string> = {
  accepting_requests: 'bg-green-100 text-green-700',
  limited_availability: 'bg-blue-100 text-blue-700',
  waitlist_only: 'bg-amber-100 text-amber-700',
  temporarily_unavailable: 'bg-orange-100 text-orange-700',
  inactive: 'bg-gray-100 text-gray-600',
};

export function AvailabilityStatusBadge({
  status,
}: {
  status: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'
      }`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
