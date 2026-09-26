import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScholarshipCommunicationPreferences } from '../ScholarshipCommunicationPreferences';
import { emptyPreferenceMatrix, recordOptInConsent } from '../../service';
import type { PreferenceMatrix } from '../../types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const SCOPES = [{ scope: 'user' as const, scopeId: 'current-user' }];

function consented(): PreferenceMatrix {
  return recordOptInConsent(emptyPreferenceMatrix(SCOPES), {
    eventName: 'review.assigned',
    channel: 'email',
    basis: 'opt-in',
    capturedAt: '2026-05-01T00:00:00.000Z',
    policyVersion: '2026-09-01',
  });
}

describe('ScholarshipCommunicationPreferences', () => {
  it('renders a loading status', () => {
    render(<ScholarshipCommunicationPreferences matrix={null} state="loading" />);
    expect(screen.getByRole('status')).toHaveTextContent(/Loading communication preferences/i);
  });

  it('renders an error alert with a next step', () => {
    render(
      <ScholarshipCommunicationPreferences matrix={null} state="error" errorMessage="Gateway timeout" />
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Gateway timeout');
    expect(alert).toHaveTextContent(/Next step/i);
  });

  it('renders an empty state with a next step', () => {
    render(<ScholarshipCommunicationPreferences matrix={null} state="ready" />);
    expect(screen.getByTestId('prefs-empty')).toHaveTextContent(/Next step/i);
  });

  it('renders a permission-denied note and disables the save action', () => {
    render(
      <ScholarshipCommunicationPreferences matrix={emptyPreferenceMatrix(SCOPES)} state="ready" canEdit={false} />
    );
    expect(screen.getByTestId('prefs-denied')).toHaveTextContent(/do not have permission/i);
    expect(screen.getByTestId('prefs-denied')).toHaveTextContent(/Next step/i);
    expect(screen.getByRole('button', { name: 'Save preferences' })).toBeDisabled();
  });

  it('renders one fieldset and legend per event with a label per cell', () => {
    render(<ScholarshipCommunicationPreferences matrix={consented()} state="ready" />);
    const groups = screen.getAllByRole('group');
    expect(groups.length).toBe(8); // one fieldset per scholarship event
    expect(within(groups[0]).getByText('deadline.approaching (required notice)')).toBeInTheDocument();
    for (const name of [
      'review.assigned (optional)',
      'milestone.evidence-required (optional)',
      'decision.recorded (required notice)',
    ]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }

    for (const channel of ['in-app', 'email', 'sms', 'push']) {
      expect(screen.getAllByLabelText(channel).length).toBeGreaterThan(0);
    }
  });

  it('renders mandatory events as checked and disabled with an explanation', () => {
    render(<ScholarshipCommunicationPreferences matrix={emptyPreferenceMatrix(SCOPES)} state="ready" />);
    const required = screen
      .getAllByRole('note')
      .filter((note) => /Required operational notice/i.test(note.textContent ?? ''));
    expect(required.length).toBe(6);

    const mandatoryInputs = screen
      .getAllByRole('checkbox')
      .filter((input) => (input.getAttribute('id') ?? '').includes('decision.recorded')) as HTMLInputElement[];
    expect(mandatoryInputs.length).toBe(4);
    for (const input of mandatoryInputs) {
      expect(input).toBeChecked();
      expect(input).toBeDisabled();
    }
  });

  it('excludes mandatory cells from the toggle handler', async () => {
    const user = userEvent.setup();
    render(<ScholarshipCommunicationPreferences matrix={emptyPreferenceMatrix(SCOPES)} state="ready" />);
    const input = screen
      .getAllByRole('checkbox')
      .find((element) => (element.getAttribute('id') ?? '').includes('decision.recorded')) as HTMLInputElement;
    await user.click(input, { pointerEventsCheck: 0 });
    expect(input).toBeChecked();
    expect(screen.queryByTestId('prefs-pending')).toBeNull();
  });

  it('requires opt-in consent before an email cell can be enabled', async () => {
    const user = userEvent.setup();
    render(<ScholarshipCommunicationPreferences matrix={emptyPreferenceMatrix(SCOPES)} state="ready" />);
    const emailCell = screen
      .getAllByRole('checkbox')
      .find((element) => (element.getAttribute('id') ?? '').includes('review.assigned-email')) as HTMLInputElement;
    expect(emailCell).toBeDisabled();
    expect(emailCell).toHaveAccessibleDescription(/opt-in consent/i);

    await user.click(screen.getByLabelText(/I consent to optional scholarship notifications/i));
    expect(emailCell).not.toBeDisabled();
  });

  it('shows the pending change with its effective time', async () => {
    const user = userEvent.setup();
    render(<ScholarshipCommunicationPreferences matrix={consented()} state="ready" />);
    expect(screen.getByTestId('prefs-no-pending')).toHaveTextContent(/No unsaved changes/i);

    const inApp = screen
      .getAllByRole('checkbox')
      .find((element) => (element.getAttribute('id') ?? '').includes('review.assigned-in-app')) as HTMLInputElement;
    await user.click(inApp);

    const pending = screen.getByTestId('prefs-pending');
    expect(pending).toHaveTextContent('review.assigned');
    expect(pending).toHaveTextContent('2026-05-05T10:00:00.000Z');
    expect(pending).toHaveTextContent(/next scheduled send/i);
  });

  it('reports a successful save', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async (matrix: PreferenceMatrix) => matrix);
    render(
      <ScholarshipCommunicationPreferences matrix={consented()} state="ready" onSave={onSave} />
    );
    await user.click(screen.getByRole('button', { name: 'Save preferences' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Preferences saved/i)).toBeInTheDocument();
  });

  it('reports a failed save without losing the state', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => {
      throw new Error('Save rejected by policy service');
    });
    render(
      <ScholarshipCommunicationPreferences matrix={consented()} state="ready" onSave={onSave} />
    );
    await user.click(screen.getByRole('button', { name: 'Save preferences' }));
    expect(await screen.findByText(/Save rejected by policy service/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save preferences' })).toBeEnabled();
  });
});
