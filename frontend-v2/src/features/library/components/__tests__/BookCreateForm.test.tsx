import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookCreateForm } from '../BookCreateForm';

describe('BookCreateForm', () => {
  it('renders bibliographic step by default', () => {
    render(<BookCreateForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByText('Bibliographic metadata')).toBeInTheDocument();
  });

  it('preserves draft values when validation fails', async () => {
    const user = userEvent.setup();
    render(<BookCreateForm onSubmit={vi.fn()} />);

    await user.type(screen.getByLabelText(/title/i), 'My Test Book');
    await user.type(
      screen.getByLabelText(/description/i),
      'A long enough description for validation to pass on this step.'
    );
    await user.type(screen.getByLabelText(/language/i), 'en');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText('Contributors')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByLabelText(/title/i)).toHaveValue('My Test Book');
  });

  it('maps server field errors to controls', () => {
    render(
      <BookCreateForm
        onSubmit={vi.fn()}
        serverFieldErrors={{ 'bibliographic.title': 'Title already exists in catalog' }}
      />
    );
    expect(screen.getByText('Title already exists in catalog')).toBeInTheDocument();
  });

  it('shows server field errors without clearing user input', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <BookCreateForm onSubmit={vi.fn()} serverFieldErrors={{}} />
    );
    await user.type(screen.getByLabelText(/title/i), 'Persisted Title');
    rerender(
      <BookCreateForm
        onSubmit={vi.fn()}
        serverFieldErrors={{ 'bibliographic.title': 'Duplicate title' }}
      />
    );
    expect(screen.getByLabelText(/title/i)).toHaveValue('Persisted Title');
    expect(screen.getByText('Duplicate title')).toBeInTheDocument();
  });
});
