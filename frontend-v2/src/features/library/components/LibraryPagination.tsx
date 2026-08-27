'use client';

import React, { useCallback, useEffect } from 'react';

export interface LibraryPaginationProps {
  canGoBack: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  currentPageLabel?: string;
  isLoading?: boolean;
  className?: string;
}

/**
 * Cursor pagination controls with keyboard navigation.
 * For lists exceeding ~200 items, pair with windowing (e.g. @tanstack/react-virtual)
 * on the parent list container — keep page size modest (24–48) and rely on cursors
 * rather than offset pagination for stable performance under filter changes.
 */
export function LibraryPagination({
  canGoBack,
  canGoNext,
  onPrev,
  onNext,
  currentPageLabel,
  isLoading = false,
  className = '',
}: LibraryPaginationProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'ArrowLeft' && canGoBack) {
        e.preventDefault();
        onPrev();
      }
      if (e.key === 'ArrowRight' && canGoNext) {
        e.preventDefault();
        onNext();
      }
    },
    [canGoBack, canGoNext, onPrev, onNext]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <nav
      className={`flex items-center justify-center gap-3 ${className}`}
      aria-label="Catalog pagination"
    >
      <button
        type="button"
        onClick={onPrev}
        disabled={!canGoBack || isLoading}
        className="rounded border px-4 py-2 text-sm disabled:opacity-50"
        aria-label="Previous page"
      >
        Previous
      </button>
      {currentPageLabel && (
        <span className="text-sm text-gray-500" aria-live="polite">
          {currentPageLabel}
          {isLoading ? ' (loading…)' : ''}
        </span>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext || isLoading}
        className="rounded border px-4 py-2 text-sm disabled:opacity-50"
        aria-label="Next page"
      >
        Next
      </button>
    </nav>
  );
}
