'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { validateProgramDraft } from '../validation';
import type {
  CreateProgramPayload,
  ProgramDeliveryMode,
  ProgramVisibility,
} from '../types';

const EMPTY_FORM: CreateProgramPayload = {
  organizationId: '',
  name: '',
  audience: [''],
  outcomes: [''],
  capacity: 10,
  durationWeeks: 8,
  deliveryMode: 'async',
  startsAt: '',
  endsAt: '',
  ownerUserId: '',
  visibility: 'public',
};

/**
 * Staff-only form for drafting a mentorship program. Validation runs in the
 * browser before anything is sent to the API.
 */
export function ProgramDraftForm({
  onCreate,
}: {
  onCreate: (payload: CreateProgramPayload) => Promise<unknown>;
}) {
  const [form, setForm] = useState<CreateProgramPayload>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (patch: Partial<CreateProgramPayload>) => {
    setForm((current) => ({ ...current, ...patch }));
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateProgramDraft(form);
    if (errors.length > 0) {
      setError(errors[0].message);
      return;
    }
    setSubmitting(true);
    try {
      await onCreate(form);
      setForm(EMPTY_FORM);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save the program.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-6" onSubmit={(event) => void handleSubmit(event)} noValidate>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor="organizationId"
            className="mb-1.5 block text-sm font-medium text-gray-900"
          >
            Organization
          </label>
          <input
            id="organizationId"
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            value={form.organizationId}
            onChange={(event) => update({ organizationId: event.target.value })}
          />
        </div>
        <div>
          <label
            htmlFor="name"
            className="mb-1.5 block text-sm font-medium text-gray-900"
          >
            Program name
          </label>
          <input
            id="name"
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            value={form.name}
            onChange={(event) => update({ name: event.target.value })}
          />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor="capacity"
            className="mb-1.5 block text-sm font-medium text-gray-900"
          >
            Capacity
          </label>
          <input
            id="capacity"
            type="number"
            min={0}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            value={form.capacity}
            onChange={(event) =>
              update({ capacity: Number(event.target.value) })
            }
          />
        </div>
        <div>
          <label
            htmlFor="durationWeeks"
            className="mb-1.5 block text-sm font-medium text-gray-900"
          >
            Duration (weeks)
          </label>
          <input
            id="durationWeeks"
            type="number"
            min={1}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            value={form.durationWeeks}
            onChange={(event) =>
              update({ durationWeeks: Number(event.target.value) })
            }
          />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor="startsAt"
            className="mb-1.5 block text-sm font-medium text-gray-900"
          >
            Starts at
          </label>
          <input
            id="startsAt"
            type="date"
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            value={form.startsAt}
            onChange={(event) => update({ startsAt: event.target.value })}
          />
        </div>
        <div>
          <label
            htmlFor="endsAt"
            className="mb-1.5 block text-sm font-medium text-gray-900"
          >
            Ends at
          </label>
          <input
            id="endsAt"
            type="date"
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            value={form.endsAt}
            onChange={(event) => update({ endsAt: event.target.value })}
          />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor="visibility"
            className="mb-1.5 block text-sm font-medium text-gray-900"
          >
            Visibility
          </label>
          <select
            id="visibility"
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            value={form.visibility}
            onChange={(event) =>
              update({
                visibility: event.target.value as ProgramVisibility,
              })
            }
          >
            <option value="public">Public</option>
            <option value="restricted">Restricted</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="deliveryMode"
            className="mb-1.5 block text-sm font-medium text-gray-900"
          >
            Delivery mode
          </label>
          <select
            id="deliveryMode"
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            value={form.deliveryMode}
            onChange={(event) =>
              update({
                deliveryMode: event.target.value as ProgramDeliveryMode,
              })
            }
          >
            <option value="async">Asynchronous</option>
            <option value="live">Live</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor="audience"
            className="mb-1.5 block text-sm font-medium text-gray-900"
          >
            Audience (comma separated)
          </label>
          <input
            id="audience"
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            value={form.audience.join(', ')}
            onChange={(event) =>
              update({
                audience: splitList(event.target.value),
              })
            }
          />
        </div>
        <div>
          <label
            htmlFor="outcomes"
            className="mb-1.5 block text-sm font-medium text-gray-900"
          >
            Outcomes (comma separated)
          </label>
          <input
            id="outcomes"
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            value={form.outcomes.join(', ')}
            onChange={(event) =>
              update({
                outcomes: splitList(event.target.value),
              })
            }
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {submitting ? 'Saving...' : 'Save draft'}
      </button>
    </form>
  );
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
