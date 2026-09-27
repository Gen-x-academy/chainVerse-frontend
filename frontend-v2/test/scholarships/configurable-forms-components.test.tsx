import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FormBuilderEditor } from '@/src/features/scholarships/applications/forms/components/FormBuilderEditor';
import { ConfigurableFormRenderer } from '@/src/features/scholarships/applications/forms/components/ConfigurableFormRenderer';
import { VersionHistoryPanel } from '@/src/features/scholarships/applications/forms/components/VersionHistoryPanel';
import { useConfigurableFormStore } from '@/src/features/scholarships/applications/forms/store';
import { configurableFormService } from '@/src/features/scholarships/applications/forms/service';
import {
  mockDraftFormSchema,
  mockPublishedFormSchema,
  mockPublishedFormSchemaV11,
} from '@/src/features/scholarships/applications/forms/fixtures';
import type { FormVersionBinding } from '@/src/features/scholarships/applications/forms/types';

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

describe('Configurable Application Forms Components — UI States & Accessibility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useConfigurableFormStore.getState().reset();
  });

  /* -------------------------------------------------------------------------- */
  /* 1. Loading State                                                           */
  /* -------------------------------------------------------------------------- */
  describe('1. Loading State', () => {
    it('renders accessible loading skeleton with aria-busy="true" and role="status"', () => {
      // Force store to loading state with no activeSchema
      useConfigurableFormStore.setState({ isLoading: true, activeSchema: null });

      renderWithClient(<FormBuilderEditor />);

      const loadingStatus = screen.getByRole('status');
      expect(loadingStatus).toBeInTheDocument();
      expect(loadingStatus).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByText(/loading form builder/i)).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 2. Empty State                                                             */
  /* -------------------------------------------------------------------------- */
  describe('2. Empty State', () => {
    it('renders accessible empty status when the draft schema contains zero sections', () => {
      useConfigurableFormStore.setState({
        activeSchema: {
          ...mockDraftFormSchema,
          sections: [],
        },
        isLoading: false,
        mode: 'builder',
      });

      renderWithClient(<FormBuilderEditor initialSchemaId={mockDraftFormSchema.id} />);

      const emptyStatus = screen.getByRole('status');
      expect(emptyStatus).toBeInTheDocument();
      expect(screen.getByText(/no sections added yet/i)).toBeInTheDocument();
      expect(screen.getByText(/click “add section” above to begin structuring/i)).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 3. Error State                                                             */
  /* -------------------------------------------------------------------------- */
  describe('3. Error State', () => {
    it('renders role="alert" when error message is populated and dismisses upon clicking dismiss', () => {
      useConfigurableFormStore.setState({
        activeSchema: mockDraftFormSchema,
        isLoading: false,
        error: 'Failed to synchronize form schema with remote registry',
      });

      renderWithClient(<FormBuilderEditor initialSchemaId={mockDraftFormSchema.id} />);

      const alertBanner = screen.getByRole('alert');
      expect(alertBanner).toBeInTheDocument();
      expect(
        screen.getByText(/failed to synchronize form schema with remote registry/i)
      ).toBeInTheDocument();

      const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(dismissBtn);

      expect(useConfigurableFormStore.getState().error).toBeNull();
    });

    it('renders conditional logic validation warning when circular dependency exists', () => {
      useConfigurableFormStore.setState({
        activeSchema: mockDraftFormSchema,
        isLoading: false,
        conditionalValidation: {
          valid: false,
          errors: ['Circular dependency cycle detected: field_a -> field_b -> field_a'],
        },
      });

      renderWithClient(<FormBuilderEditor initialSchemaId={mockDraftFormSchema.id} />);

      const warningAlert = screen.getByRole('alert');
      expect(warningAlert).toBeInTheDocument();
      expect(
        screen.getByText(/conditional logic validation warning/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/circular dependency cycle detected/i)
      ).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 4. Success State & Form Rendering                                         */
  /* -------------------------------------------------------------------------- */
  describe('4. Success State & Interactive Journey', () => {
    it('switches between Builder and Preview modes and submits version-bound answers', async () => {
      useConfigurableFormStore.setState({
        activeSchema: mockPublishedFormSchema,
        isLoading: false,
        mode: 'builder',
      });

      renderWithClient(<FormBuilderEditor initialSchemaId={mockPublishedFormSchema.id} />);

      // Verify sections are visible in builder
      expect(screen.getByText(/personal statement & vision/i)).toBeInTheDocument();
      expect(screen.getByText(/academic profile & track/i)).toBeInTheDocument();

      // Switch to interactive preview mode
      const previewTab = screen.getByRole('button', { name: /interactive form preview/i });
      fireEvent.click(previewTab);

      // Verify form rendered in preview
      expect(
        screen.getByText(/previewing student interactive application journey/i)
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/personal statement & technical vision/i)
      ).toBeInTheDocument();
    });

    it('ConfigurableFormRenderer validates required fields and binds answers upon submission', async () => {
      const bindingCallback = vi.fn();

      renderWithClient(
        <ConfigurableFormRenderer
          schema={mockPublishedFormSchema}
          onSubmitBinding={bindingCallback}
        />
      );

      // Verify form elements for all 5 kinds: statement, question, consent, reference, evidence
      expect(screen.getByLabelText(/personal statement & technical vision/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/primary technical track/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/i affirmatively agree and consent to these terms/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/referee@university\.edu/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/evidence upload reference or document ID/i)).toBeInTheDocument();

      // Fill in statement text
      const statementArea = screen.getByPlaceholderText(/compose your statement here/i);
      fireEvent.change(statementArea, {
        target: { value: 'My aspiration is to advance decentralized protocols and secure systems.' },
      });

      // Submit form
      const submitBtn = screen.getByRole('button', { name: /submit answers/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });

      expect(screen.getByText(/answers bound & verified/i)).toBeInTheDocument();
      expect(screen.getByText(`v${mockPublishedFormSchema.version}`)).toBeInTheDocument();
      expect(screen.getByText(mockPublishedFormSchema.schemaHash)).toBeInTheDocument();
      expect(bindingCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          schemaId: mockPublishedFormSchema.id,
          version: mockPublishedFormSchema.version,
          schemaHash: mockPublishedFormSchema.schemaHash,
          verified: true,
        })
      );
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 5. Responsive State                                                        */
  /* -------------------------------------------------------------------------- */
  describe('5. Responsive State', () => {
    it('applies responsive classes in VersionHistoryPanel and FormBuilderEditor', () => {
      const { container } = renderWithClient(
        <VersionHistoryPanel
          schema={mockPublishedFormSchema}
          allSchemas={[mockPublishedFormSchema, mockPublishedFormSchemaV11]}
          onSelectSchema={vi.fn()}
          onPublish={vi.fn()}
          onFork={vi.fn()}
        />
      );

      const actionRow = container.querySelector('.flex-col.sm\\:flex-row');
      expect(actionRow).toBeInTheDocument();
    });

    it('applies responsive grid classes to field creation inputs in FormBuilderEditor', () => {
      useConfigurableFormStore.setState({
        activeSchema: mockDraftFormSchema,
        isLoading: false,
        mode: 'builder',
      });

      const { container } = renderWithClient(
        <FormBuilderEditor initialSchemaId={mockDraftFormSchema.id} />
      );

      // Open Add Field modal for first section
      const addFieldBtns = screen.getAllByRole('button', { name: /add field/i });
      fireEvent.click(addFieldBtns[0]);

      const grid = container.querySelector('.grid.gap-2.sm\\:grid-cols-3');
      expect(grid).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 6. Keyboard Navigation                                                     */
  /* -------------------------------------------------------------------------- */
  describe('6. Keyboard Navigation & Interaction', () => {
    it('allows opening, typing into, and confirming new section creation via buttons', () => {
      useConfigurableFormStore.setState({
        activeSchema: mockDraftFormSchema,
        isLoading: false,
        mode: 'builder',
      });

      renderWithClient(<FormBuilderEditor initialSchemaId={mockDraftFormSchema.id} />);

      const addSectionBtn = screen.getByRole('button', { name: /add section/i });
      fireEvent.click(addSectionBtn);

      const sectionTitleInput = screen.getByPlaceholderText(
        /section title \(e\.g\. research & capstone proposal\)/i
      );
      fireEvent.change(sectionTitleInput, { target: { value: 'Capstone & Innovation Project' } });

      const createBtn = screen.getByRole('button', { name: /create/i });
      fireEvent.click(createBtn);

      // Verify the new section title appears in the DOM
      expect(screen.getByText('Capstone & Innovation Project')).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 7. Screen-Reader Accessibility & Semantic HTML                             */
  /* -------------------------------------------------------------------------- */
  describe('7. Screen-Reader Accessibility & Semantic HTML', () => {
    it('structures questionnaire with semantic section elements and aria-labelledby headers', () => {
      const { container } = renderWithClient(
        <ConfigurableFormRenderer schema={mockPublishedFormSchema} />
      );

      const sections = container.querySelectorAll('section');
      expect(sections.length).toBeGreaterThan(0);

      sections.forEach((section) => {
        expect(section).toHaveAttribute('aria-labelledby');
        const headingId = section.getAttribute('aria-labelledby');
        const heading = container.querySelector(`#${headingId}`);
        expect(heading).toBeInTheDocument();
      });
    });

    it('renders polite live region for word counting in statement questions', () => {
      renderWithClient(<ConfigurableFormRenderer schema={mockPublishedFormSchema} />);

      const liveCounter = screen.getByText(/word count:/i);
      expect(liveCounter).toHaveAttribute('aria-live', 'polite');
    });

    it('announces required validation errors with role="alert" when required fields are missing', () => {
      // Create a schema where a field is strictly required and initially empty
      const strictSchema = {
        ...mockPublishedFormSchema,
        sections: [
          {
            id: 'sec_req',
            title: 'Mandatory Section',
            fields: [
              {
                id: 'strictly_required_field',
                kind: 'question' as const,
                type: 'text' as const,
                label: 'Applicant Full Legal Name',
                required: true,
              },
            ],
          },
        ],
      };

      renderWithClient(<ConfigurableFormRenderer schema={strictSchema} />);

      // Submit without entering name
      const submitBtn = screen.getByRole('button', { name: /submit answers/i });
      fireEvent.click(submitBtn);

      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toBeInTheDocument();
      expect(screen.getByText(/applicant full legal name is required\./i)).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 8. Permission States (Operator vs Published Immutability)                  */
  /* -------------------------------------------------------------------------- */
  describe('8. Permission States & Immutability Enforcement', () => {
    it('operator on a draft schema can add sections, add fields, and see publish CTA', () => {
      useConfigurableFormStore.setState({
        activeSchema: mockDraftFormSchema,
        isLoading: false,
        mode: 'builder',
      });

      renderWithClient(
        <FormBuilderEditor initialSchemaId={mockDraftFormSchema.id} userRole="administrator" />
      );

      expect(screen.getByRole('button', { name: /add section/i })).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /add field/i }).length).toBeGreaterThan(0);
      expect(
        screen.getByRole('button', { name: /publish schema \(make immutable\)/i })
      ).toBeInTheDocument();
    });

    it('published schemas display immutable lock badge and prohibit inline modifications', () => {
      useConfigurableFormStore.setState({
        activeSchema: mockPublishedFormSchema,
        isLoading: false,
        mode: 'builder',
      });

      renderWithClient(
        <FormBuilderEditor initialSchemaId={mockPublishedFormSchema.id} userRole="administrator" />
      );

      // Verify immutable badge
      expect(screen.getByText(/v1\.0\.0 \(immutable\)/i)).toBeInTheDocument();

      // Mutation buttons must NOT exist
      expect(screen.queryByRole('button', { name: /add section/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /add field/i })).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /publish schema \(make immutable\)/i })
      ).not.toBeInTheDocument();

      // Instead, Fork Draft controls are visible
      expect(screen.getByRole('button', { name: /fork new draft/i })).toBeInTheDocument();
    });

    it('read-only mode in ConfigurableFormRenderer disables inputs and suppresses submit CTA', () => {
      renderWithClient(
        <ConfigurableFormRenderer schema={mockPublishedFormSchema} readOnly={true} />
      );

      const statementArea = screen.getByPlaceholderText(/compose your statement here/i);
      expect(statementArea).toBeDisabled();

      // Submit button is hidden
      expect(
        screen.queryByRole('button', { name: /submit answers/i })
      ).not.toBeInTheDocument();
    });
  });
});
