import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { CatalogExportControls } from '../CatalogExportControls';
import { ExportJobStatus } from '../ExportJobStatus';
import type { ExportJob, ExportScopeSummary } from '@/src/features/library/types/export.types';

const mockScope: ExportScopeSummary = {
  estimatedRecords: 1500,
  estimatedHoldings: 3200,
  filters: { includeHoldings: true },
};

describe('CatalogExportControls', () => {
  it('disables submit until scope confirmed', () => {
    render(
      <CatalogExportControls
        scopeSummary={mockScope}
        onPreview={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText('Start export')).toBeDisabled();
  });

  it('enables submit after confirmation', async () => {
    const user = userEvent.setup();
    render(
      <CatalogExportControls
        scopeSummary={mockScope}
        onPreview={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByText('Start export')).not.toBeDisabled();
  });

  it('calls onPreview with filters', async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn().mockResolvedValue(undefined);
    render(
      <CatalogExportControls
        scopeSummary={null}
        onPreview={onPreview}
        onSubmit={vi.fn()}
      />,
    );
    await user.click(screen.getByText('Preview scope'));
    expect(onPreview).toHaveBeenCalledWith(
      expect.objectContaining({ includeHoldings: true }),
      'csv',
    );
  });
});

describe('ExportJobStatus', () => {
  it('renders empty state', () => {
    render(<ExportJobStatus jobs={[]} />);
    expect(screen.getByText(/no export jobs yet/i)).toBeInTheDocument();
  });

  it('shows download link for completed jobs', () => {
    const jobs: ExportJob[] = [{
      id: 'exp-1',
      status: 'completed',
      format: 'csv',
      filters: { includeHoldings: false },
      estimatedRecords: 100,
      downloadUrl: '/downloads/exp-1.csv',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      createdAt: new Date().toISOString(),
    }];
    render(<ExportJobStatus jobs={jobs} />);
    expect(screen.getByText('Download')).toHaveAttribute('href', '/downloads/exp-1.csv');
  });

  it('shows expired status visibly', () => {
    const jobs: ExportJob[] = [{
      id: 'exp-2',
      status: 'expired',
      format: 'json',
      filters: { includeHoldings: false },
      estimatedRecords: 50,
      expiresAt: new Date(Date.now() - 86400000).toISOString(),
      createdAt: new Date().toISOString(),
    }];
    render(<ExportJobStatus jobs={jobs} />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getByText('Link expired')).toBeInTheDocument();
  });
});
