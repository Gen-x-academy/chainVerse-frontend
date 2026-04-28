import { render, screen } from '@testing-library/react';
import { CourseCardSkeleton } from '../CourseCardSkeleton';

describe('CourseCardSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<CourseCardSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it('applies animate-pulse class for loading indication', () => {
    const { container } = render(<CourseCardSkeleton />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders three skeleton placeholder blocks', () => {
    const { container } = render(<CourseCardSkeleton />);
    const placeholders = container.querySelectorAll('.bg-gray-300');
    expect(placeholders.length).toBe(3);
  });
});
