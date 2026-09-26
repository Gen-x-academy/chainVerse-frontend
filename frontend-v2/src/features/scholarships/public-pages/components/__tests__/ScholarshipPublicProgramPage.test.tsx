import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScholarshipPublicProgramPage } from '../ScholarshipPublicProgramPage';
import { publish, toPublicPage, type PublishableProgram } from '../../service';
import type { PublicPageRevision } from '../../types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const PUBLISHED_AT = '2026-05-04T10:00:00.000Z';

function program(overrides: Partial<PublishableProgram> = {}): PublishableProgram {
  return {
    programId: 'chainverse-scholarship',
    title: 'ChainVerse Scholarship',
    summary: 'Support for students building in public.',
    description: 'A full-year scholarship for open-source builders.',
    sponsorName: 'ChainVerse Foundation',
    currency: 'USD',
    awardAmountCents: 400000,
    applicationDeadline: '2026-06-30T23:59:00.000Z',
    eligibilitySummary: ['Enrolled at an accredited institution', 'At least 16 years old'],
    visibility: 'public',
    updatedAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

function published(overrides: Partial<PublishableProgram> = {}) {
  const outcome = publish(program(overrides), 'chainverse-scholarship', {
    publishedAt: PUBLISHED_AT,
    publishedBy: 'admin-1',
  });
  return outcome.result.page!;
}

const REVISION: PublicPageRevision = {
  slug: 'chainverse-scholarship',
  revision: 1,
  publishedAt: PUBLISHED_AT,
  publishedBy: 'admin-1',
  checksum: 'fnv1a-1a2b3c4d',
  note: 'Published revision 1.',
};

describe('ScholarshipPublicProgramPage', () => {
  it('renders a loading status', () => {
    render(<ScholarshipPublicProgramPage slug="chainverse-scholarship" state="loading" page={null} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/Loading public program page/i);
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('renders an error alert with a next step', () => {
    render(
      <ScholarshipPublicProgramPage
        slug="chainverse-scholarship"
        page={null}
        state="error"
        errorMessage="Not found"
      />
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Not found');
    expect(alert).toHaveTextContent(/Next step/i);
  });

  it('renders an empty status when nothing is published', () => {
    render(<ScholarshipPublicProgramPage slug="chainverse-scholarship" page={null} state="ready" />);
    expect(screen.getByRole('status')).toHaveTextContent(/No public program page/i);
  });

  it('renders an explicit not-available state when publication is refused', () => {
    render(
      <ScholarshipPublicProgramPage
        slug="invite-only"
        page={toPublicPage(program({ visibility: 'invitation-only' }), 'invite-only')}
        state="ready"
      />
    );
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent(/not available publicly/i);
    expect(screen.getByText(/invitation-only/)).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/shareable link/i);
  });

  it('renders the published program with correct heading order and no private fields', () => {
    render(
      <ScholarshipPublicProgramPage
        slug="chainverse-scholarship"
        page={published()}
        revisions={[REVISION]}
        state="ready"
      />
    );

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('ChainVerse Scholarship');
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Program facts',
      'About this program',
      'Who can apply',
      'Share this page',
      'Indexable metadata',
      'Revision history',
    ]);

    expect(screen.getByText('$4,000.00')).toBeInTheDocument();
    expect(screen.getByText('ChainVerse Foundation')).toBeInTheDocument();
    expect(screen.getByLabelText('Canonical link')).toHaveValue(
      'https://chainverse.example/scholarships/public/chainverse-scholarship'
    );
    expect(screen.getByRole('link', { name: 'Preview page' })).toHaveAttribute('href', expect.stringContaining('/scholarships/public/'));
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();

    // Status is not conveyed by colour alone.
    expect(screen.getByText(/Published on 2026-05-04/)).toBeInTheDocument();
  });

  it('exposes the JSON-LD payload inside a disclosure', async () => {
    const user = userEvent.setup();
    render(<ScholarshipPublicProgramPage slug="chainverse-scholarship" page={published()} state="ready" />);
    const summary = screen.getByText(/Show the JSON-LD payload/i);
    expect(screen.getByText(/no applicant, reviewer, or selection data/i)).toBeInTheDocument();
    await user.click(summary);
    expect(screen.getByText(/"@type": "Scholarship"/)).toBeInTheDocument();
  });

  it('never renders a non-publishable field', () => {
    const page = published();
    render(
      <ScholarshipPublicProgramPage
        slug="chainverse-scholarship"
        page={{ ...page, summary: '' }}
        state="ready"
      />
    );
    expect(screen.queryByText('Support for students building in public.')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('internalNotes');
  });

  it('shows an empty revision history with a next step', () => {
    render(<ScholarshipPublicProgramPage slug="chainverse-scholarship" page={published()} state="ready" />);
    expect(screen.getByText(/No revisions recorded yet/i)).toHaveTextContent(/Next step/i);
  });
});
