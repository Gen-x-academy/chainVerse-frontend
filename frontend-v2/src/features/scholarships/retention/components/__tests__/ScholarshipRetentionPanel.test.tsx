import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScholarshipRetentionPanel } from '../ScholarshipRetentionPanel';
import type { LegalHold, RetentionPolicy } from '../../types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { apiClient } from '@/src/lib/api-client';

const NOW = new Date('2025-03-01T00:00:00.000Z');

const POLICY: RetentionPolicy = {
  version: '2025.03',
  updatedAt: '2025-02-01T00:00:00.000Z',
  approvedBy: 'Privacy and Legal',
  rules: [
    {
      recordClass: 'draft',
      retentionDays: 30,
      basis: 'operational',
      legalBasis: 'Draft working copies are not evidence.',
      deletable: true,
      owner: 'Privacy and Legal',
    },
    {
      recordClass: 'awarded',
      retentionDays: null,
      basis: 'contractual',
      legalBasis: 'Award records under the programme contract.',
      deletable: false,
      owner: 'Finance operations',
    },
    {
      recordClass: 'financial',
      retentionDays: 2555,
      basis: 'legal',
      legalBasis: 'Statutory accounting retention.',
      deletable: true,
      owner: 'Finance operations',
    },
  ],
};

const RECORDS = [
  { id: 'rec-draft', applicantId: 'applicant-001', class: 'draft' as const, createdAt: '2024-12-01T00:00:00.000Z' },
  { id: 'rec-awarded', applicantId: 'applicant-001', class: 'awarded' as const, createdAt: '2024-01-01T00:00:00.000Z' },
  { id: 'rec-financial', applicantId: 'applicant-001', class: 'financial' as const, createdAt: '2024-01-01T00:00:00.000Z' },
];

const HOLD: LegalHold = {
  id: 'hold-1',
  subjectId: 'applicant-002',
  scope: ['draft'],
  reason: 'Dispute investigation',
  placedAt: '2025-02-01T00:00:00.000Z',
  placedBy: 'legal-1',
};

function mockOk(holds: LegalHold[] = []) {
  mockGet
    .mockResolvedValueOnce(POLICY)
    .mockResolvedValueOnce(holds);
}

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

describe('ScholarshipRetentionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('announces loading first', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<ScholarshipRetentionPanel now={NOW} />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading the retention policy/i);
  });

  it('renders an error state that blocks erasure', async () => {
    mockGet.mockRejectedValue(new Error('policy service 500'));
    render(<ScholarshipRetentionPanel now={NOW} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not be loaded/i);
    expect(alert).toHaveTextContent(/policy service 500/);
    expect(alert).toHaveTextContent(/erasure stays blocked/i);
  });

  it('renders an empty state when no rules are approved', async () => {
    mockGet
      .mockReset()
      .mockResolvedValueOnce({ ...POLICY, rules: [] })
      .mockResolvedValueOnce([]);
    render(<ScholarshipRetentionPanel now={NOW} />);

    expect(await screen.findByText(/no retention rules are approved yet/i)).toBeInTheDocument();
  });

  it('renders the rule table with the basis and the integrity statement', async () => {
    mockOk([]);
    render(<ScholarshipRetentionPanel now={NOW} records={RECORDS} />);

    const table = await screen.findByRole('table');
    expect(table).toHaveTextContent('contractual');
    expect(table).toHaveTextContent('Statutory accounting retention.');
    expect(table).toHaveTextContent('No — protected');
    expect(
      screen.getAllByText(/financial and audit integrity is never broken/i).length
    ).toBeGreaterThan(0);
  });

  it('splits the erasure preview into deletable and protected records', async () => {
    mockOk([]);
    render(<ScholarshipRetentionPanel now={NOW} records={RECORDS} />);

    await waitFor(() => expect(screen.getByText(/will be deleted \(1\)/i)).toBeInTheDocument());
    const deletable = screen.getByRole('list', { name: 'Records to delete' });
    expect(deletable).toHaveTextContent('rec-draft');
    expect(deletable).not.toHaveTextContent('rec-financial');

    expect(screen.getByText(/protected \(2\)/i)).toBeInTheDocument();
    const protectedRecords = screen.getByRole('list', { name: 'Protected records' });
    expect(protectedRecords).toHaveTextContent('rec-awarded');
    expect(protectedRecords).toHaveTextContent('rec-financial');
    expect(protectedRecords).toHaveTextContent('retained on a contractual basis');
    expect(protectedRecords).toHaveTextContent('retained on a legal basis');
    expect(protectedRecords).toHaveTextContent('financial records are never deleted');
  });

  it('renders an empty preview when the applicant has no records', async () => {
    mockOk([]);
    render(<ScholarshipRetentionPanel now={NOW} records={RECORDS} />);

    await screen.findByRole('table');
    await userEvent.clear(screen.getByLabelText(/subject \(applicant or record id\)/i));
    await userEvent.type(screen.getByLabelText(/subject \(applicant or record id\)/i), 'nobody');

    expect(await screen.findByText(/no records found for this applicant/i)).toBeInTheDocument();
  });

  it('reports a permission-denied state and disables hold actions', async () => {
    mockOk([]);
    render(<ScholarshipRetentionPanel canManage={false} now={NOW} records={RECORDS} />);

    expect(await screen.findByRole('note')).toHaveTextContent(
      /do not have permission to place or release holds/i
    );
    expect(screen.getByRole('button', { name: /place legal hold/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /place legal hold/i })).toHaveAttribute(
      'aria-busy',
      'false'
    );
  });

  it('validates the hold reason with a described error', async () => {
    mockOk([]);
    const user = userEvent.setup();
    render(<ScholarshipRetentionPanel now={NOW} records={RECORDS} />);

    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: /place legal hold/i }));

    const message = await screen.findByRole('alert');
    expect(message).toHaveTextContent(/at least 8 characters/i);
    const reason = screen.getByLabelText(/reason/i);
    expect(reason).toHaveAttribute('aria-invalid', 'true');
    expect(reason).toHaveAttribute('aria-describedby', message.id);
  });

  it('blocks deletion once a hold is placed', async () => {
    mockOk([]);
    mockPost.mockResolvedValue({
      id: 'hold-new',
      subjectId: 'applicant-001',
      scope: ['draft'],
      reason: 'Dispute investigation',
      placedAt: '2025-02-20T00:00:00.000Z',
      placedBy: 'privacy-officer',
    });

    const user = userEvent.setup();
    render(<ScholarshipRetentionPanel now={NOW} records={RECORDS} />);

    await waitFor(() => expect(screen.getByText(/will be deleted \(1\)/i)).toBeInTheDocument());
    await user.type(screen.getByLabelText(/reason/i), 'Dispute investigation');
    await user.click(screen.getByRole('button', { name: /place legal hold/i }));

    await waitFor(() => expect(screen.getByText(/will be deleted \(0\)/i)).toBeInTheDocument());
    expect(screen.getByText(/blocked by legal hold\(s\): hold-new/i)).toBeInTheDocument();
  });

  it('lists an active hold and releases it', async () => {
    mockOk([HOLD]);
    mockPost.mockResolvedValue({ ...HOLD, releasedAt: '2025-02-25T00:00:00.000Z' });

    const user = userEvent.setup();
    render(<ScholarshipRetentionPanel now={NOW} records={RECORDS} />);

    await screen.findByRole('table');
    expect(screen.getByText(/dispute investigation/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /release hold-1/i }));

    expect(await screen.findByText(/released legal hold hold-1/i)).toBeInTheDocument();
  });
});
