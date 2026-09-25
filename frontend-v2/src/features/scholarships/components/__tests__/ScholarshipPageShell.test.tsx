import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScholarshipPageShell } from '../ScholarshipPageShell';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/apply', label: 'Apply' },
];

describe('ScholarshipPageShell', () => {
  it('renders children when access is allowed', () => {
    render(
      <ScholarshipPageShell
        allowed
        title="Apply for Scholarships"
        activeHref="/scholarships/apply"
        navItems={NAV_ITEMS}
      >
        <p>Application content</p>
      </ScholarshipPageShell>
    );
    expect(screen.getByRole('heading', { name: 'Apply for Scholarships' })).toBeInTheDocument();
    expect(screen.getByText('Application content')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Apply' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('renders the consistent access-denied state when not allowed', () => {
    render(
      <ScholarshipPageShell
        allowed={false}
        title="Apply for Scholarships"
        activeHref="/scholarships/apply"
        navItems={NAV_ITEMS}
      >
        <p>Must not appear</p>
      </ScholarshipPageShell>
    );
    expect(screen.getByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
    expect(screen.getByText(/do not have permission to view this scholarships section/i)).toBeInTheDocument();
    expect(screen.queryByText('Must not appear')).not.toBeInTheDocument();
  });
});