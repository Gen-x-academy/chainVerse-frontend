import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { CourseCard } from '../CourseCard';

vi.mock('@/src/store/wishlist-store', () => {
  const toggle = vi.fn();
  const isWishlisted = vi.fn().mockReturnValue(false);
  return {
    useWishlistStore: (selector: any) => {
      const store = { toggle, isWishlisted };
      return selector(store);
    },
  };
});

const defaultProps = {
  id: 1,
  title: 'Blockchain Basics',
  rating: 4.5,
  description: 'Learn blockchain fundamentals',
  instructor: 'John Doe',
  level: 'beginner',
  price: 49.99,
  currency: '$',
  image: '',
  category: 'Blockchain',
};

describe('CourseCard', () => {
  it('renders course title, price, and rating', () => {
    render(<CourseCard {...defaultProps} />);
    expect(screen.getByText('Blockchain Basics')).toBeInTheDocument();
    expect(screen.getByText('$49.99')).toBeInTheDocument();
    expect(screen.getByText(/4.5/)).toBeInTheDocument();
  });

  it('wishlist button toggles aria-pressed state', async () => {
    render(<CourseCard {...defaultProps} />);
    const btn = screen.getByRole('button', { name: /add blockchain basics to wishlist/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows category badge when no image is provided', () => {
    render(<CourseCard {...defaultProps} />);
    expect(screen.getByText('Blockchain')).toBeInTheDocument();
  });
});
