'use client';

import React, { useState } from 'react';
import { Modal } from '@/src/shared/components/ui/Modal';
import { getAvailableTransitions, STATUS_LABELS } from '../utils/book-lifecycle';
import type { BookStatus, BookStatusTransition } from '../types/book.types';
import { cn } from '@/lib/utils';

export interface BookStatusControlsProps {
  status: BookStatus;
  version: number;
  onTransition: (to: BookStatus) => void | Promise<void>;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

export function BookStatusControls({
  status,
  version,
  onTransition,
  loading = false,
  error = null,
  className,
}: BookStatusControlsProps) {
  const transitions = getAvailableTransitions(status);
  const [pending, setPending] = useState<BookStatusTransition | null>(null);

  const confirm = async () => {
    if (!pending) return;
    await onTransition(pending.to);
    setPending(null);
  };

  return (
    <div className={cn('border rounded-lg p-4 bg-white', className)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Lifecycle status</p>
          <p className="text-lg font-semibold text-gray-900" data-testid="book-status">
            {STATUS_LABELS[status]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Status transitions">
          {transitions.length === 0 ? (
            <p className="text-sm text-gray-400">No transitions available.</p>
          ) : (
            transitions.map((t) => (
              <button
                key={t.to}
                type="button"
                disabled={loading}
                title={t.description}
                aria-label={`${t.label}: ${t.description}`}
                onClick={() => setPending(t)}
                className="text-sm px-3 py-1.5 border rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                {t.label}
              </button>
            ))
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 mt-3">
          {error}
        </p>
      )}

      <Modal
        isOpen={pending !== null}
        onClose={() => setPending(null)}
        title={pending ? `Confirm: ${pending.label}` : undefined}
      >
        {pending && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{pending.confirmMessage}</p>
            <p className="text-xs text-gray-400">
              Current status: {STATUS_LABELS[status]} · Version {version}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void confirm()}
                disabled={loading}
                className="flex-1 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg disabled:opacity-50"
              >
                {loading ? 'Updating…' : `Confirm ${pending.label.toLowerCase()}`}
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="flex-1 px-4 py-2 text-sm border rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
