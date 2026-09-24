import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const authState = vi.hoisted(() => ({ role: 'admin' as string }));

vi.mock('@/src/store/authStore', () => ({
  useAuthStore: (selector: (state: { user: { id: string; role: string } }) => unknown) =>
    selector({ user: { id: 'staff-1', role: authState.role } }),
}));

vi.mock('@/src/features/library/services/library.service', () => ({
  libraryService: {
    getPatronProfile: vi.fn(),
    getPatronPolicy: vi.fn(),
    getPatronEligibility: vi.fn(),
    lookupByBarcode: vi.fn(),
    checkoutPhysical: vi.fn(),
  },
}));

import CirculationPage from '../page';

describe('CirculationPage', () => {
  beforeEach(() => {
    authState.role = 'admin';
  });

  it('renders the checkout flow for circulation staff', () => {
    render(<CirculationPage />);

    expect(screen.getByRole('button', { name: /find patron/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Scan barcode')).toBeInTheDocument();
  });

  it('blocks staff without circulation permission', () => {
    authState.role = 'student';

    render(<CirculationPage />);

    expect(screen.getByRole('alert')).toHaveTextContent(/access denied/i);
    expect(screen.queryByRole('button', { name: /find patron/i })).not.toBeInTheDocument();
  });
});
