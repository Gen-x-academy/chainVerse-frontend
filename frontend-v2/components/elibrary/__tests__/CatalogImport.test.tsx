import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { CatalogImportUploader } from '../CatalogImportUploader';
import { ImportValidationReport } from '../ImportValidationReport';
import { ImportPreviewTable } from '../ImportPreviewTable';
import type { ImportPreviewResult, ImportJob } from '@/src/features/library/types/import.types';

const mockPreview: ImportPreviewResult = {
  jobId: 'job-1',
  totalRows: 10,
  validRows: 8,
  invalidRows: 2,
  skippedRows: 0,
  canImport: false,
  rows: [
    { row: 1, data: { title: 'Book A' }, status: 'valid', errors: [] },
    {
      row: 2,
      data: { title: '' },
      status: 'invalid',
      errors: [{ row: 2, field: 'title', message: 'Title required', severity: 'error' }],
    },
  ],
};

describe('CatalogImportUploader', () => {
  it('shows error when validating without file', async () => {
    const user = userEvent.setup();
    const onValidate = vi.fn();
    render(<CatalogImportUploader onValidate={onValidate} />);
    await user.click(screen.getByText(/validate import/i));
    expect(screen.getByRole('alert')).toHaveTextContent(/select a file/i);
    expect(onValidate).not.toHaveBeenCalled();
  });

  it('disables validate while validating', () => {
    render(<CatalogImportUploader onValidate={vi.fn()} isValidating />);
    expect(screen.getByText(/validating/i)).toBeDisabled();
  });
});

describe('ImportValidationReport', () => {
  it('renders loading state', () => {
    render(<ImportValidationReport preview={null} isLoading />);
    expect(screen.getByLabelText('Loading validation report')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(<ImportValidationReport preview={null} />);
    expect(screen.getByText(/upload a file/i)).toBeInTheDocument();
  });

  it('shows validation summary and errors', () => {
    render(<ImportValidationReport preview={mockPreview} />);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Title required')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/fix validation errors/i);
  });
});

describe('ImportPreviewTable', () => {
  it('shows start import when validation passes', () => {
    render(
      <ImportPreviewTable
        preview={{ ...mockPreview, canImport: true }}
        job={null}
        onStartImport={vi.fn()}
      />,
    );
    expect(screen.getByText('Start import')).toBeInTheDocument();
  });

  it('shows progress for running job', () => {
    const job: ImportJob = {
      id: 'job-1',
      status: 'importing',
      format: 'csv',
      fileName: 'catalog.csv',
      totalRows: 100,
      processedRows: 50,
      successCount: 48,
      failureCount: 2,
      createdAt: new Date().toISOString(),
    };
    render(
      <ImportPreviewTable preview={null} job={job} onStartImport={vi.fn()} />,
    );
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('48')).toBeInTheDocument();
  });
});
