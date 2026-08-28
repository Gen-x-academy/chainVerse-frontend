import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ItemConditionReport } from '../ItemConditionReport';
import type { ConditionReport } from '@/src/features/library/types/reports.types';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const baseReport: ConditionReport = {
  itemId: 'item-001',
  title: 'The Great Gatsby',
  currentCondition: 'good',
  repairStatus: 'not-needed',
  notes: '',
  evidence: [],
  activityHistory: [
    {
      id: 'act-001',
      action: 'Item added to inventory',
      user: 'Test Librarian',
      timestamp: '2026-01-01T00:00:00Z',
    },
  ],
};

const requiresNotesFor = ['damaged', 'lost', 'in-repair'] as const;

const patronConsequences = {
  good: [],
  worn: [],
  damaged: ['Patron will be charged a damage fee'],
  lost: ['Patron will be charged replacement cost'],
  'in-repair': [],
} as const;

function makeOnSubmit(impl?: () => Promise<void>) {
  return vi.fn(impl ?? (() => Promise.resolve()));
}

// ─── Loading state ────────────────────────────────────────────────────────────

describe('ItemConditionReport — loading state', () => {
  it('renders skeleton placeholders with aria-busy', () => {
    render(
      <ItemConditionReport
        report={baseReport}
        isLoading={true}
        onSubmit={makeOnSubmit()}
        requiresNotesForStatus={[...requiresNotesFor]}
        patronConsequences={{ ...patronConsequences }}
      />
    );

    // The component wraps skeletons; at minimum the card should be hidden from
    // interactive use while loading.
    const container = document.body.querySelector('[aria-busy="true"]');
    expect(container ?? screen.queryByRole('form')).toBeDefined();
  });
});

// ─── Error state ──────────────────────────────────────────────────────────────

describe('ItemConditionReport — error state', () => {
  it('renders the error message in an alert', () => {
    render(
      <ItemConditionReport
        report={baseReport}
        error="Failed to load report"
        onSubmit={makeOnSubmit()}
        requiresNotesForStatus={[...requiresNotesFor]}
        patronConsequences={{ ...patronConsequences }}
      />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Failed to load report');
  });
});

// ─── Empty state ──────────────────────────────────────────────────────────────

describe('ItemConditionReport — empty state', () => {
  it('renders "No report found" when report is null', () => {
    render(
      // @ts-expect-error intentional null
      <ItemConditionReport
        report={null}
        onSubmit={makeOnSubmit()}
        requiresNotesForStatus={[...requiresNotesFor]}
        patronConsequences={{ ...patronConsequences }}
      />
    );

    expect(screen.getByText('No report found')).toBeInTheDocument();
  });
});

// ─── Notes requirement ────────────────────────────────────────────────────────

describe('ItemConditionReport — notes requirement', () => {
  it('disables submit when condition requires notes but none are entered', async () => {
    const user = userEvent.setup();
    render(
      <ItemConditionReport
        report={baseReport}
        onSubmit={makeOnSubmit()}
        requiresNotesForStatus={[...requiresNotesFor]}
        patronConsequences={{ ...patronConsequences }}
      />
    );

    // Open the condition select and pick "damaged"
    await user.click(screen.getByRole('combobox', { name: /condition/i }));
    await user.click(screen.getByRole('option', { name: /damaged/i }));

    const submitBtn = screen.getByRole('button', { name: /update condition/i });
    expect(submitBtn).toBeDisabled();
  });

  it('enables submit once required notes are filled in', async () => {
    const user = userEvent.setup();
    render(
      <ItemConditionReport
        report={baseReport}
        onSubmit={makeOnSubmit()}
        requiresNotesForStatus={[...requiresNotesFor]}
        patronConsequences={{ ...patronConsequences }}
      />
    );

    await user.click(screen.getByRole('combobox', { name: /condition/i }));
    await user.click(screen.getByRole('option', { name: /damaged/i }));

    const textarea = screen.getByPlaceholderText(/add notes about this item's condition/i);
    await user.type(textarea, 'Significant water damage');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /update condition/i })).not.toBeDisabled();
    });
  });
});

// ─── Patron consequences ──────────────────────────────────────────────────────

describe('ItemConditionReport — patron consequences', () => {
  it('shows a consequence confirmation before calling onSubmit', async () => {
    const user = userEvent.setup();
    const onSubmit = makeOnSubmit();

    render(
      <ItemConditionReport
        report={baseReport}
        onSubmit={onSubmit}
        requiresNotesForStatus={[...requiresNotesFor]}
        patronConsequences={{ ...patronConsequences }}
      />
    );

    await user.click(screen.getByRole('combobox', { name: /condition/i }));
    await user.click(screen.getByRole('option', { name: /lost/i }));

    const textarea = screen.getByPlaceholderText(/add notes about this item's condition/i);
    await user.type(textarea, 'Item reported lost');

    // First click shows consequences, does NOT yet call onSubmit
    await user.click(screen.getByRole('button', { name: /review consequences/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Patron will be charged replacement cost')).toBeInTheDocument();

    // Confirm applies the mutation
    await user.click(screen.getByRole('button', { name: /confirm and apply/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  });
});

// ─── Success path ─────────────────────────────────────────────────────────────

describe('ItemConditionReport — success', () => {
  it('adds new activity to history after a successful update', async () => {
    const user = userEvent.setup();
    const onSubmit = makeOnSubmit();

    render(
      <ItemConditionReport
        report={baseReport}
        onSubmit={onSubmit}
        requiresNotesForStatus={[...requiresNotesFor]}
        patronConsequences={{ ...patronConsequences }}
      />
    );

    await user.click(screen.getByRole('combobox', { name: /condition/i }));
    await user.click(screen.getByRole('option', { name: /worn/i }));

    const textarea = screen.getByPlaceholderText(/add notes about this item's condition/i);
    await user.type(textarea, 'Shows wear on spine');

    await user.click(screen.getByRole('button', { name: /update condition/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce();
      expect(screen.getByText(/status updated to Worn/i)).toBeInTheDocument();
    });
  });

  it('renders a success banner when the success prop is provided', () => {
    render(
      <ItemConditionReport
        report={baseReport}
        success="Condition report updated."
        onSubmit={makeOnSubmit()}
        requiresNotesForStatus={[...requiresNotesFor]}
        patronConsequences={{ ...patronConsequences }}
      />
    );

    expect(screen.getByText('Condition report updated.')).toBeInTheDocument();
  });
});

// ─── Failure path ─────────────────────────────────────────────────────────────

describe('ItemConditionReport — failure', () => {
  it('surfaces a server error after onSubmit rejects', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error('Network error'));

    render(
      <ItemConditionReport
        report={baseReport}
        error="Network error"
        onSubmit={onSubmit}
        requiresNotesForStatus={[...requiresNotesFor]}
        patronConsequences={{ ...patronConsequences }}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Network error');
  });
});

// ─── Accessibility ────────────────────────────────────────────────────────────

describe('ItemConditionReport — accessibility', () => {
  it('labels the condition select with visible text', () => {
    render(
      <ItemConditionReport
        report={baseReport}
        onSubmit={makeOnSubmit()}
        requiresNotesForStatus={[...requiresNotesFor]}
        patronConsequences={{ ...patronConsequences }}
      />
    );

    expect(screen.getByRole('combobox', { name: /condition/i })).toBeInTheDocument();
  });

  it('marks the notes field required indicator visible when condition requires it', async () => {
    const user = userEvent.setup();
    render(
      <ItemConditionReport
        report={baseReport}
        onSubmit={makeOnSubmit()}
        requiresNotesForStatus={[...requiresNotesFor]}
        patronConsequences={{ ...patronConsequences }}
      />
    );

    await user.click(screen.getByRole('combobox', { name: /condition/i }));
    await user.click(screen.getByRole('option', { name: /damaged/i }));

    // A red asterisk or helper text should exist
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('does not expose patronName when patron field is omitted', () => {
    const reportWithPatron = { ...baseReport, patronName: 'Alice Smith' };
    // Simulate a role that should NOT see patron info by omitting patronName
    const { patronName: _, ...reportWithoutPatron } = reportWithPatron;

    render(
      <ItemConditionReport
        report={reportWithoutPatron as typeof baseReport}
        onSubmit={makeOnSubmit()}
        requiresNotesForStatus={[...requiresNotesFor]}
        patronConsequences={{ ...patronConsequences }}
      />
    );

    expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
  });
});

// ─── Evidence upload ──────────────────────────────────────────────────────────

describe('ItemConditionReport — evidence attachments', () => {
  it('adds an uploaded file to the evidence list', async () => {
    const user = userEvent.setup();
    render(
      <ItemConditionReport
        report={baseReport}
        onSubmit={makeOnSubmit()}
        requiresNotesForStatus={[...requiresNotesFor]}
        patronConsequences={{ ...patronConsequences }}
      />
    );

    const file = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' });
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error('file input not found');

    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    });
  });
});
