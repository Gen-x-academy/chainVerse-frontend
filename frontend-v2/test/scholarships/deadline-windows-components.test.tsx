import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProgramDeadlineManager } from '@/src/features/scholarships/windows/components/ProgramDeadlineManager';
import { programWindowService } from '@/src/features/scholarships/windows/service';
import { mockApplicationWindows } from '@/src/features/scholarships/windows/fixtures';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('ProgramDeadlineManager Component — States & Accessibility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Loading State', () => {
    it('renders loading indicators and aria-busy="true"', () => {
      vi.spyOn(programWindowService, 'listWindows').mockImplementation(
        () => new Promise(() => {}) // never resolves
      );

      renderWithClient(<ProgramDeadlineManager userRole="administrator" />);

      const loadingContainer = screen.getByRole('status', { name: '' });
      expect(loadingContainer).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByText(/loading application windows/i)).toBeInTheDocument();
    });
  });

  describe('2. Empty State', () => {
    it('renders accessible empty view when no windows are found', async () => {
      vi.spyOn(programWindowService, 'listWindows').mockResolvedValue([]);

      renderWithClient(<ProgramDeadlineManager userRole="administrator" />);

      await waitFor(() => {
        expect(screen.getByText(/no application windows configured/i)).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /create first window/i })).toBeInTheDocument();
    });
  });

  describe('3. Error State', () => {
    it('renders error boundary with role="alert" and retry button', async () => {
      vi.spyOn(programWindowService, 'listWindows').mockRejectedValue(
        new Error('Failed to retrieve program windows')
      );

      renderWithClient(<ProgramDeadlineManager userRole="administrator" />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(screen.getByText(/failed to load application windows/i)).toBeInTheDocument();
      expect(screen.getByText(/failed to retrieve program windows/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  describe('4. Success State & Deadline Adjustment', () => {
    it('opens deadline modification modal and confirms adjustment with notification banner', async () => {
      vi.spyOn(programWindowService, 'listWindows').mockResolvedValue(mockApplicationWindows);
      const updateSpy = vi.spyOn(programWindowService, 'updateWindow').mockResolvedValue({
        ...mockApplicationWindows[0],
        closeDate: '2026-12-01',
      });

      renderWithClient(<ProgramDeadlineManager userRole="administrator" />);

      await waitFor(() => {
        expect(screen.getByText(mockApplicationWindows[0].name)).toBeInTheDocument();
      });

      // Click Adjust Deadline on first window
      const adjustButtons = screen.getAllByRole('button', { name: /adjust deadline/i });
      fireEvent.click(adjustButtons[0]);

      expect(screen.getByRole('dialog', { name: /adjust program deadline/i })).toBeInTheDocument();
      expect(screen.getByText(/zero silent invalidation/i)).toBeInTheDocument();

      // Enter change reason
      const reasonInput = screen.getByLabelText(/reason for deadline modification/i);
      fireEvent.change(reasonInput, {
        target: { value: 'Sponsor approval for extended semester submission.' },
      });

      // Confirm
      const confirmButton = screen.getByRole('button', { name: /confirm deadline modification/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalled();
        const notification = screen.getByRole('status', { name: '' });
        expect(notification).toHaveTextContent(/deadline adjusted successfully/i);
      });
    });
  });

  describe('5. Responsive State', () => {
    it('applies responsive grid classes for mobile and desktop screens', async () => {
      vi.spyOn(programWindowService, 'listWindows').mockResolvedValue(mockApplicationWindows);

      const { container } = renderWithClient(<ProgramDeadlineManager userRole="administrator" />);

      await waitFor(() => {
        expect(screen.getByText(mockApplicationWindows[0].name)).toBeInTheDocument();
      });

      const grid = container.querySelector('.grid.gap-6');
      expect(grid).toHaveClass('sm:grid-cols-2');
      expect(grid).toHaveClass('lg:grid-cols-3');
    });
  });

  describe('6. Keyboard Navigation', () => {
    it('dismisses deadline adjustment dialog with Escape key', async () => {
      vi.spyOn(programWindowService, 'listWindows').mockResolvedValue(mockApplicationWindows);

      renderWithClient(<ProgramDeadlineManager userRole="administrator" />);

      await waitFor(() => {
        expect(screen.getByText(mockApplicationWindows[0].name)).toBeInTheDocument();
      });

      // Open Modal
      const adjustButtons = screen.getAllByRole('button', { name: /adjust deadline/i });
      fireEvent.click(adjustButtons[0]);

      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('7. Screen-Reader States & ARIA Attributes', () => {
    it('contains semantic heading hierarchy and live region announcements', async () => {
      vi.spyOn(programWindowService, 'listWindows').mockResolvedValue(mockApplicationWindows);

      renderWithClient(<ProgramDeadlineManager userRole="administrator" />);

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { level: 1, name: /application opening & deadline windows/i })
        ).toBeInTheDocument();
      });

      const liveCounter = screen.getByText(/showing/i).closest('[aria-live="polite"]');
      expect(liveCounter).toBeInTheDocument();
    });
  });

  describe('8. Permission States', () => {
    it('allows managers to create and modify deadline windows', async () => {
      vi.spyOn(programWindowService, 'listWindows').mockResolvedValue(mockApplicationWindows);

      renderWithClient(<ProgramDeadlineManager userRole="administrator" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new deadline window/i })).toBeInTheDocument();
      });

      expect(screen.getAllByRole('button', { name: /adjust deadline/i }).length).toBeGreaterThan(0);
    });

    it('displays read-only notice and hides modification controls for student role', async () => {
      vi.spyOn(programWindowService, 'listWindows').mockResolvedValue(mockApplicationWindows);

      renderWithClient(<ProgramDeadlineManager userRole="student" />);

      await waitFor(() => {
        expect(screen.getByText(/window configuration requires manager permissions/i)).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /new deadline window/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /adjust deadline/i })).not.toBeInTheDocument();
    });
  });
});
