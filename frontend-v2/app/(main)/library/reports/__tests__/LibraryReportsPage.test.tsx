/**
 * Tests for the Library Reports page (modern reports architecture).
 *
 * Coverage goals:
 *  - Unauthenticated / no-permission users see an access-denied message and
 *    never see sensitive tab content (no flash).
 *  - Authenticated roles with the `reports` librarian permission see all three
 *    action tabs.
 *  - The condition-reports panel shows a safe "select an item" placeholder
 *    instead of shipping demo data.
 *  - Key ARIA attributes (tablist, tabs, alert) are present.
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LibraryReportsPage from '../page';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/src/store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

// Prevent real network calls from tanstack-query during tests
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({ data: null, isLoading: false, error: null }),
    useMutation: vi.fn().mockReturnValue({ mutateAsync: vi.fn(), isPending: false }),
    useQueryClient: vi.fn().mockReturnValue({ invalidateQueries: vi.fn(), setQueryData: vi.fn() }),
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

import { useAuthStore } from '@/src/store/authStore';

type MockAuthStore = ReturnType<typeof vi.fn>;

/** Sets the mocked role that `useAuthStore` will return. */
function setRole(role: 'admin' | 'instructor' | 'student' | null) {
  const storeMock = useAuthStore as unknown as MockAuthStore;
  storeMock.mockImplementation(
    (selector: (s: { user: { role: string } | null }) => unknown) =>
      selector({ user: role ? { role } : null }),
  );
}

// ── Test suites ───────────────────────────────────────────────────────────────

describe('LibraryReportsPage — authorization', () => {
  it('shows access-denied when the role has no librarian permissions (student)', () => {
    setRole('student');
    render(<LibraryReportsPage />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByText(/do not have permission to access the reports section/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /condition reports/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /repair tracking/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /lost items/i })).not.toBeInTheDocument();
  });

  it('shows access-denied when not authenticated (null role)', () => {
    setRole(null);
    render(<LibraryReportsPage />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders the page guard, not the tab panel, for unauthorized roles', () => {
    setRole('student');
    render(<LibraryReportsPage />);

    expect(
      screen.queryByRole('heading', { name: /reports & item management/i }),
    ).not.toBeInTheDocument();
  });
});

describe('LibraryReportsPage — authorized roles', () => {
  beforeEach(() => {
    setRole('admin');
  });

  it('renders all three tabs for an admin', () => {
    render(<LibraryReportsPage />);

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /condition reports/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /repair tracking/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /lost items/i })).toBeInTheDocument();
  });

  it('renders the page heading and subtext', () => {
    render(<LibraryReportsPage />);

    expect(
      screen.getByRole('heading', { name: /reports & item management/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/manage item conditions, track repairs, and resolve lost-item cases/i),
    ).toBeInTheDocument();
  });

  it('shows the "select an item" placeholder in the condition tab (no demo data)', () => {
    render(<LibraryReportsPage />);

    expect(
      screen.getByText(/select an item from the catalog to view or update its condition report/i),
    ).toBeInTheDocument();
  });

  it('shows empty states for repair and lost-item tabs', () => {
    render(<LibraryReportsPage />);

    expect(screen.getByText(/no repair tickets/i)).toBeInTheDocument();
    expect(screen.getByText(/no open lost-item cases/i)).toBeInTheDocument();
  });

  it('renders an instructor (reports permission) correctly', () => {
    setRole('instructor');
    render(<LibraryReportsPage />);

    expect(screen.getByRole('tab', { name: /condition reports/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /repair tracking/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /lost items/i })).toBeInTheDocument();
  });
});