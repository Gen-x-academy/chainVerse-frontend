/**
 * Tests for the Library Reports page.
 *
 * Coverage goals:
 *  - Unauthenticated / no-permission users see an access-denied message and
 *    never see sensitive tab content (no flash).
 *  - Each of the three action tabs is gated by its own distinct permission:
 *      condition  → reports + catalog
 *      repair     → reports
 *      lost-item  → reports + circulation
 *  - Authenticated admins see all three tabs enabled.
 *  - Permission-loss clears the tab content (disabled tabs, denial message).
 *  - Key ARIA/responsive attributes are present.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LibraryReportsPage from '../page';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/src/store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('@/src/features/library/hooks/useReportsData', () => ({
  useReportsData: vi.fn(),
}));

// Prevent real network calls from tanstack-query during tests
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({ data: null, isLoading: false, error: null }),
    useMutation: vi.fn().mockReturnValue({ mutateAsync: vi.fn(), isPending: false }),
    useQueryClient: vi.fn().mockReturnValue({ invalidateQueries: vi.fn() }),
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

import { useAuthStore } from '@/src/store/authStore';
import { useReportsData } from '@/src/features/library/hooks/useReportsData';

type MockAuthStore = ReturnType<typeof vi.fn>;

/** Sets the mocked role that `useAuthStore` will return. */
function setRole(role: 'admin' | 'instructor' | 'student' | null) {
  (useAuthStore as MockAuthStore).mockImplementation(
    (selector: (s: { user: { role: string } | null }) => unknown) =>
      selector({ user: role ? { role } : null }),
  );
}

/** Default empty useReportsData return value. */
const emptyReportsData = {
  conditionReport: null,
  conditionLoading: false,
  conditionError: null,
  lostItem: null,
  lostItemLoading: false,
  lostItemError: null,
  repairTickets: [],
  repairLoading: false,
  repairError: null,
  submitConditionReport: vi.fn(),
  resolveLostItem: vi.fn(),
  createRepairTicket: vi.fn(),
  updateRepairTicket: vi.fn(),
};

// ── Test suites ───────────────────────────────────────────────────────────────

describe('LibraryReportsPage — authorization', () => {
  beforeEach(() => {
    (useReportsData as MockAuthStore).mockReturnValue(emptyReportsData);
  });

  it('shows access-denied and never renders tab content when user has no permissions (student)', () => {
    setRole('student');
    render(<LibraryReportsPage />);

    // Guard message is shown
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/access denied|do not have librarian permissions/i)).toBeInTheDocument();

    // None of the report tabs should be present
    expect(screen.queryByRole('tab', { name: /condition reports/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /repair tracking/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /lost item/i })).not.toBeInTheDocument();
  });

  it('shows access-denied when not authenticated (null role)', () => {
    setRole(null);
    render(<LibraryReportsPage />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('denies access to direct URL by rendering the guard, not the tab panel', () => {
    setRole('student');
    render(<LibraryReportsPage />);

    // The page heading for the content should not appear
    expect(
      screen.queryByRole('heading', { name: /reports & item management/i }),
    ).not.toBeInTheDocument();
  });
});

describe('LibraryReportsPage — admin (full access)', () => {
  beforeEach(() => {
    setRole('admin');
    (useReportsData as MockAuthStore).mockReturnValue(emptyReportsData);
  });

  it('renders all three tabs enabled for admin', () => {
    render(<LibraryReportsPage />);

    const conditionTab = screen.getByRole('tab', { name: /condition reports/i });
    const repairTab = screen.getByRole('tab', { name: /repair tracking/i });
    const lostTab = screen.getByRole('tab', { name: /lost item resolution/i });

    expect(conditionTab).not.toBeDisabled();
    expect(repairTab).not.toBeDisabled();
    expect(lostTab).not.toBeDisabled();
  });

  it('renders page heading and description', () => {
    render(<LibraryReportsPage />);

    expect(
      screen.getByRole('heading', { name: /reports & item management/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/manage item conditions, track repairs, and resolve lost items/i),
    ).toBeInTheDocument();
  });

  it('shows the active "reports" link in the sidebar nav', () => {
    render(<LibraryReportsPage />);

    // LibraryAdminLayout renders the LibrarianNav sidebar
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByText('Reports')).toBeInTheDocument();
  });
});

describe('LibraryReportsPage — distinct per-action permissions', () => {
  beforeEach(() => {
    (useReportsData as MockAuthStore).mockReturnValue(emptyReportsData);
  });

  it('instructor (reports+catalog+circulation) sees all three tabs enabled', () => {
    // instructor has ['catalog', 'circulation', 'reports'] per ROLE_PERMISSIONS
    setRole('instructor');
    render(<LibraryReportsPage />);

    expect(screen.getByRole('tab', { name: /condition reports/i })).not.toBeDisabled();
    expect(screen.getByRole('tab', { name: /repair tracking/i })).not.toBeDisabled();
    expect(screen.getByRole('tab', { name: /lost item resolution/i })).not.toBeDisabled();
  });

  it('shows denial message inside Condition Reports tab when permission is missing', async () => {
    // Simulate a user with only 'reports' permission (no 'catalog') —
    // achieved by mocking useAuthStore to return a role that resolves to ['reports'] only.
    // We mock useLibrarianPermissions indirectly through the auth store mock.
    // For this test, we directly mock the permissions hook to return ['reports'].
    const { useLibrarianPermissions } = await import(
      '@/src/features/library/hooks/useLibrarianPermissions'
    );
    const permSpy = vi
      .spyOn({ useLibrarianPermissions }, 'useLibrarianPermissions')
      .mockReturnValue(['reports']);

    setRole('admin'); // must pass the LibraryAdminLayout "reports" guard

    render(<LibraryReportsPage />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /condition reports/i }));

    expect(
      screen.getByText(/do not have permission to manage condition reports/i),
    ).toBeInTheDocument();

    permSpy.mockRestore();
  });

  it('passes enableCondition=false to useReportsData when catalog permission is absent', () => {
    // reports-only role: no catalog → reports.condition denied → enableCondition must be false
    const mockUseReportsData = useReportsData as MockAuthStore;

    // Simulate a reports-only set of permissions via the hook
    vi.doMock('@/src/features/library/hooks/useLibrarianPermissions', () => ({
      useLibrarianPermissions: vi.fn().mockReturnValue(['reports']),
      hasLibrarianPermission: (perms: string[], p: string) => perms.includes(p),
    }));

    setRole('admin');
    render(<LibraryReportsPage />);

    const call = mockUseReportsData.mock.calls[0]?.[0] as {
      enableCondition: boolean;
      enableRepairs: boolean;
      enableLostItem: boolean;
    };

    // repairs.repair only needs 'reports' → enabled; reports.condition needs 'catalog' → disabled
    expect(call?.enableRepairs).toBe(true);
    expect(call?.enableCondition).toBe(false);
  });
});

describe('LibraryReportsPage — tab navigation and accessibility', () => {
  beforeEach(() => {
    setRole('admin');
    (useReportsData as MockAuthStore).mockReturnValue(emptyReportsData);
  });

  it('switches to Repair Tracking tab on click', async () => {
    const user = userEvent.setup();
    render(<LibraryReportsPage />);

    await user.click(screen.getByRole('tab', { name: /repair tracking/i }));

    // RepairTracking renders "No repair tickets" empty state
    expect(await screen.findByText(/no repair tickets/i)).toBeInTheDocument();
  });

  it('switches to Lost Item Resolution tab on click', async () => {
    const user = userEvent.setup();
    render(<LibraryReportsPage />);

    await user.click(screen.getByRole('tab', { name: /lost item resolution/i }));

    // No lostItem data → shows "no active lost-item cases"
    expect(await screen.findByText(/no active lost-item cases/i)).toBeInTheDocument();
  });

  it('tab list has an accessible tablist role', () => {
    render(<LibraryReportsPage />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('page heading uses a semantic h1', () => {
    render(<LibraryReportsPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: /reports & item management/i }),
    ).toBeInTheDocument();
  });
});

describe('LibraryReportsPage — permission-loss clears sensitive data', () => {
  it('does not call useReportsData with any enables=true when role has no permissions', () => {
    setRole('student');
    const mockUseReportsData = useReportsData as MockAuthStore;
    mockUseReportsData.mockReturnValue(emptyReportsData);

    render(<LibraryReportsPage />);

    // LibraryAdminLayout will short-circuit for student, but if the page
    // component still calls useReportsData we ensure no data is fetched.
    const calls = mockUseReportsData.mock.calls as Array<
      [{ enableCondition: boolean; enableRepairs: boolean; enableLostItem: boolean }]
    >;
    for (const [opts] of calls) {
      expect(opts?.enableCondition).toBeFalsy();
      expect(opts?.enableRepairs).toBeFalsy();
      expect(opts?.enableLostItem).toBeFalsy();
    }
  });
});
