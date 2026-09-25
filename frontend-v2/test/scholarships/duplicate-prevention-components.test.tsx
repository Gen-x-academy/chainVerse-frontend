import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApplicationMergeConsole } from '@/src/features/scholarships/duplicates/components/ApplicationMergeConsole';
import { applicationDuplicateService } from '@/src/features/scholarships/duplicates/service';
import { mockDuplicateClusters } from '@/src/features/scholarships/duplicates/fixtures';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('ApplicationMergeConsole Component — States & Accessibility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Loading State', () => {
    it('renders loading skeletons and aria-busy="true"', () => {
      vi.spyOn(applicationDuplicateService, 'listDuplicateClusters').mockImplementation(
        () => new Promise(() => {}) // never resolves
      );

      renderWithClient(<ApplicationMergeConsole userRole="administrator" />);

      const loadingContainer = screen.getByRole('status', { name: '' });
      expect(loadingContainer).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByText(/scanning for duplicate application clusters/i)).toBeInTheDocument();
    });
  });

  describe('2. Empty State', () => {
    it('renders accessible empty view when no duplicate clusters exist', async () => {
      vi.spyOn(applicationDuplicateService, 'listDuplicateClusters').mockResolvedValue([]);

      renderWithClient(<ApplicationMergeConsole userRole="administrator" />);

      await waitFor(() => {
        expect(screen.getByText(/no duplicate clusters detected/i)).toBeInTheDocument();
      });

      expect(
        screen.getByText(/all submitted applications comply with program uniqueness policies/i)
      ).toBeInTheDocument();
    });
  });

  describe('3. Error State', () => {
    it('renders error boundary with role="alert" and a retry button', async () => {
      vi.spyOn(applicationDuplicateService, 'listDuplicateClusters').mockRejectedValue(
        new Error('Cluster detection service unavailable')
      );

      renderWithClient(<ApplicationMergeConsole userRole="administrator" />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(screen.getByText(/failed to load duplicate clusters/i)).toBeInTheDocument();
      expect(screen.getByText(/cluster detection service unavailable/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  describe('4. Success State & Merge Execution', () => {
    it('executes merge and displays notification banner with role="status"', async () => {
      vi.spyOn(applicationDuplicateService, 'listDuplicateClusters').mockResolvedValue(
        mockDuplicateClusters
      );
      const mergeSpy = vi.spyOn(applicationDuplicateService, 'mergeApplications').mockResolvedValue({
        primaryApplication: mockDuplicateClusters[0].applications[0],
        auditRecord: {
          id: 'audit-merge-1',
          mergedAt: '2026-09-24T12:00:00.000Z',
          primaryApplicationId: 'app-dup-1',
          mergedSecondaryIds: ['app-dup-2'],
          transferredDocumentCount: 1,
          adminReason: 'Student submitted accidental duplicate.',
          adminUserId: 'admin-1',
          status: 'completed',
        },
      });

      renderWithClient(<ApplicationMergeConsole userRole="administrator" />);

      await waitFor(() => {
        expect(screen.getByText(/chidi okonkwo/i)).toBeInTheDocument();
      });

      // Enter administrative reason
      const reasonInput = screen.getByLabelText(/administrative justification reason/i);
      fireEvent.change(reasonInput, {
        target: { value: 'Student submitted accidental duplicate.' },
      });

      // Click execute merge
      const mergeButton = screen.getByRole('button', { name: /execute controlled merge/i });
      fireEvent.click(mergeButton);

      await waitFor(() => {
        expect(mergeSpy).toHaveBeenCalled();
        const notification = screen.getByRole('status', { name: '' });
        expect(notification).toHaveTextContent(/successfully merged/i);
      });
    });
  });

  describe('5. Responsive State', () => {
    it('contains responsive comparative grid classes for desktop and mobile viewports', async () => {
      vi.spyOn(applicationDuplicateService, 'listDuplicateClusters').mockResolvedValue(
        mockDuplicateClusters
      );

      const { container } = renderWithClient(<ApplicationMergeConsole userRole="administrator" />);

      await waitFor(() => {
        expect(screen.getByText(/chidi okonkwo/i)).toBeInTheDocument();
      });

      const grid = container.querySelector('.grid.gap-6.md\\:grid-cols-2');
      expect(grid).toBeInTheDocument();
    });
  });

  describe('6. Keyboard Navigation', () => {
    it('allows tabbing into form controls and checkboxes', async () => {
      vi.spyOn(applicationDuplicateService, 'listDuplicateClusters').mockResolvedValue(
        mockDuplicateClusters
      );

      renderWithClient(<ApplicationMergeConsole userRole="administrator" />);

      await waitFor(() => {
        expect(screen.getByText(/chidi okonkwo/i)).toBeInTheDocument();
      });

      const checkbox = screen.getByRole('checkbox', {
        name: /combine and transfer all verified supporting documents/i,
      });
      checkbox.focus();
      expect(document.activeElement).toBe(checkbox);

      const reasonTextarea = screen.getByLabelText(/administrative justification reason/i);
      reasonTextarea.focus();
      expect(document.activeElement).toBe(reasonTextarea);
    });
  });

  describe('7. Screen-Reader States & ARIA Attributes', () => {
    it('has semantic heading hierarchy and aria-describedby on inputs', async () => {
      vi.spyOn(applicationDuplicateService, 'listDuplicateClusters').mockResolvedValue(
        mockDuplicateClusters
      );

      renderWithClient(<ApplicationMergeConsole userRole="administrator" />);

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { level: 1, name: /duplicate applications & controlled merges/i })
        ).toBeInTheDocument();
      });

      const textarea = screen.getByLabelText(/administrative justification reason/i);
      expect(textarea).toHaveAttribute('aria-describedby', 'merge-reason-desc');
    });
  });

  describe('8. Permission States', () => {
    it('renders merge controls for administrator and restricts unauthorized viewer role', async () => {
      vi.spyOn(applicationDuplicateService, 'listDuplicateClusters').mockResolvedValue(
        mockDuplicateClusters
      );

      const { unmount } = renderWithClient(<ApplicationMergeConsole userRole="administrator" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /execute controlled merge/i })).toBeInTheDocument();
      });

      unmount();

      // Render as student/viewer
      renderWithClient(<ApplicationMergeConsole userRole="student" />);

      await waitFor(() => {
        expect(screen.getByText(/administrator or reviewer grant required/i)).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /execute controlled merge/i })).not.toBeInTheDocument();
    });
  });
});
