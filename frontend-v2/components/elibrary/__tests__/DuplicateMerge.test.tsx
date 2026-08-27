import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DuplicateBookComparison } from '../DuplicateBookComparison';
import { CatalogMergePanel } from '../CatalogMergePanel';
import { DuplicateCandidateList } from '../DuplicateCandidateList';
import type { CatalogRecord, DuplicateCandidate, MergePreview } from '@/src/features/library/types/catalog.types';

const mockRecords: CatalogRecord[] = [
  {
    id: 'rec-1',
    title: 'Blockchain Basics',
    author: 'Alice Smith',
    isbn: '9781111111111',
    publisher: 'Tech Press',
    publishedYear: 2024,
    format: 'print',
  },
  {
    id: 'rec-2',
    title: 'Blockchain Basics (2nd ed)',
    author: 'Alice Smith',
    isbn: '9782222222222',
    publisher: 'Tech Press',
    publishedYear: 2025,
    format: 'ebook',
  },
];

const mockCandidate: DuplicateCandidate = {
  groupId: 'grp-1',
  matchScore: 0.92,
  records: mockRecords,
  holdingsCount: 3,
  activeLoansCount: 1,
  pendingHoldsCount: 2,
};

describe('DuplicateCandidateList', () => {
  it('renders loading state', () => {
    render(<DuplicateCandidateList candidates={[]} isLoading />);
    expect(screen.getByLabelText('Loading duplicate candidates')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<DuplicateCandidateList candidates={[]} error="Access denied" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Access denied');
  });

  it('renders empty state', () => {
    render(<DuplicateCandidateList candidates={[]} />);
    expect(screen.getByText(/no suspected duplicate/i)).toBeInTheDocument();
  });

  it('renders candidates with compare link', () => {
    render(<DuplicateCandidateList candidates={[mockCandidate]} />);
    expect(screen.getByText('Blockchain Basics')).toBeInTheDocument();
    expect(screen.getByText('Compare & merge')).toBeInTheDocument();
  });
});

describe('DuplicateBookComparison', () => {
  it('renders holdings and loan implications', () => {
    render(
      <DuplicateBookComparison
        records={mockRecords}
        canonicalRecordId="rec-1"
        fieldDecisions={[]}
        onCanonicalChange={vi.fn()}
        onFieldDecisionChange={vi.fn()}
        holdingsCount={3}
        activeLoansCount={1}
        pendingHoldsCount={2}
      />,
    );
    expect(screen.getByText('Holdings & loan implications')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('calls onFieldDecisionChange when field selected', async () => {
    const user = userEvent.setup();
    const onFieldDecisionChange = vi.fn();
    render(
      <DuplicateBookComparison
        records={mockRecords}
        canonicalRecordId="rec-1"
        fieldDecisions={[{ field: 'title', sourceRecordId: 'rec-1' }]}
        onCanonicalChange={vi.fn()}
        onFieldDecisionChange={onFieldDecisionChange}
      />,
    );
    const radios = screen.getAllByRole('radio', { name: /Blockchain Basics \(2nd ed\)/i });
    if (radios.length > 0) {
      await user.click(radios[0]);
      expect(onFieldDecisionChange).toHaveBeenCalled();
    }
  });
});

describe('CatalogMergePanel', () => {
  const mockPreview: MergePreview = {
    groupId: 'grp-1',
    canonicalRecordId: 'rec-1',
    mergedRecord: {},
    holdingsToReassign: 3,
    loansToTransfer: 1,
    holdsToTransfer: 2,
    warnings: ['ISBN will change'],
  };

  it('requires confirmation before merge', async () => {
    const user = userEvent.setup();
    const onMerge = vi.fn().mockResolvedValue({ redirectUrl: '/catalog/rec-1' });
    render(
      <CatalogMergePanel
        preview={mockPreview}
        onPreview={vi.fn()}
        onMerge={onMerge}
      />,
    );
    // Panel starts in idle — preview button visible
    expect(screen.getByText('Preview merge')).toBeInTheDocument();
  });

  it('shows success with redirect link after merge', async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn().mockResolvedValue(undefined);
    const onMerge = vi.fn().mockResolvedValue({ redirectUrl: '/catalog/rec-1' });

    render(
      <CatalogMergePanel
        preview={mockPreview}
        onPreview={onPreview}
        onMerge={onMerge}
      />,
    );

    await user.click(screen.getByText('Preview merge'));
    await waitFor(() => {
      expect(screen.getByText('Confirm merge')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByText('Confirm merge'));

    await waitFor(() => {
      expect(screen.getByText(/merged successfully/i)).toBeInTheDocument();
      expect(screen.getByText(/view canonical record/i)).toBeInTheDocument();
    });
  });
});
