import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { LibraryPagination } from '../LibraryPagination';

describe('LibraryPagination', () => {
  it('disables prev when cannot go back', () => {
    render(
      <LibraryPagination canGoBack={false} canGoNext onPrev={vi.fn()} onNext={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  });

  it('disables next when cannot go forward', () => {
    render(
      <LibraryPagination canGoBack canGoNext={false} onPrev={vi.fn()} onNext={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('calls navigation handlers on click', async () => {
    const user = userEvent.setup();
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(
      <LibraryPagination canGoBack canGoNext onPrev={onPrev} onNext={onNext} />
    );
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onNext).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it('supports keyboard arrow navigation', async () => {
    const user = userEvent.setup();
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(
      <LibraryPagination canGoBack canGoNext onPrev={onPrev} onNext={onNext} />
    );
    await user.keyboard('{ArrowRight}');
    expect(onNext).toHaveBeenCalledOnce();
    await user.keyboard('{ArrowLeft}');
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it('shows loading indicator in page label', () => {
    render(
      <LibraryPagination
        canGoBack
        canGoNext
        onPrev={vi.fn()}
        onNext={vi.fn()}
        currentPageLabel="Page 2"
        isLoading
      />
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
