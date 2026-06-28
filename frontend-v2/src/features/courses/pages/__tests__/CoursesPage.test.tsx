import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CoursesPage } from '../CoursesPage';

// Mock useCourses to return 13 courses (enough for 3 pages at 6/page)
// Mix levels so filtering by Beginner still leaves multiple pages worth
const mockCourses = Array.from({ length: 13 }, (_, i) => ({
  id: String(i + 1),
  title: `Course ${i + 1}`,
  category: i % 2 === 0 ? 'Blockchain' : 'DeFi',
  level: 'Beginner',
  price: 10,
}));

vi.mock('../../hooks', () => ({
  useCourses: () => ({ courses: mockCourses, isLoading: false, error: null }),
}));

// SectionContainer is a layout wrapper — keep it simple
vi.mock('@/src/shared/components/layout/SectionContainer', () => ({
  SectionContainer: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

describe('CoursesPage — pagination reset on filter change (#606)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page 1 by default', () => {
    render(<CoursesPage />);
    const page1Button = screen.getByRole('button', { name: /go to page 1/i });
    expect(page1Button).toHaveAttribute('aria-current', 'page');
  });

  it('resets to page 1 when search query changes', async () => {
    const user = userEvent.setup();
    render(<CoursesPage />);

    // Navigate to page 2
    await user.click(screen.getByRole('button', { name: /go to page 2/i }));
    expect(screen.getByRole('button', { name: /go to page 2/i })).toHaveAttribute('aria-current', 'page');

    // Change search query — should reset to page 1
    const searchInput = screen.getByPlaceholderText(/search courses/i);
    await user.type(searchInput, 'Course');

    expect(screen.getByRole('button', { name: /go to page 1/i })).toHaveAttribute('aria-current', 'page');
  });

  it('resets to page 1 when level filter changes', async () => {
    const user = userEvent.setup();
    render(<CoursesPage />);

    // Navigate to page 2
    await user.click(screen.getByRole('button', { name: /go to page 2/i }));
    expect(screen.getByRole('button', { name: /go to page 2/i })).toHaveAttribute('aria-current', 'page');

    // Select "Beginner" — keeps all courses visible, should reset to page 1
    const beginnerRadio = screen.getByRole('radio', { name: 'Beginner' });
    await user.click(beginnerRadio);

    expect(screen.getByRole('button', { name: /go to page 1/i })).toHaveAttribute('aria-current', 'page');
  });

  it('resets to page 1 when a category filter is toggled', async () => {
    const user = userEvent.setup();
    render(<CoursesPage />);

    // Navigate to page 2
    await user.click(screen.getByRole('button', { name: /go to page 2/i }));
    expect(screen.getByRole('button', { name: /go to page 2/i })).toHaveAttribute('aria-current', 'page');

    // Toggle a category — should reset to page 1
    const blockchainCheckbox = screen.getByRole('checkbox', { name: 'Blockchain' });
    await user.click(blockchainCheckbox);

    expect(screen.getByRole('button', { name: /go to page 1/i })).toHaveAttribute('aria-current', 'page');
  });
});
