import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CoursesPage } from '../CoursesPage';

// 13 courses → 3 pages at 6/page. Mixed categories, levels, and titles for filter tests.
const mockCourses = Array.from({ length: 13 }, (_, i) => {
  const index = i + 1;
  let category = 'NFTs';
  let level = 'Beginner';
  let title = `Course ${index}`;

  if (index <= 7) {
    category = 'Blockchain';
    level = 'Beginner';
  } else if (index <= 10) {
    category = 'DeFi';
    level = 'Intermediate';
  } else {
    category = 'Smart Contracts';
    level = 'Advanced';
    title = `Advanced Soroban ${index}`;
  }

  return {
    id: String(index),
    title,
    category,
    level,
    price: 10,
  };
});

vi.mock('../../hooks', () => ({
  useCourses: () => ({ courses: mockCourses, isLoading: false, error: null }),
}));

vi.mock('@/src/shared/components/layout/SectionContainer', () => ({
  SectionContainer: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

describe('CoursesPage — filter logic correctness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all mock courses initially (first page)', () => {
    render(<CoursesPage />);

    // Page 1 shows the first 6 courses (COURSES_PER_PAGE)
    for (let i = 1; i <= 6; i++) {
      expect(screen.getByRole('heading', { name: `Course ${i}` })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: /go to page 1/i })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('button', { name: /go to page 2/i })).toBeInTheDocument();
  });

  it('filters courses by title when typing in the search box', async () => {
    const user = userEvent.setup();
    render(<CoursesPage />);

    await user.type(screen.getByPlaceholderText(/search courses/i), 'Advanced Soroban');

    expect(screen.getByRole('heading', { name: 'Advanced Soroban 11' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Advanced Soroban 12' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Advanced Soroban 13' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Course 1' })).not.toBeInTheDocument();
  });

  it('shows only matching courses when a category is selected', async () => {
    const user = userEvent.setup();
    render(<CoursesPage />);

    await user.click(screen.getByRole('checkbox', { name: 'DeFi' }));

    expect(screen.getByRole('heading', { name: 'Course 8' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Course 9' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Course 10' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Course 1' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Advanced Soroban/i })).not.toBeInTheDocument();
  });

  it("shows only advanced courses when 'Advanced' level is selected", async () => {
    const user = userEvent.setup();
    render(<CoursesPage />);

    await user.click(screen.getByRole('radio', { name: 'Advanced' }));

    expect(screen.getByRole('heading', { name: 'Advanced Soroban 11' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Advanced Soroban 12' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Advanced Soroban 13' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Course 1' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Course 8' })).not.toBeInTheDocument();
  });

  it('resets pagination to page 1 when a filter changes', async () => {
    const user = userEvent.setup();
    render(<CoursesPage />);

    await user.click(screen.getByRole('button', { name: /go to page 2/i }));
    expect(screen.getByRole('button', { name: /go to page 2/i })).toHaveAttribute(
      'aria-current',
      'page'
    );

    await user.type(screen.getByPlaceholderText(/search courses/i), 'Course');

    expect(screen.getByRole('button', { name: /go to page 1/i })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});
