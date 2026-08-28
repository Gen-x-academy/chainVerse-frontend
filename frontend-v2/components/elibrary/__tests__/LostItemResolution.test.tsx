import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LostItemResolution } from '../LostItemResolution';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseHistory = [
  {
    id: 'act-001',
    action: 'Item marked as lost',
    user: 'Test Librarian',
    timestamp: '2026-01-01T00:00:00Z',
    notes: 'Item not returned',
  },
];

const requiresNotesFor = ['paid', 'waived', 'disputed'] as const;

const patronConsequences = {
  found: ['Privileges reinstated'],
  paid: ['Payment received'],
  replaced: ['Item replaced'],
  waived: ['Fees waived'],
  disputed: ['Account suspended'],
} as const;

function makeOnResolve(impl?: () => Promise<void>) {
  return vi.fn(impl ?? (() => Promise.resolve()));
}

// ─── Loading state ────────────────────────────────────────────────────────────

describe('LostItemResolution — loading state', () => {
  it('renders skeleton placeholders while loading', () => {
    render(
      <LostItemResolution
        itemTitle="1984"
        replacementCost={29.99}
        status="disputed"
        activityHistory={baseHistory}
        isLoading={true}
        onResolve={makeOnResolve()}
        requiresNotesForStatus={[...requiresNotesFor]}
        patronConsequences={{ ...patronConsequences }}
      />
    );

    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

// ─── Error state ──────────────────────────────────────────────────────────────

describe('LostItemResolution — error state', () => {
  it('renders the error message in a destructive alert', () => {
    render(
      <LostItemResolution
        itemTitle="1984"
        replacementCost={29.99}
        status="disputed"
        activityHistory={baseHistory}
        error="Failed to load resolution data"
        onResolve={makeOnResolve()}
        requiresNotesForStatus={[...requiresNotesFor]}
        patronConsequences={{ ...patronConsequences }}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load resolution data');
  });
});

// ─── Notes requirement ────────────────────────────────────────────────────────

describe('LostItemResolution — notes requirement', () => {
  it('disables "Update Status" when notes are required but missing', async () => {
    const user = userEvent.setup();
    render(
      <LostItemResolution
        itemTitle="1984"
        replacementCost={29.99}
        status="found"
        activityHistory={baseHistory}
        onResolve={makeOnResolve()}
        requiresNotesForStatus={[...requiresNotesFor]}
        patronConsequences={{ ...patronConsequences }}
      />
    );

    // Switch to "waived" which requires notes
    await user.click(screen.getByRole('button', { name: /waived/i }));

    const updateBtn = screen.getByRole('button', { name: /update status/i });
    expect(updateBtn).toBeDisabled();
  });

  it('enables submit once required notes are provided', async () => {
    const user = userEvent.setup();
    render(
      <LostItemResolution
        itemTitle="1984"
        replacementCost={29.99}
        status="found"
        activityHistory={baseHistory}
        onResolve={makeOnResolve()}
        requiresNotesForStatus={[...requiresNotesFor]}
        patronConsequences={{ ...patronConsequences }}
      />
    );

    await user.click(screen.getByRole('button', { name: /waived/i }));

    const textarea = screen.getByPlaceholderText(/add notes about this resolution/i);
    await user.type(textarea, 'Fees waived per library policy');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /update status/i })).not.toBeDisabled();
    });
  });
});

// ─── Patron consequences ──────────────────────────────────────────────────────

describe('LostItemResolution — patron consequences', () => {
  it('shows consequence screen before calling onResolve', async () => {
    const user = userEvent.setup();
    const onResolve = makeOnResolve();

    render(
      <LostItemResolution
        itemTitle="1984"
        replacementCost={29.99}
        status="found"
        activityHistory={baseHistory}
        onResolve={onResolve}
        requiresNotesForStatus={[...requiresNotesFor]}
        patronConsequences={{ ...patronConsequences }}
      />
    );

    // Switch to "disputed" (has consequences + requires notes)
    await user.click(screen.getByRole('button', { name: /disputed/i }));

    const textarea = screen.getByPlaceholderText(/add notes about this resolution/i);
    await user.type(textarea, 'Dispute filed by patron');

    // First click → review consequences
    await user.click(screen.getByRole('button', { name: /review consequences/i }));
    expect(onResolve).not.toHaveBeenCalled();
    expect(screen.getByText('Account suspended')).toBeInTheDocument();

    // Confirm → mutation fires
    await user.click(screen.getByRole('button', { name: /confirm and apply/i }));
    await waitFor(() => {
      expect(onResolve).toHaveBeenCalledWith('disputed', 'Dispute filed by patron');
    });
  });
});

// ─── Success path ─────────────────────────────────────────────────────────────

describe('LostItemResolution — success', () => {
  it('adds a new entry to resolution history after a successful update', async () => {
    const user = userEvent.setup();
    const onResolve = makeOnResolve();

    render(
      <LostItemResolution
        itemTitle="1984"
        replacementCost={29.99}
        status="disputed"
        activityHistory={baseHistory}
        onResolve={onResolve}
        requiresNotesForStatus={[...requiresNotesFor]}
        patronConsequences={{ ...patronConsequences }}
      />
    );

    // Switch to "found" which has no notes requirement and shows direct submit
    await user.click(screen.getByRole('button', { name: /found/i }));

    const textarea = screen.getByPlaceholderText(/add notes about this resolution/i);
    await user.type(textarea, 'Item found in returns');

    await user.click(screen.getByRole('button', { name: /update status/i }));

    await waitFor(() => {
      expect(onResolve).toHaveBeenCalledWith('found', 'Item found in returns');
      expect(screen.getByText(/status updated to Found/i)).toBeInTheDocument();
    });
  });

  it('renders a success banner when the success prop is provided', () => {
    render(
      <LostItemResolution
        itemTitle="1984"
        replacementCost={29.99}
        status="found"
        activityHistory={baseHistory}
        success="Lost item status updated."
        onResolve={makeOnResolve()}
        requiresNotesForStatus={[...requiresNotesFor]}
        patronConsequences={{ ...patronConsequences }}
      />
    );

    expect(screen.getByText('Lost item status updated.')).toBeInTheDocument();
  });
});

// ─── Cancel flow ──────────────────────────────────────────────────────────────

describe('LostItemResolution — cancel', () => {
  it('restores the original status when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onResolve = makeOnResolve();

    render(
      <LostItemResolution
        itemTitle="1984"
        replacementCost={29.99}
        status="disputed"
        activityHistory={baseHistory}
        onResolve={onResolve}
        requiresNotesForStatus={[...requiresNotesFor]}
        patronConsequences={{ ...patronConsequences }}
      />
    );

    await user.click(screen.getByRole('button', { name: /paid/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(onResolve).not.toHaveBeenCalled();
      // The current-status badge should show "Disputed" again
      expect(screen.getByText('Disputed')).toBeInTheDocument();
    });
  });
});

// ─── Authorization (role-restricted patron field) ─────────────────────────────

describe('LostItemResolution — authorization', () => {
  it('does not render patronName when the prop is omitted', () => {
    render(
      <LostItemResolution
        itemTitle="1984"
        replacementCost={29.99}
        status="disputed"
        activityHistory={baseHistory}
        onResolve={makeOnResolve()}
        requiresNotesForStatus={[...requiresNotesFor]}
        patronConsequences={{ ...patronConsequences }}
      />
    );

    expect(screen.queryByText(/responsible patron/i)).not.toBeInTheDocument();
  });

  it('renders patronName when the prop is provided (admin-level view)', () => {
    render(
      <LostItemResolution
        itemTitle="1984"
        replacementCost={29.99}
        status="disputed"
        patronName="Alice Smith"
        activityHistory={baseHistory}
        onResolve={makeOnResolve()}
        requiresNotesForStatus={[...requiresNotesFor]}
        patronConsequences={{ ...patronConsequences }}
      />
    );

    expect(screen.getByText(/alice smith/i)).toBeInTheDocument();
  });
});

// ─── Accessibility ────────────────────────────────────────────────────────────

describe('LostItemResolution — accessibility', () => {
  it('status option buttons have accessible names', () => {
    render(
      <LostItemResolution
        itemTitle="1984"
        replacementCost={29.99}
        status="disputed"
        activityHistory={baseHistory}
        onResolve={makeOnResolve()}
        requiresNotesForStatus={[...requiresNotesFor]}
        patronConsequences={{ ...patronConsequences }}
      />
    );

    ['Found', 'Paid', 'Replaced', 'Waived', 'Disputed'].forEach((label) => {
      expect(screen.getByRole('button', { name: new RegExp(label, 'i') })).toHaveAccessibleName();
    });
  });

  it('notes textarea has an accessible label', async () => {
    const user = userEvent.setup();
    render(
      <LostItemResolution
        itemTitle="1984"
        replacementCost={29.99}
        status="disputed"
        activityHistory={baseHistory}
        onResolve={makeOnResolve()}
        requiresNotesForStatus={[...requiresNotesFor]}
        patronConsequences={{ ...patronConsequences }}
      />
    );

    // Trigger the notes section to appear
    await user.click(screen.getByRole('button', { name: /paid/i }));

    const textarea = screen.getByPlaceholderText(/add notes about this resolution/i);
    expect(textarea.tagName).toBe('TEXTAREA');
  });
});
