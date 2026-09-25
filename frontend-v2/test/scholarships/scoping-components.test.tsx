import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProgramScopeManager } from '@/src/features/scholarships/scoping/components/ProgramScopeManager';
import { programScopingService } from '@/src/features/scholarships/scoping/service';
import { mockProgramScopes, mockScopingReferenceData } from '@/src/features/scholarships/scoping/fixtures';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('ProgramScopeManager Component — States & Accessibility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Loading State', () => {
    it('renders accessible loading skeletons and aria-busy="true"', () => {
      // Mock delayed response
      vi.spyOn(programScopingService, 'listScopes').mockImplementation(
        () => new Promise(() => {}) // never resolves
      );

      renderWithClient(<ProgramScopeManager userRole="administrator" />);

      const loadingContainer = screen.getByRole('status', { name: /loading program scopes/i });
      expect(loadingContainer).toBeInTheDocument();
      expect(loadingContainer).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByText(/loading program scopes/i)).toBeInTheDocument();
    });
  });

  describe('2. Empty State', () => {
    it('renders the accessible empty state when no scopes match query', async () => {
      vi.spyOn(programScopingService, 'listScopes').mockResolvedValue([]);
      vi.spyOn(programScopingService, 'getReferenceData').mockResolvedValue(mockScopingReferenceData);

      renderWithClient(<ProgramScopeManager userRole="administrator" />);

      await waitFor(() => {
        expect(screen.getByRole('status', { name: '' })).toBeInTheDocument();
      });

      expect(screen.getByText(/no program scopes found/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create new scope/i })).toBeInTheDocument();
    });
  });

  describe('3. Error State', () => {
    it('renders the accessible error state with role="alert" and a retry button', async () => {
      vi.spyOn(programScopingService, 'listScopes').mockRejectedValue(
        new Error('Network transport unavailable')
      );
      vi.spyOn(programScopingService, 'getReferenceData').mockResolvedValue(mockScopingReferenceData);

      renderWithClient(<ProgramScopeManager userRole="administrator" />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(screen.getByText(/failed to load program scopes/i)).toBeInTheDocument();
      expect(screen.getByText(/network transport unavailable/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  describe('4. Success State & Operations', () => {
    it('renders scopes successfully and allows toggling status with notification banner', async () => {
      vi.spyOn(programScopingService, 'listScopes').mockResolvedValue(mockProgramScopes);
      vi.spyOn(programScopingService, 'getReferenceData').mockResolvedValue(mockScopingReferenceData);
      const updateSpy = vi.spyOn(programScopingService, 'updateScope').mockResolvedValue({
        ...mockProgramScopes[0],
        status: 'inactive',
        allowNewApplications: false,
      });

      renderWithClient(<ProgramScopeManager userRole="administrator" />);

      await waitFor(() => {
        expect(screen.getByText(mockProgramScopes[0].name)).toBeInTheDocument();
      });

      // Find Deactivate button on the first active scope
      const deactivateButtons = screen.getAllByRole('button', { name: /deactivate/i });
      expect(deactivateButtons.length).toBeGreaterThan(0);

      fireEvent.click(deactivateButtons[0]);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalled();
        const notification = screen.getByRole('status', { name: '' });
        expect(notification).toHaveTextContent(/inactive scopes cannot receive new applications/i);
      });
    });
  });

  describe('5. Responsive State', () => {
    it('applies responsive grid classes for mobile and desktop screens', async () => {
      vi.spyOn(programScopingService, 'listScopes').mockResolvedValue(mockProgramScopes);
      vi.spyOn(programScopingService, 'getReferenceData').mockResolvedValue(mockScopingReferenceData);

      const { container } = renderWithClient(<ProgramScopeManager userRole="administrator" />);

      await waitFor(() => {
        expect(screen.getByText(mockProgramScopes[0].name)).toBeInTheDocument();
      });

      const grid = container.querySelector('.grid.gap-6');
      expect(grid).toHaveClass('sm:grid-cols-2');
      expect(grid).toHaveClass('lg:grid-cols-3');
    });
  });

  describe('6. Keyboard Navigation', () => {
    it('allows opening and closing the scope creation dialog with the Escape key', async () => {
      vi.spyOn(programScopingService, 'listScopes').mockResolvedValue(mockProgramScopes);
      vi.spyOn(programScopingService, 'getReferenceData').mockResolvedValue(mockScopingReferenceData);

      renderWithClient(<ProgramScopeManager userRole="administrator" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new program scope/i })).toBeInTheDocument();
      });

      // Open Modal
      fireEvent.click(screen.getByRole('button', { name: /new program scope/i }));

      expect(screen.getByRole('dialog', { name: /create new program scope/i })).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('7. Screen-Reader Accessibility & ARIA', () => {
    it('contains proper semantic heading hierarchy and live regions', async () => {
      vi.spyOn(programScopingService, 'listScopes').mockResolvedValue(mockProgramScopes);
      vi.spyOn(programScopingService, 'getReferenceData').mockResolvedValue(mockScopingReferenceData);

      renderWithClient(<ProgramScopeManager userRole="administrator" />);

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { level: 1, name: /program scoping & eligibility cohorts/i })
        ).toBeInTheDocument();
      });

      // Live search count container has aria-live="polite"
      const liveRegion = screen.getByText(/showing/i).closest('[aria-live="polite"]');
      expect(liveRegion).toBeInTheDocument();
    });
  });

  describe('8. Permission States & Inactive Scope Gating', () => {
    it('grants full management controls to administrator role', async () => {
      vi.spyOn(programScopingService, 'listScopes').mockResolvedValue(mockProgramScopes);
      vi.spyOn(programScopingService, 'getReferenceData').mockResolvedValue(mockScopingReferenceData);

      renderWithClient(<ProgramScopeManager userRole="administrator" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new program scope/i })).toBeInTheDocument();
      });

      expect(screen.getAllByRole('button', { name: /edit/i }).length).toBeGreaterThan(0);
    });

    it('displays read-only notice and disables modifications for student role', async () => {
      vi.spyOn(programScopingService, 'listScopes').mockResolvedValue(mockProgramScopes);
      vi.spyOn(programScopingService, 'getReferenceData').mockResolvedValue(mockScopingReferenceData);

      renderWithClient(<ProgramScopeManager userRole="student" />);

      await waitFor(() => {
        expect(screen.getByText(/scope configuration requires administrator or sponsor privileges/i)).toBeInTheDocument();
      });

      // New scope and edit buttons must not be visible to students
      expect(screen.queryByRole('button', { name: /new program scope/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    });

    it('disables application button for inactive scopes (Invariant: inactive scopes cannot receive applications)', async () => {
      vi.spyOn(programScopingService, 'listScopes').mockResolvedValue(mockProgramScopes);
      vi.spyOn(programScopingService, 'getReferenceData').mockResolvedValue(mockScopingReferenceData);

      renderWithClient(<ProgramScopeManager userRole="student" />);

      await waitFor(() => {
        expect(screen.getByText('Summer 2026 Accelerated Scope (Closed)')).toBeInTheDocument();
      });

      // Check disabled application buttons for inactive scopes
      const closedButtons = screen.getAllByRole('button', {
        name: /applications closed for inactive scope/i,
      });
      expect(closedButtons.length).toBeGreaterThan(0);
      expect(closedButtons[0]).toBeDisabled();
      expect(closedButtons[0]).toHaveAttribute('aria-disabled', 'true');
    });
  });
});
