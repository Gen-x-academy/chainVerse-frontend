'use client';

/** Shared accessible state notices for the integrity workspace. */
export function LoadingState({ label = 'Loading records' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="rounded border border-gray-200 p-4 text-sm text-gray-600">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" aria-hidden="true" /> {label}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-dashed border-gray-300 p-6 text-center">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-600">{children}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-800">
      <p>{message}</p>
      <button type="button" onClick={onRetry} className="mt-2 rounded bg-red-800 px-3 py-1 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
        Try again
      </button>
    </div>
  );
}

export function ConflictState({ message, onRefresh }: { message: string; onRefresh: () => void }) {
  return (
    <div role="alert" className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <p>{message} Reload the latest version before retrying.</p>
      <button type="button" onClick={onRefresh} className="mt-2 rounded bg-amber-900 px-3 py-1 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
        Refresh latest version
      </button>
    </div>
  );
}

export function SuccessState({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" aria-live="polite" className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
      {children}
    </p>
  );
}
