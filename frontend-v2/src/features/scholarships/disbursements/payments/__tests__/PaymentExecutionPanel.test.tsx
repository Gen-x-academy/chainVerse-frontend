import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PaymentExecutionPanel } from '../components/PaymentExecutionPanel';
import type { PaymentBatchResult } from '../types';

vi.mock('../service', () => ({
  scheduledPaymentService: {
    executeBatch: vi.fn(),
  },
}));

import { scheduledPaymentService } from '../service';

const mockResult: PaymentBatchResult = {
  batchId: 'batch-001',
  batchKey: 'any-key',
  status: 'completed',
  totalItems: 3,
  successCount: 3,
  failureCount: 0,
  outcomes: [
    { scheduledPaymentId: 'sp-001', success: true, ledgerRef: 'ref-1' },
    { scheduledPaymentId: 'sp-002', success: true, ledgerRef: 'ref-2' },
    { scheduledPaymentId: 'sp-003', success: true, ledgerRef: 'ref-3' },
  ],
  startedAt: '2026-09-25T12:00:00.000Z',
  completedAt: '2026-09-25T12:00:10.000Z',
};

describe('PaymentExecutionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the execute button', () => {
    render(<PaymentExecutionPanel />);
    expect(screen.getByRole('button', { name: /execute payment batch/i })).toBeInTheDocument();
  });

  it('renders dry run option', () => {
    render(<PaymentExecutionPanel />);
    expect(screen.getByLabelText(/dry run/i)).toBeInTheDocument();
  });

  it('shows loading state while executing', async () => {
    vi.mocked(scheduledPaymentService.executeBatch).mockImplementation(
      () => new Promise(() => {})
    );
    const user = userEvent.setup();

    render(<PaymentExecutionPanel />);
    fireEvent.click(screen.getByRole('button', { name: /execute payment batch/i }));

    expect(await screen.findByRole('button', { name: /executing batch/i })).toBeInTheDocument();
  });

  it('shows batch result on success', async () => {
    vi.mocked(scheduledPaymentService.executeBatch).mockResolvedValue(mockResult);
    const onComplete = vi.fn();

    render(<PaymentExecutionPanel onBatchComplete={onComplete} />);
    await userEvent.click(screen.getByRole('button', { name: /execute payment batch/i }));

    await waitFor(() => {
      expect(screen.getByText(/batch result/i)).toBeInTheDocument();
    });

    expect(onComplete).toHaveBeenCalledWith(mockResult);
  });

  it('shows error state when batch execution fails', async () => {
    vi.mocked(scheduledPaymentService.executeBatch).mockRejectedValue(
      new Error('Batch execution failed.')
    );

    render(<PaymentExecutionPanel />);
    await userEvent.click(screen.getByRole('button', { name: /execute payment batch/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Batch execution failed.');
    });
  });

  it('shows simulate label when dry run is checked', async () => {
    render(<PaymentExecutionPanel />);
    await userEvent.click(screen.getByLabelText(/dry run/i));

    expect(screen.getByRole('button', { name: /simulate batch/i })).toBeInTheDocument();
  });

  it('resets state after clicking run another batch', async () => {
    vi.mocked(scheduledPaymentService.executeBatch).mockResolvedValue(mockResult);

    render(<PaymentExecutionPanel />);
    await userEvent.click(screen.getByRole('button', { name: /execute payment batch/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /run another batch/i })).toBeInTheDocument()
    );

    await userEvent.click(screen.getByRole('button', { name: /run another batch/i }));

    expect(screen.getByRole('button', { name: /execute payment batch/i })).toBeInTheDocument();
  });

  it('disables button when batch size is less than 1', async () => {
    render(<PaymentExecutionPanel />);
    const sizeInput = screen.getByLabelText(/batch size/i);
    await userEvent.clear(sizeInput);
    await userEvent.type(sizeInput, '0');

    expect(screen.getByRole('button', { name: /execute payment batch/i })).toBeDisabled();
  });

  it('screen-reader region announces loading state', async () => {
    vi.mocked(scheduledPaymentService.executeBatch).mockImplementation(
      () => new Promise(() => {})
    );

    render(<PaymentExecutionPanel />);
    fireEvent.click(screen.getByRole('button', { name: /execute payment batch/i }));

    await waitFor(() => {
      const liveRegion = document.querySelector('[aria-live="polite"]');
      expect(liveRegion?.textContent).toContain('Executing payment batch');
    });
  });
});
