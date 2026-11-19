import { useEffect, useMemo, useState } from 'react';

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

const Pagination = ({ currentPage, totalPages, onPageChange }: PaginationProps) => {
  const safeTotal = Math.max(1, Math.floor(totalPages) || 1);
  const safeCurrent = Math.min(Math.max(1, Math.floor(currentPage) || 1), safeTotal);

  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const query = window.matchMedia('(max-width: 640px)');
    const update = () => setIsCompact(query.matches);
    update();
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', update);
      return () => query.removeEventListener('change', update);
    }
    // Fallback for older browsers
    query.addListener(update);
    return () => query.removeListener(update);
  }, []);

  const pageItems = useMemo<(number | 'ellipsis')[]>(() => {
    const windowSize = isCompact ? 1 : 2;
    const pages: (number | 'ellipsis')[] = [];

    if (safeTotal <= (isCompact ? 5 : 7)) {
      for (let i = 1; i <= safeTotal; i += 1) {
        pages.push(i);
      }
      return pages;
    }

    const left = Math.max(2, safeCurrent - windowSize);
    const right = Math.min(safeTotal - 1, safeCurrent + windowSize);

    pages.push(1);
    if (left > 2) {
      pages.push('ellipsis');
    }
    for (let i = left; i <= right; i += 1) {
      pages.push(i);
    }
    if (right < safeTotal - 1) {
      pages.push('ellipsis');
    }
    pages.push(safeTotal);

    return pages;
  }, [isCompact, safeCurrent, safeTotal]);

  const goTo = (page: number) => {
    const next = Math.min(Math.max(1, page), safeTotal);
    if (next !== safeCurrent) {
      onPageChange(next);
    }
  };

  const isFirst = safeCurrent <= 1;
  const isLast = safeCurrent >= safeTotal;

  return (
    <nav aria-label="Pagination" className="mt-4">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => goTo(safeCurrent - 1)}
          disabled={isFirst}
          aria-label="Go to previous page"
          aria-disabled={isFirst}
          className="px-3 py-1 border rounded disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Prev
        </button>

        <ul className="flex flex-wrap items-center justify-center gap-2 list-none p-0 m-0">
          {pageItems.map((item, index) => {
            if (item === 'ellipsis') {
              return (
                <li key={`ellipsis-${index}`} aria-hidden="true">
                  <span className="px-2 py-1 text-gray-500 select-none">…</span>
                </li>
              );
            }
            const isActive = item === safeCurrent;
            return (
              <li key={item}>
                <button
                  type="button"
                  onClick={() => goTo(item)}
                  aria-label={`Go to page ${item}`}
                  aria-current={isActive ? 'page' : undefined}
                  className={`px-3 py-1 border rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    isActive ? 'bg-blue-500 text-white' : ''
                  }`}
                >
                  {item}
                </button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => goTo(safeCurrent + 1)}
          disabled={isLast}
          aria-label="Go to next page"
          aria-disabled={isLast}
          className="px-3 py-1 border rounded disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Next
        </button>
      </div>

      <p aria-live="polite" className="sr-only">
        {`Page ${safeCurrent} of ${safeTotal}`}
      </p>
    </nav>
  );
};

export default Pagination;