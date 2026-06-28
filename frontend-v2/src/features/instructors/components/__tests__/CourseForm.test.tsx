import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CourseForm } from '../CourseForm';

const noop = () => {};

describe('CourseForm — delete confirmation', () => {
  it('does not show the confirm modal initially', () => {
    render(<CourseForm isEditing onSubmit={noop} onDelete={noop} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the confirmation modal when Delete is clicked', () => {
    render(<CourseForm isEditing onSubmit={noop} onDelete={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/are you sure you want to delete this course/i)).toBeTruthy();
  });

  it('closes the modal without calling onDelete when Cancel is clicked', () => {
    const onDelete = vi.fn();
    render(<CourseForm isEditing onSubmit={noop} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('calls onDelete and closes modal when Delete is confirmed', async () => {
    const onDelete = vi.fn();
    render(<CourseForm isEditing onSubmit={noop} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    // click the Delete button inside the modal
    const modalDeleteBtn = screen.getAllByRole('button', { name: /^delete$/i }).find(
      (btn) => btn.closest('[role="dialog"]')
    );
    fireEvent.click(modalDeleteBtn!);
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not render Delete button when isEditing is false', () => {
    render(<CourseForm isEditing={false} onSubmit={noop} />);
    expect(screen.queryByRole('button', { name: /^delete$/i })).toBeNull();
  });
});
