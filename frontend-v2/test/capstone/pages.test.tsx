import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProjectConsentPage from '@/app/(main)/projects/[projectId]/consent/page';
import ProjectPrivacyPage from '@/app/(main)/projects/[projectId]/privacy/page';
import ProjectSecretsPage from '@/app/(main)/projects/[projectId]/secrets/page';
import ParticipantProjectsDashboardPage from '@/app/(main)/projects/dashboard/page';
import { useAuthStore } from '@/src/store/authStore';

// Mock useParams from next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ projectId: 'prj_capstone_stellar_1' }),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/projects/prj_capstone_stellar_1/workspace',
}));

describe('Capstone Page Integration (App Router Routes)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: 'usr_capstone_tester',
        email: 'tester@chainverse.org',
        role: 'student',
        tenantId: 'org_stellar_labs',
        organizationId: 'org_stellar_labs',
      },
      token: 'jwt-test-token',
    });
  });

  it('renders ProjectConsentPage for authenticated participant', () => {
    render(<ProjectConsentPage />);
    expect(screen.getByRole('heading', { name: /Capstone Consent Ledger/i })).toBeInTheDocument();
    expect(screen.getByText(/Project & Mentor Matching/i)).toBeInTheDocument();
  });

  it('renders ProjectPrivacyPage for authenticated participant', () => {
    render(<ProjectPrivacyPage />);
    expect(screen.getByRole('heading', { name: /Field-Level Privacy Controls/i })).toBeInTheDocument();
    expect(screen.getByText(/Participant Profiles/i)).toBeInTheDocument();
  });

  it('renders ProjectSecretsPage for authenticated participant', () => {
    render(<ProjectSecretsPage />);
    expect(screen.getByRole('heading', { name: /Project Secrets & Sensitive-Field Protection/i })).toBeInTheDocument();
    expect(screen.getByText(/External Provider API Tokens/i)).toBeInTheDocument();
  });

  it('renders ParticipantProjectsDashboardPage with operational sections and metrics', () => {
    render(<ParticipantProjectsDashboardPage />);
    expect(screen.getByRole('heading', { name: /Participant Project Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Active Projects & Work/i })).toBeInTheDocument();
  });

  it('renders permission denied message when unauthenticated', () => {
    useAuthStore.setState({
      isAuthenticated: false,
      user: undefined,
      token: null,
    });

    render(<ProjectConsentPage />);
    expect(screen.getByText(/Please sign in to view your capstone consent ledger/i)).toBeInTheDocument();
  });
});
