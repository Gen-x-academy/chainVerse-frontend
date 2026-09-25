import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AssetConfigForm } from '../components/AssetConfigForm';
import type { AssetConfig } from '../types';

vi.mock('../service', () => ({
  assetConfigService: {
    create: vi.fn(),
  },
}));

import { assetConfigService } from '../service';

const mockConfig: AssetConfig = {
  id: 'ac-001',
  programId: 'prog-001',
  asset: {
    code: 'USDC',
    type: 'issued',
    issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    decimals: 7,
    network: 'testnet',
  },
  trustlineRequirement: { required: true, reason: 'Issued asset.' },
  status: 'pending_review',
  createdAt: '2026-09-25T10:00:00.000Z',
  updatedAt: '2026-09-25T10:00:00.000Z',
};

describe('AssetConfigForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form with accessible heading', () => {
    render(<AssetConfigForm programId="prog-001" />);

    expect(screen.getByRole('heading', { name: /configure stellar asset/i })).toBeInTheDocument();
  });

  it('shows asset code and issuer fields when type is issued', () => {
    render(<AssetConfigForm programId="prog-001" />);

    expect(screen.getByLabelText(/asset code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/issuer account/i)).toBeInTheDocument();
  });

  it('hides asset code and issuer fields when native is selected', async () => {
    const user = userEvent.setup();
    render(<AssetConfigForm programId="prog-001" />);

    await user.selectOptions(screen.getByLabelText(/asset type/i), 'native');

    expect(screen.queryByLabelText(/asset code/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/issuer account/i)).not.toBeInTheDocument();
  });

  it('disables submit when asset code is empty (issued type)', () => {
    render(<AssetConfigForm programId="prog-001" />);

    const submit = screen.getByRole('button', { name: /save asset configuration/i });
    expect(submit).toBeDisabled();
  });

  it('submits the form and shows success state', async () => {
    vi.mocked(assetConfigService.create).mockResolvedValue(mockConfig);
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(<AssetConfigForm programId="prog-001" onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/asset code/i), 'USDC');
    await user.type(
      screen.getByLabelText(/issuer account/i),
      'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
    );

    await user.click(screen.getByRole('button', { name: /save asset configuration/i }));

    await waitFor(() => {
      expect(screen.getByText(/asset configuration saved/i)).toBeInTheDocument();
    });

    expect(onSuccess).toHaveBeenCalledWith(mockConfig);
  });

  it('shows error state when API call fails', async () => {
    vi.mocked(assetConfigService.create).mockRejectedValue(new Error('Asset not supported'));
    const user = userEvent.setup();

    render(<AssetConfigForm programId="prog-001" />);

    await user.type(screen.getByLabelText(/asset code/i), 'BADTOKEN');
    await user.type(screen.getByLabelText(/issuer account/i), 'GBADISSUER');

    await user.click(screen.getByRole('button', { name: /save asset configuration/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Asset not supported');
    });
  });

  it('button shows loading state while submitting', async () => {
    vi.mocked(assetConfigService.create).mockImplementation(
      () => new Promise(() => {})
    );
    const user = userEvent.setup();

    render(<AssetConfigForm programId="prog-001" />);
    await user.type(screen.getByLabelText(/asset code/i), 'USDC');
    await user.type(screen.getByLabelText(/issuer account/i), 'GISSUER');

    fireEvent.click(screen.getByRole('button', { name: /save asset configuration/i }));

    expect(await screen.findByRole('button', { name: /saving configuration/i })).toBeInTheDocument();
  });

  it('has no permission-gate rendering issues when programId is provided', () => {
    render(<AssetConfigForm programId="prog-001" />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('success state allows creating another configuration', async () => {
    vi.mocked(assetConfigService.create).mockResolvedValue(mockConfig);
    const user = userEvent.setup();

    render(<AssetConfigForm programId="prog-001" />);
    await user.type(screen.getByLabelText(/asset code/i), 'USDC');
    await user.type(
      screen.getByLabelText(/issuer account/i),
      'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
    );
    await user.click(screen.getByRole('button', { name: /save asset configuration/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /configure another asset/i })).toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: /configure another asset/i }));

    expect(screen.getByRole('button', { name: /save asset configuration/i })).toBeInTheDocument();
  });
});
