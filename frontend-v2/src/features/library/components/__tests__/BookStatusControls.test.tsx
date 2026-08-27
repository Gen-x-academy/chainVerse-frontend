import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookStatusControls } from '../BookStatusControls';

describe('BookStatusControls', () => {
  it('displays current status', () => {
    render(
      <BookStatusControls status="draft" version={1} onTransition={vi.fn()} />
    );
    expect(screen.getByTestId('book-status')).toHaveTextContent('Draft');
  });

  it('shows only valid transitions for draft', () => {
    render(
      <BookStatusControls status="draft" version={1} onTransition={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: /publish/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /archive/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /withdraw/i })).not.toBeInTheDocument();
  });

  it('requires confirmation naming downstream effects', async () => {
    const user = userEvent.setup();
    render(
      <BookStatusControls status="draft" version={1} onTransition={vi.fn()} />
    );
    await user.click(screen.getByRole('button', { name: /publish/i }));
    expect(screen.getByText(/expose this title in patron search/i)).toBeInTheDocument();
  });

  it('calls onTransition after confirmation', async () => {
    const user = userEvent.setup();
    const onTransition = vi.fn();
    render(
      <BookStatusControls status="draft" version={1} onTransition={onTransition} />
    );
    await user.click(screen.getByRole('button', { name: /publish/i }));
    await user.click(screen.getByRole('button', { name: /confirm publish/i }));
    await waitFor(() => {
      expect(onTransition).toHaveBeenCalledWith('published');
    });
  });

  it('shows error state', () => {
    render(
      <BookStatusControls
        status="published"
        version={2}
        onTransition={vi.fn()}
        error="Transition not allowed"
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Transition not allowed');
  });
});
