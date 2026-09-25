import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BudgetReservationPanel } from '../components/BudgetReservationPanel';
import type { BudgetReservation, ReservationPolicy } from '../types';

vi.mock('../store', () => ({
  useBudgetReservationStore: vi.fn(),
}));

import { useBudgetReservationStore } from '../store';

const POLICY: ReservationPolicy = { maxHoldHours: 48, maxBudgetCents: 100_000_00 };

const HELD_RESERVATION: BudgetReservation = {
  id: 'res-001',
  programId: 'prog-001',
  applicationId: 'app-001',
  decisionId: 'dec-001',
  amountCents: 4_000_00,
  currency: 'USD',
  expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  status: 'held',
  idempotencyKey: 'idem-abc',
  createdAt: new Date().toISOString(),
};

const acquireMock = vi.fn();
const releaseMock = vi.fn();
const commitMock = vi.fn();

function mockIdleStore() {
  vi.mocked(useBudgetReservationStore).mockReturnValue({
    reservation: null,
    loading: false,
    error: null,
    acquire: acquireMock,
    release: releaseMock,
    commit: commitMock,
    reset: vi.fn(),
  } as ReturnType<typeof useBudgetReservationStore>);
}

const DEFAULT_PROPS = {
  programId: 'prog-001',
  applicationId: 'app-001',
  decisionId: 'dec-001',
  amountCents: 4_000_00,
  currency: 'USD',
  policy: POLICY,
  currentHeldCents: 0,
  currentCommittedCents: 0,
};

describe('BudgetReservationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIdleStore();
  });

  it('renders reserve button in idle state', () => {
    render(<BudgetReservationPanel {...DEFAULT_PROPS} />);

    expect(screen.getByRole('button', { name: /reserve budget/i })).toBeInTheDocument();
  });

  it('shows formatted award amount', () => {
    render(<BudgetReservationPanel {...DEFAULT_PROPS} />);

    expect(screen.getByText(/award amount/i)).toBeInTheDocument();
    // 400000 cents / 100 = $4,000.00; amount may appear in header and info row
    const amountEls = screen.getAllByText(/\$4,000\.00/i);
    expect(amountEls.length).toBeGreaterThan(0);
  });

  it('shows available budget', () => {
    render(<BudgetReservationPanel {...DEFAULT_PROPS} />);

    expect(screen.getByText(/available budget/i)).toBeInTheDocument();
    // maxBudgetCents=10000000 cents / 100 = $100,000.00
    const budgetEls = screen.getAllByText(/\$100,000\.00/i);
    expect(budgetEls.length).toBeGreaterThan(0);
  });

  it('calls acquire on button click', async () => {
    acquireMock.mockResolvedValue(HELD_RESERVATION);
    render(<BudgetReservationPanel {...DEFAULT_PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: /reserve budget/i }));

    await waitFor(() => expect(acquireMock).toHaveBeenCalledOnce());
  });

  it('shows loading state while acquiring', () => {
    vi.mocked(useBudgetReservationStore).mockReturnValue({
      reservation: null,
      loading: true,
      error: null,
      acquire: acquireMock,
      release: releaseMock,
      commit: commitMock,
      reset: vi.fn(),
    } as ReturnType<typeof useBudgetReservationStore>);

    render(<BudgetReservationPanel {...DEFAULT_PROPS} />);

    expect(screen.getByRole('button', { name: /reserving/i })).toBeDisabled();
  });

  it('shows error state from store', () => {
    vi.mocked(useBudgetReservationStore).mockReturnValue({
      reservation: null,
      loading: false,
      error: 'Insufficient program budget.',
      acquire: acquireMock,
      release: releaseMock,
      commit: commitMock,
      reset: vi.fn(),
    } as ReturnType<typeof useBudgetReservationStore>);

    render(<BudgetReservationPanel {...DEFAULT_PROPS} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Insufficient program budget.');
  });

  it('shows held reservation status with expiry', () => {
    vi.mocked(useBudgetReservationStore).mockReturnValue({
      reservation: HELD_RESERVATION,
      loading: false,
      error: null,
      acquire: acquireMock,
      release: releaseMock,
      commit: commitMock,
      reset: vi.fn(),
    } as ReturnType<typeof useBudgetReservationStore>);

    render(<BudgetReservationPanel {...DEFAULT_PROPS} />);

    expect(screen.getByRole('status')).toHaveTextContent(/reservation held/i);
    // "Expires:" appears in the held reservation status block
    const expiryElements = screen.getAllByText(/expires/i);
    expect(expiryElements.length).toBeGreaterThan(0);
  });

  it('shows commit and release buttons for held reservation', () => {
    vi.mocked(useBudgetReservationStore).mockReturnValue({
      reservation: HELD_RESERVATION,
      loading: false,
      error: null,
      acquire: acquireMock,
      release: releaseMock,
      commit: commitMock,
      reset: vi.fn(),
    } as ReturnType<typeof useBudgetReservationStore>);

    render(<BudgetReservationPanel {...DEFAULT_PROPS} />);

    expect(screen.getByRole('button', { name: /commit reservation/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /release reservation/i })).toBeInTheDocument();
  });

  it('calls release when release button is clicked', async () => {
    vi.mocked(useBudgetReservationStore).mockReturnValue({
      reservation: HELD_RESERVATION,
      loading: false,
      error: null,
      acquire: acquireMock,
      release: releaseMock,
      commit: commitMock,
      reset: vi.fn(),
    } as ReturnType<typeof useBudgetReservationStore>);
    releaseMock.mockResolvedValue({ ...HELD_RESERVATION, status: 'released' });

    render(<BudgetReservationPanel {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: /release reservation/i }));

    await waitFor(() => expect(releaseMock).toHaveBeenCalledWith('res-001'));
  });

  it('shows pre-check validation error when budget is exceeded', () => {
    render(
      <BudgetReservationPanel
        {...DEFAULT_PROPS}
        currentHeldCents={60_000_00}
        currentCommittedCents={50_000_00}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/exceed/i);
    expect(screen.getByRole('button', { name: /reserve budget/i })).toBeDisabled();
  });

  it('renders existing reservation in read-only mode via prop', () => {
    const committed: BudgetReservation = {
      ...HELD_RESERVATION,
      status: 'committed',
      committedAt: '2024-01-15T12:00:00Z',
    };
    render(<BudgetReservationPanel {...DEFAULT_PROPS} existingReservation={committed} />);

    expect(screen.getByRole('status')).toHaveTextContent(/reservation committed/i);
    // "Committed:" date label appears in the status block
    const committedEls = screen.getAllByText(/committed/i);
    expect(committedEls.length).toBeGreaterThan(0);
  });

  it('has accessible section landmark', () => {
    render(<BudgetReservationPanel {...DEFAULT_PROPS} />);

    expect(
      screen.getByRole('region', { name: /reserve award budget/i })
    ).toBeInTheDocument();
  });
});
