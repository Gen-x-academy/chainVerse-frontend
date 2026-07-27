import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CourseCard } from '../courseCard';

// ── Wishlist store mock ───────────────────────────────────────────────────────
// The store selector is called once for `toggle` and once for `isWishlisted`.
// We use a module-level toggle spy and a mutable `wishlisted` flag so tests can
// simulate the toggled state.

const toggleSpy = vi.fn();
let wishlistedState = false;

vi.mock('@/src/store/wishlist-store', () => ({
  useWishlistStore: (selector: (s: { toggle: () => void; isWishlisted: (id: string) => boolean }) => unknown) => {
    const store = {
      toggle: toggleSpy,
      isWishlisted: (_id: string) => wishlistedState,
    };
    return selector(store);
  },
}));

// ── Next/Image stub ───────────────────────────────────────────────────────────
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

// ── Default props ─────────────────────────────────────────────────────────────
const defaultProps = {
  id: 1,
  title: 'Blockchain Basics',
  rating: 4,
  description: 'Learn blockchain fundamentals',
  instructor: 'John Doe',
  level: 'beginner',
  price: 49.99,
  currency: '$',
  image: '',
  category: 'Blockchain',
};

describe('CourseCard', () => {
  beforeEach(() => {
    wishlistedState = false;
    toggleSpy.mockClear();
  });

  // #791 – renders course title, instructor, price
  it('renders course title', () => {
    render(<CourseCard {...defaultProps} />);
    expect(screen.getByText('Blockchain Basics')).toBeInTheDocument();
  });

  it('renders instructor name', () => {
    render(<CourseCard {...defaultProps} />);
    expect(screen.getByText('By John Doe')).toBeInTheDocument();
  });

  it('renders formatted price', () => {
    render(<CourseCard {...defaultProps} />);
    expect(screen.getByText('$49.99')).toBeInTheDocument();
  });

  // #791 – shows 'Free' when price is 0
  it("shows 'Free' when price is 0", () => {
    render(<CourseCard {...defaultProps} price={0} />);
    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  // #791 – wishlist button toggles aria-pressed state
  it('wishlist button has aria-pressed="false" when not wishlisted', () => {
    render(<CourseCard {...defaultProps} />);
    const btn = screen.getByRole('button', { name: /add blockchain basics to wishlist/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('wishlist button has aria-pressed="true" when wishlisted', () => {
    wishlistedState = true;
    render(<CourseCard {...defaultProps} />);
    const btn = screen.getByRole('button', { name: /remove blockchain basics from wishlist/i });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls toggle when wishlist button is clicked', async () => {
    render(<CourseCard {...defaultProps} />);
    const btn = screen.getByRole('button', { name: /add blockchain basics to wishlist/i });
    await userEvent.click(btn);
    expect(toggleSpy).toHaveBeenCalledOnce();
    expect(toggleSpy).toHaveBeenCalledWith('1');
  });

  // #791 – shows correct level badge colour
  it('applies green badge for beginner level', () => {
    render(<CourseCard {...defaultProps} level="beginner" />);
    const badge = screen.getByText('Beginner');
    expect(badge).toHaveClass('bg-green-100', 'text-green-700');
  });

  it('applies blue badge for intermediate level', () => {
    render(<CourseCard {...defaultProps} level="intermediate" />);
    const badge = screen.getByText('Intermediate');
    expect(badge).toHaveClass('bg-blue-100', 'text-blue-700');
  });

  it('applies purple badge for advanced level', () => {
    render(<CourseCard {...defaultProps} level="advanced" />);
    const badge = screen.getByText('Advanced');
    expect(badge).toHaveClass('bg-purple-100', 'text-purple-700');
  });

  // #791 – fires onAddToCart when Add button is clicked
  it('fires onAddToCart when Add button is clicked', async () => {
    const onAddToCart = vi.fn();
    render(<CourseCard {...defaultProps} onAddToCart={onAddToCart} />);
    // The button contains the ShoppingCart icon + "Add" text (hidden on mobile)
    const addBtn = screen.getByRole('button', { name: /add/i });
    await userEvent.click(addBtn);
    expect(onAddToCart).toHaveBeenCalledOnce();
  });

  it('does not throw when onAddToCart is not provided', async () => {
    render(<CourseCard {...defaultProps} />);
    const addBtn = screen.getByRole('button', { name: /add/i });
    await userEvent.click(addBtn); // should not throw
  });
});
