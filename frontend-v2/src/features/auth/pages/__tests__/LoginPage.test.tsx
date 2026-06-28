import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginPage } from '../LoginPage';
import { authService } from '../../services/auth.service';
import { useRouter } from 'next/navigation';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('../../services/auth.service', () => ({
  authService: {
    login: vi.fn(),
  },
}));

vi.mock('@/src/store/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      login: vi.fn(),
      logout: vi.fn(),
    }),
  },
}));

const mockReplace = vi.fn();

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({ replace: mockReplace });
  });

  it('renders email and password inputs', () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText(/you@example\.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('shows validation errors on empty submit', async () => {
    render(<LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: /login/i }));
    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
  });

  it('calls authService.login with correct values on valid submit', async () => {
    (authService.login as ReturnType<typeof vi.fn>).mockResolvedValue({ expiresIn: 3600 });
    render(<LoginPage />);
    await userEvent.type(screen.getByPlaceholderText(/you@example\.com/i), 'user@test.com');
    await userEvent.type(screen.getByPlaceholderText(/••••••••/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /login/i }));
    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith({
        email: 'user@test.com',
        password: 'password123',
      });
    });
  });

  it('redirects to dashboard on success', async () => {
    (authService.login as ReturnType<typeof vi.fn>).mockResolvedValue({ expiresIn: 3600 });
    render(<LoginPage />);
    await userEvent.type(screen.getByPlaceholderText(/you@example\.com/i), 'user@test.com');
    await userEvent.type(screen.getByPlaceholderText(/••••••••/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /login/i }));
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows API error message on login failure', async () => {
    (authService.login as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Invalid email or password')
    );
    render(<LoginPage />);
    await userEvent.type(screen.getByPlaceholderText(/you@example\.com/i), 'user@test.com');
    await userEvent.type(screen.getByPlaceholderText(/••••••••/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /login/i }));
    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
  });

  it('shows fallback error message when error has no message', async () => {
    (authService.login as ReturnType<typeof vi.fn>).mockRejectedValue('unknown');
    render(<LoginPage />);
    await userEvent.type(screen.getByPlaceholderText(/you@example\.com/i), 'user@test.com');
    await userEvent.type(screen.getByPlaceholderText(/••••••••/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /login/i }));
    expect(await screen.findByText(/login failed/i)).toBeInTheDocument();
  });
});
