'use client';

import React, { useState } from 'react';

export function CapstoneLoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/50 p-4 text-sm text-gray-600"
    >
      <span
        className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}

export function CapstoneEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <div className="mt-2 text-sm text-gray-600">{description}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function CapstoneErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800"
    >
      <div className="font-medium">An error occurred</div>
      <p className="mt-1">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded bg-red-800 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function CapstoneConflictState({
  message,
  onRefresh,
}: {
  message: string;
  onRefresh: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
    >
      <div className="font-semibold">Conflict detected (stale revision)</div>
      <p className="mt-1">
        {message} The record was modified elsewhere. Please refresh to load the latest changes.
      </p>
      <button
        type="button"
        onClick={onRefresh}
        className="mt-3 rounded bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
      >
        Refresh latest version
      </button>
    </div>
  );
}

export function CapstonePermissionDeniedState({
  message = 'You are not authorized to view or edit this resource.',
}: {
  message?: string;
}) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-700"
    >
      <div className="font-semibold text-gray-900">Access Restricted</div>
      <p className="mt-1 text-gray-600">{message}</p>
    </div>
  );
}

export function CapstoneSuccessState({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800"
    >
      {children}
    </div>
  );
}

export function CapstoneConfirmationModal({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 id="confirm-modal-title" className="text-lg font-semibold text-gray-900">
          {title}
        </h3>
        <p className="mt-2 text-sm text-gray-600">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded px-3 py-1.5 text-sm font-medium text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500'
                : 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MaskedValueViewer({
  value,
  isMaskedByDefault = true,
  canReveal = false,
}: {
  value: string;
  isMaskedByDefault?: boolean;
  canReveal?: boolean;
}) {
  const [isRevealed, setIsRevealed] = useState(!isMaskedByDefault);

  return (
    <div className="flex items-center gap-2 font-mono text-sm">
      <span className="rounded bg-gray-100 px-2 py-1 text-gray-800">
        {isRevealed ? value : '••••••••••••'}
      </span>
      {canReveal && (
        <button
          type="button"
          onClick={() => setIsRevealed((prev) => !prev)}
          className="text-xs text-blue-600 underline hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {isRevealed ? 'Mask' : 'Reveal'}
        </button>
      )}
    </div>
  );
}
