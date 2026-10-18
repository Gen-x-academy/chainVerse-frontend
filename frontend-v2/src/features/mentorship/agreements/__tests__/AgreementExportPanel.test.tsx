import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgreementExportPanel } from '../components/AgreementExportPanel';

vi.mock('../agreement-export.service', () => ({
  agreementExportService: {
    request: vi.fn(),
    download: vi.fn(),
  },
  trackAgreementExportRequested: vi.fn(),
}));

import {
  agreementExportService,
  trackAgreementExportRequested,
} from '../agreement-export.service';
import type { AgreementExportJob } from '../agreement-export';

const mockRequest = vi.mocked(agreementExportService.request);
const mockDownload = vi.mocked(agreementExportService.download);
const mockTrack = vi.mocked(trackAgreementExportRequested);

const JOB: AgreementExportJob = {
  id: 'job-1',
  agreementId: 'agreement-1',
  engagementId: 'engagement-1',
  requestedBy: 'mentee-1',
  format: 'json',
  requestedAt: '2026-05-01T10:00:00.000Z',
  expiresAt: '2026-05-01T10:15:00.000Z',
  downloadToken: 'token-1',
  status: 'ready',
  bundle: {
    schemaVersion: 1,
    agreementId: 'agreement-1',
    engagementId: 'engagement-1',
    generatedAt: '2026-05-01T10:00:00.000Z',
    generatedFor: { participantId: 'mentee-1', role: 'mentee' },
    terms: {
      version: 1,
      acceptedAt: '2026-04-01T09:00:00.000Z',
      goals: [],
      sessionsPerMonth: 1,
      sessionMinutes: 60,
      startDate: '2026-04-01',
      endDate: '2026-06-30',
      communicationChannel: 'video',
      confidentiality: true,
    },
    amendments: [],
    approvals: [],
    sessions: {
      total: 0,
      scheduled: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0,
      completedMinutes: 0,
      items: [],
    },
    financials: {
      currency: 'USDC',
      agreedMinor: 0,
      paidMinor: 0,
      refundedMinor: 0,
      outstandingMinor: 0,
    },
    privacy: { privateNotesExcluded: true, excludedFields: [] },
  },
};

describe('AgreementExportPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('denies export to a non-participant', () => {
    render(<AgreementExportPanel agreementId="agreement-1" canExport={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/only participants/i);
    expect(screen.queryByRole('button', { name: /generate export/i })).not.toBeInTheDocument();
  });

  it('shows an empty state before the first export', () => {
    render(<AgreementExportPanel agreementId="agreement-1" canExport />);
    expect(screen.getByRole('status')).toHaveTextContent(/no export has been generated yet/i);
  });

  it('requests an export and announces success', async () => {
    mockRequest.mockResolvedValue(JOB);
    const user = userEvent.setup();
    render(<AgreementExportPanel agreementId="agreement-1" canExport />);

    await user.click(screen.getByRole('button', { name: /generate export/i }));

    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1));
    expect(mockRequest).toHaveBeenCalledWith('agreement-1', {
      format: 'json',
      idempotencyKey: expect.any(String),
    });
    expect(await screen.findByText(/export ready/i)).toBeInTheDocument();
    expect(mockTrack).toHaveBeenCalledWith(JOB, 'participant');
  });

  it('supports selecting a format before generating', async () => {
    mockRequest.mockResolvedValue(JOB);
    const user = userEvent.setup();
    render(<AgreementExportPanel agreementId="agreement-1" canExport />);

    await user.selectOptions(screen.getByLabelText(/export format/i), 'csv');
    await user.click(screen.getByRole('button', { name: /generate export/i }));

    await waitFor(() =>
      expect(mockRequest).toHaveBeenCalledWith(
        'agreement-1',
        expect.objectContaining({ format: 'csv' }),
      ),
    );
  });

  it('reports a stable, actionable error and allows a retry', async () => {
    mockRequest.mockRejectedValueOnce(new Error('Too many requests. Try again later.'));
    const user = userEvent.setup();
    render(<AgreementExportPanel agreementId="agreement-1" canExport />);

    await user.click(screen.getByRole('button', { name: /generate export/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many requests/i);
    expect(screen.getByRole('button', { name: /generate export/i })).toBeEnabled();
  });

  it('downloads a ready export', async () => {
    mockRequest.mockResolvedValue(JOB);
    mockDownload.mockResolvedValue(JOB.bundle);
    const user = userEvent.setup();
    render(<AgreementExportPanel agreementId="agreement-1" canExport />);

    await user.click(screen.getByRole('button', { name: /generate export/i }));
    await user.click(await screen.findByRole('button', { name: /download export/i }));

    await waitFor(() => expect(mockDownload).toHaveBeenCalledWith('token-1'));
    expect(await screen.findByText(/export downloaded/i)).toBeInTheDocument();
  });

  it('can be operated from the keyboard', async () => {
    mockRequest.mockResolvedValue(JOB);
    const user = userEvent.setup();
    render(<AgreementExportPanel agreementId="agreement-1" canExport />);

    await user.tab();
    expect(screen.getByLabelText(/export format/i)).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: /generate export/i })).toHaveFocus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1));
  });
});
