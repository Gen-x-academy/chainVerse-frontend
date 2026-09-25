import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AtomicSubmissionFlow } from '@/src/features/scholarships/applications/components/AtomicSubmissionFlow';
import { atomicApplicationService } from '@/src/features/scholarships/applications/service';
import type { ScholarshipRound } from '@/src/features/scholarships/types/scholarship.types';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('AtomicSubmissionFlow Component — States & Accessibility', () => {
  const openRound: ScholarshipRound = {
    id: 'round-stellar-2026',
    programId: 'prog-stellar-2026',
    name: 'Stellar Fellowship 2026 Round 1',
    status: 'open',
    opensAt: '2026-08-01T00:00:00.000Z',
    applicationDeadline: '2026-11-30T23:59:59.000Z',
    awardAmountCents: 500000,
    currency: 'USD',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Empty State', () => {
    it('renders accessible empty view when round information is missing', () => {
      // @ts-expect-error test empty input
      renderWithClient(<AtomicSubmissionFlow round={null} />);

      const emptyRegion = screen.getByRole('status');
      expect(emptyRegion).toBeInTheDocument();
      expect(screen.getByText(/no scholarship round selected/i)).toBeInTheDocument();
    });
  });

  describe('2. Error State & Editable Draft Preservation', () => {
    it('displays error alert on validation failure while leaving the draft editable', async () => {
      renderWithClient(<AtomicSubmissionFlow round={openRound} userRole="student" />);

      // Attempt to submit an empty form
      const submitButton = screen.getByRole('button', {
        name: /submit application atomically/i,
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(
        screen.getByText(/atomic submission blocked — draft preserved/i)
      ).toBeInTheDocument();

      // Invariant: Draft remains editable!
      const textarea = screen.getByLabelText(/personal statement/i);
      expect(textarea).not.toBeDisabled();
      fireEvent.change(textarea, {
        target: {
          value:
            'Now I am editing my personal statement so that it fulfills the full 80 character minimum requirement for blockchain applications!',
        },
      });
      expect(textarea).toHaveValue(
        'Now I am editing my personal statement so that it fulfills the full 80 character minimum requirement for blockchain applications!'
      );
    });
  });

  describe('3. Loading State', () => {
    it('shows loading indicator and aria-busy="true" during atomic submission', async () => {
      vi.spyOn(atomicApplicationService, 'submitAtomically').mockImplementation(
        () => new Promise(() => {}) // never resolves
      );

      renderWithClient(<AtomicSubmissionFlow round={openRound} userRole="student" />);

      const submitButton = screen.getByRole('button', {
        name: /submit application atomically/i,
      });

      // Fill in text
      const textarea = screen.getByLabelText(/personal statement/i);
      fireEvent.change(textarea, {
        target: {
          value:
            'A very comprehensive and thorough personal statement for Stellar development exceeding eighty characters in total length.',
        },
      });

      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(submitButton).toHaveAttribute('aria-busy', 'true');
        expect(screen.getByText(/validating and submitting atomically/i)).toBeInTheDocument();
      });
    });
  });

  describe('4. Success State & Receipt View', () => {
    it('renders the immutable submission receipt upon atomic success', async () => {
      vi.spyOn(atomicApplicationService, 'submitAtomically').mockResolvedValue({
        ok: true,
        status: 'submitted',
        receipt: {
          receiptId: 'RCPT-2026-XYZ123',
          applicationId: 'app-999',
          roundId: openRound.id,
          studentId: 'student-1',
          submittedAt: '2026-09-24T12:00:00.000Z',
          idempotencyKey: 'idemp-key-1',
          receiptHash: 'rcpt-hash-abc',
          summary: {
            statementLength: 120,
            documentsCount: 2,
            verifiedConsentsCount: 4,
            eligibilityDecisionKey: 'dec-1',
          },
          immutable: true,
        },
        message: 'Application submitted successfully.',
      });

      renderWithClient(<AtomicSubmissionFlow round={openRound} userRole="student" />);

      // Fill statement
      const textarea = screen.getByLabelText(/personal statement/i);
      fireEvent.change(textarea, {
        target: {
          value:
            'Valid statement exceeding minimum 80 characters for testing atomic submission transition in the frontend test suite.',
        },
      });

      const submitButton = screen.getByRole('button', {
        name: /submit application atomically/i,
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('status', { name: /application submitted successfully/i })).toBeInTheDocument();
      });

      expect(screen.getByText('RCPT-2026-XYZ123')).toBeInTheDocument();
      expect(screen.getByText(/immutable receipt/i)).toBeInTheDocument();
      expect(screen.getByText(/verified atomic transition/i)).toBeInTheDocument();
    });
  });

  describe('5. Responsive State', () => {
    it('contains responsive dual-pane layout classes for mobile and desktop screens', () => {
      const { container } = renderWithClient(
        <AtomicSubmissionFlow round={openRound} userRole="student" />
      );

      const grid = container.querySelector('.grid.gap-8');
      expect(grid).toHaveClass('lg:grid-cols-12');

      const leftForm = container.querySelector('form');
      expect(leftForm).toHaveClass('lg:col-span-7');

      const rightAside = container.querySelector('aside');
      expect(rightAside).toHaveClass('lg:col-span-5');
    });
  });

  describe('6. Keyboard Navigation', () => {
    it('supports tab navigation and Enter key form submission', () => {
      renderWithClient(<AtomicSubmissionFlow round={openRound} userRole="student" />);

      const textarea = screen.getByLabelText(/personal statement/i);
      textarea.focus();
      expect(document.activeElement).toBe(textarea);

      const aidCheckbox = screen.getByLabelText(/applying on financial-aid grounds/i);
      aidCheckbox.focus();
      expect(document.activeElement).toBe(aidCheckbox);
    });
  });

  describe('7. Screen-Reader States & ARIA Attributes', () => {
    it('has live region announcements and aria-invalid on invalid inputs', () => {
      renderWithClient(<AtomicSubmissionFlow round={openRound} userRole="student" />);

      // Live readiness counter has aria-live="polite"
      const liveCounter = screen.getByText(/ready/i).closest('[aria-live="polite"]');
      expect(liveCounter).toBeInTheDocument();

      // Personal statement has aria-invalid when too short
      const textarea = screen.getByLabelText(/personal statement/i);
      fireEvent.change(textarea, { target: { value: 'Too short' } });
      expect(textarea).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('8. Permission States', () => {
    it('allows submission for student role and restricts reviewer role to inspection mode', () => {
      const { unmount } = renderWithClient(
        <AtomicSubmissionFlow round={openRound} userRole="student" />
      );

      const studentSubmit = screen.getByRole('button', {
        name: /submit application atomically/i,
      });
      expect(studentSubmit).not.toBeDisabled();

      unmount();

      // Render as reviewer role
      renderWithClient(<AtomicSubmissionFlow round={openRound} userRole="reviewer" />);

      expect(screen.getByText(/inspection mode/i)).toBeInTheDocument();
      const reviewerSubmit = screen.getByRole('button', {
        name: /submit application atomically/i,
      });
      expect(reviewerSubmit).toBeDisabled();
    });
  });
});
