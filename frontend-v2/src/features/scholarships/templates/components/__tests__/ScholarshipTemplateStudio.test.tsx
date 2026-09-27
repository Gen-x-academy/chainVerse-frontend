import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScholarshipTemplateStudio } from '../ScholarshipTemplateStudio';
import { templateService } from '../../service';
import type { TemplateVersion } from '../../types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

function template(overrides: Partial<TemplateVersion> = {}): TemplateVersion {
  return {
    id: 'tpl-1-v2',
    templateKey: 'award-confirmation',
    version: 2,
    channel: 'email',
    locale: 'en',
    subject: 'You received {{awardName}}',
    body: 'Hi {{applicantName}}, your award of {{awardName}} is confirmed for {{awardDate}}.',
    variables: [
      { name: 'applicantName', required: true, example: 'Ada Lovelace', pii: true },
      { name: 'awardName', required: true, example: 'ChainVerse Scholarship', pii: false },
      { name: 'awardDate', required: true, example: '1 Sep 2025', pii: false },
    ],
    status: 'approved',
    createdBy: 'author-1',
    createdAt: '2025-08-01T09:00:00.000Z',
    approvedBy: 'approver-1',
    approvedAt: '2025-08-02T09:00:00.000Z',
    ...overrides,
  };
}

/** `{{` is a userEvent key descriptor, so the body is edited with fireEvent. */
function setBody(value: string) {
  fireEvent.change(screen.getByLabelText(/body copy/i), { target: { value } });
}

async function renderStudio() {
  render(<ScholarshipTemplateStudio />);
  return screen.findByRole('heading', { name: /template studio/i });
}

describe('ScholarshipTemplateStudio', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a loading state while templates are fetched', () => {
    vi.spyOn(templateService, 'listTemplates').mockReturnValue(new Promise(() => {}));
    render(<ScholarshipTemplateStudio />);

    expect(screen.getByRole('status')).toHaveTextContent(/loading communication templates/i);
  });

  it('renders an error state with a retry action', async () => {
    const list = vi
      .spyOn(templateService, 'listTemplates')
      .mockRejectedValue(new Error('templates service unavailable'));
    render(<ScholarshipTemplateStudio />);

    expect(await screen.findByRole('alert')).toHaveTextContent('templates service unavailable');
    list.mockResolvedValue([template()]);
    await userEvent.click(screen.getByRole('button', { name: /retry loading templates/i }));
    expect(await screen.findByRole('heading', { name: /template studio/i })).toBeInTheDocument();
  });

  it('renders an empty state when no templates exist', async () => {
    vi.spyOn(templateService, 'listTemplates').mockResolvedValue([]);
    render(<ScholarshipTemplateStudio />);

    expect(await screen.findByRole('status')).toHaveTextContent(/no communication templates exist/i);
  });

  it('renders a permission-denied note', () => {
    vi.spyOn(templateService, 'listTemplates').mockResolvedValue([template()]);
    render(<ScholarshipTemplateStudio canManage={false} />);

    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(/cannot edit, approve, or roll back/i);
  });

  it('labels every editor control and links errors to the body field', async () => {
    vi.spyOn(templateService, 'listTemplates').mockResolvedValue([template()]);
    await renderStudio();

    expect(screen.getByLabelText(/template key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/channel/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/locale/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/body copy/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/approver/i)).toBeInTheDocument();

    const body = screen.getByLabelText(/body copy/i);
    expect(body).toHaveAttribute('aria-describedby');
    expect(body).toHaveAttribute('aria-invalid', 'false');

    setBody('Hi {{mystery}}');

    await waitFor(() => expect(body).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByText(/UNKNOWN_VARIABLE/)).toBeInTheDocument();
    expect(screen.getAllByText(/MISSING_VARIABLE/).length).toBeGreaterThan(0);
  });

  it('keeps publish disabled until validation passes and an approver is supplied', async () => {
    vi.spyOn(templateService, 'listTemplates').mockResolvedValue([template()]);
    await renderStudio();

    const publish = screen.getByRole('button', { name: /publish version/i });
    expect(publish).toBeDisabled();
    expect(screen.getByText(/publishing stays disabled until validation passes/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/approver/i), { target: { value: 'approver-2' } });
    await waitFor(() => expect(publish).toBeEnabled());

    setBody('Hi {{mystery}}');
    await waitFor(() => expect(publish).toBeDisabled());
  });

  it('masks personal data in the preview', async () => {
    vi.spyOn(templateService, 'listTemplates').mockResolvedValue([template()]);
    await renderStudio();

    expect(screen.getByText(/\[redacted\]/)).toBeInTheDocument();
    expect(screen.queryByText(/Ada Lovelace/)).not.toBeInTheDocument();
  });

  it('publishes with the approver and reports success', async () => {
    vi.spyOn(templateService, 'listTemplates').mockResolvedValue([template()]);
    const publish = vi
      .spyOn(templateService, 'publishTemplate')
      .mockResolvedValue(template({ status: 'published' }));
    await renderStudio();

    fireEvent.change(screen.getByLabelText(/approver/i), { target: { value: 'approver-2' } });
    fireEvent.click(screen.getByRole('button', { name: /publish version/i }));

    await waitFor(() =>
      expect(publish).toHaveBeenCalledWith(
        expect.objectContaining({ approver: 'approver-2', expectedVersion: 2 })
      )
    );
    expect(
      await screen.findByText(/previous published version is now marked rolled back/i)
    ).toBeInTheDocument();
  });

  it('surfaces a publication error', async () => {
    vi.spyOn(templateService, 'listTemplates').mockResolvedValue([template()]);
    vi.spyOn(templateService, 'publishTemplate').mockRejectedValue(new Error('approver not authorised'));
    await renderStudio();

    fireEvent.change(screen.getByLabelText(/approver/i), { target: { value: 'approver-2' } });
    fireEvent.click(screen.getByRole('button', { name: /publish version/i }));

    expect(await screen.findByText('approver not authorised')).toBeInTheDocument();
  });

  it('lists the approval and rollback history', async () => {
    vi.spyOn(templateService, 'listTemplates').mockResolvedValue([
      template({ id: 'v1', version: 1, status: 'rolled-back', approvedBy: 'approver-0' }),
      template({ status: 'published' }),
    ]);
    await renderStudio();

    const history = screen.getByRole('heading', { name: /approval and rollback history/i })
      .parentElement as HTMLElement;
    expect(history).toHaveTextContent('v2 — published — approved by approver-1');
    expect(history).toHaveTextContent('v1 — rolled-back — approved by approver-0');
  });
});
