import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApplicationAnswerForm } from '@/src/features/scholarships/applications/validation/components/ApplicationAnswerForm';
import { applicationValidationService } from '@/src/features/scholarships/applications/validation/service';
import {
  mockApplicationFormSchema,
  mockValidAnswers,
} from '@/src/features/scholarships/applications/validation/fixtures';
import { useApplicationValidationStore } from '@/src/features/scholarships/applications/validation/store';

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

describe('ApplicationAnswerForm Component — UI States & Accessibility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useApplicationValidationStore.getState().reset();
  });

  /* -------------------------------------------------------------------------- */
  /* 1. Loading State                                                           */
  /* -------------------------------------------------------------------------- */
  describe('1. Loading State', () => {
    it('renders accessible loading skeleton with aria-busy="true"', () => {
      vi.spyOn(applicationValidationService, 'getFormSchema').mockImplementation(
        () => new Promise(() => {}) // never resolves
      );

      renderWithClient(<ApplicationAnswerForm roundId="round-stellar-2026" />);

      const loadingStatus = screen.getByRole('status', {
        name: /loading application questionnaire/i,
      });
      expect(loadingStatus).toBeInTheDocument();
      expect(loadingStatus).toHaveAttribute('aria-busy', 'true');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 2. Empty State                                                             */
  /* -------------------------------------------------------------------------- */
  describe('2. Empty State', () => {
    it('renders accessible empty status when round schema has no fields configured', async () => {
      vi.spyOn(applicationValidationService, 'getFormSchema').mockResolvedValue({
        ...mockApplicationFormSchema,
        fields: [],
      });

      renderWithClient(<ApplicationAnswerForm roundId="round-stellar-2026" />);

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });

      expect(screen.getByText(/no questions configured/i)).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 3. Error State                                                             */
  /* -------------------------------------------------------------------------- */
  describe('3. Error State', () => {
    it('renders role="alert" with message and a retry button on schema fetch failure', async () => {
      vi.spyOn(applicationValidationService, 'getFormSchema').mockRejectedValue(
        new Error('Network transport unavailable')
      );

      renderWithClient(<ApplicationAnswerForm roundId="round-stellar-2026" />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(screen.getByText(/failed to load application questionnaire/i)).toBeInTheDocument();
      expect(screen.getByText(/network transport unavailable/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 4. Success State & Form Rendering                                         */
  /* -------------------------------------------------------------------------- */
  describe('4. Success State & Form Rendering', () => {
    it('renders questionnaire fields with live word counters and submits valid answers', async () => {
      vi.spyOn(applicationValidationService, 'getFormSchema').mockResolvedValue(
        mockApplicationFormSchema
      );
      const submitSpy = vi.spyOn(applicationValidationService, 'submitAnswers').mockResolvedValue({
        ok: true,
        applicationId: 'app-stellar-student-1',
        submissionId: 'sub-receipt-12345',
        submittedAt: '2026-09-27T12:00:00.000Z',
        validationResult: {
          valid: true,
          errors: [],
          errorMap: {},
          normalizedAnswers: mockValidAnswers,
          wordCounts: { personalStatement: 75 },
        },
      });

      renderWithClient(<ApplicationAnswerForm roundId="round-stellar-2026" studentId="student-test-1" />);

      await waitFor(() => {
        expect(screen.getByText(mockApplicationFormSchema.title)).toBeInTheDocument();
      });

      // Verify fields are present
      expect(screen.getByLabelText(/personal statement & technical vision/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/educational institution/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/primary specialization track/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/cumulative grade point average/i)).toBeInTheDocument();

      // Populate valid fields in store
      const store = useApplicationValidationStore.getState();
      for (const [key, value] of Object.entries(mockValidAnswers)) {
        store.setAnswer(key, value);
      }

      // Submit form
      const submitBtn = screen.getByRole('button', { name: /submit answers/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(submitSpy).toHaveBeenCalled();
        expect(screen.getByText(/application answers validated & submitted/i)).toBeInTheDocument();
        expect(screen.getByText('app-stellar-student-1')).toBeInTheDocument();
        expect(screen.getByText('sub-receipt-12345')).toBeInTheDocument();
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 5. Responsive State                                                        */
  /* -------------------------------------------------------------------------- */
  describe('5. Responsive State', () => {
    it('applies responsive layout classes to form containers and field sets', async () => {
      vi.spyOn(applicationValidationService, 'getFormSchema').mockResolvedValue(
        mockApplicationFormSchema
      );

      const { container } = renderWithClient(<ApplicationAnswerForm roundId="round-stellar-2026" />);

      await waitFor(() => {
        expect(screen.getByText(mockApplicationFormSchema.title)).toBeInTheDocument();
      });

      const multiSelectGrid = container.querySelector('.grid.gap-2');
      expect(multiSelectGrid).toHaveClass('sm:grid-cols-2');

      const submitFooter = container.querySelector('.border-t.border-slate-100');
      expect(submitFooter).toHaveClass('sm:flex-row');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 6. Keyboard Navigation & Focus Management                                  */
  /* -------------------------------------------------------------------------- */
  describe('6. Keyboard Navigation & Focus Management', () => {
    it('focuses field directly when user clicks "Fix" button in ValidationSummaryBanner', async () => {
      vi.spyOn(applicationValidationService, 'getFormSchema').mockResolvedValue(
        mockApplicationFormSchema
      );

      renderWithClient(<ApplicationAnswerForm roundId="round-stellar-2026" />);

      await waitFor(() => {
        expect(screen.getByText(mockApplicationFormSchema.title)).toBeInTheDocument();
      });

      // Submit empty form to trigger validation errors
      fireEvent.click(screen.getByRole('button', { name: /submit answers/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert', { name: '' })).toBeInTheDocument();
      });

      // Find "Fix" button for institutionName
      const fixButtons = screen.getAllByRole('button', { name: /fix/i });
      expect(fixButtons.length).toBeGreaterThan(0);

      // Focus input element
      const targetInput = screen.getByLabelText(/educational institution/i);
      const focusSpy = vi.spyOn(targetInput, 'focus');

      fireEvent.click(fixButtons[1]); // Fix for institution

      await waitFor(() => {
        expect(focusSpy).toHaveBeenCalled();
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 7. Screen-Reader Accessibility & ARIA                                      */
  /* -------------------------------------------------------------------------- */
  describe('7. Screen-Reader Accessibility & ARIA', () => {
    it('includes polite live region for word counter and aria-invalid on invalid fields', async () => {
      vi.spyOn(applicationValidationService, 'getFormSchema').mockResolvedValue(
        mockApplicationFormSchema
      );

      renderWithClient(<ApplicationAnswerForm roundId="round-stellar-2026" />);

      await waitFor(() => {
        expect(screen.getByText(mockApplicationFormSchema.title)).toBeInTheDocument();
      });

      // Check aria-live on word counter
      const liveWordCount = screen.getByText(/word count: 0 words/i);
      expect(liveWordCount).toHaveAttribute('aria-live', 'polite');

      // Submit to trigger aria-invalid
      fireEvent.click(screen.getByRole('button', { name: /submit answers/i }));

      await waitFor(() => {
        const statementInput = screen.getByLabelText(/personal statement & technical vision/i);
        expect(statementInput).toHaveAttribute('aria-invalid', 'true');
        expect(statementInput).toHaveAttribute('aria-describedby');
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 8. Permission States (Student vs Reviewer / Sponsor)                       */
  /* -------------------------------------------------------------------------- */
  describe('8. Permission States', () => {
    it('renders editable form with submit button for students', async () => {
      vi.spyOn(applicationValidationService, 'getFormSchema').mockResolvedValue(
        mockApplicationFormSchema
      );

      renderWithClient(
        <ApplicationAnswerForm roundId="round-stellar-2026" userRole="student" />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit answers/i })).toBeInTheDocument();
      });

      const statementInput = screen.getByLabelText(/personal statement & technical vision/i);
      expect(statementInput.tagName.toLowerCase()).toBe('textarea');
      expect(statementInput).not.toHaveAttribute('readonly');
    });

    it('renders read-only normalized view without submit button for reviewers', async () => {
      vi.spyOn(applicationValidationService, 'getFormSchema').mockResolvedValue(
        mockApplicationFormSchema
      );

      renderWithClient(
        <ApplicationAnswerForm roundId="round-stellar-2026" userRole="reviewer" />
      );

      await waitFor(() => {
        expect(screen.getByText(/read-only reviewer view/i)).toBeInTheDocument();
      });

      // Reviewer cannot submit
      expect(screen.queryByRole('button', { name: /submit answers/i })).not.toBeInTheDocument();

      // Reviewer sees safe field paths
      expect(screen.getByText('answers.personalStatement')).toBeInTheDocument();
      expect(screen.getByText('answers.institutionName')).toBeInTheDocument();
    });
  });
});
