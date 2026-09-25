'use client';

import React, { useId, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useCreateDisbursementSchedule } from '../../hooks/useScholarships';
import type {
  CreateScheduleMilestone,
  CreateSchedulePayload,
  DisbursementSchedule,
  MilestoneType,
} from '../types';

const MILESTONE_TYPES: { value: MilestoneType; label: string }[] = [
  { value: 'enrollment', label: 'Enrollment' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'coursework', label: 'Coursework' },
  { value: 'completion', label: 'Completion' },
  { value: 'custom', label: 'Custom' },
];

type FormStatus = 'idle' | 'loading' | 'success' | 'error';

function generateClientToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(cents / 100);
}

function validateMilestones(milestones: CreateScheduleMilestone[]): string[] {
  const errors: string[] = [];

  if (milestones.length === 0) {
    errors.push('Add at least one milestone.');
    return errors;
  }

  const total = milestones.reduce((sum, m) => sum + m.percentageShare, 0);
  if (Math.abs(total - 100) > 0.01) {
    errors.push(`Percentages must total 100%. Current total: ${total.toFixed(1)}%.`);
  }

  for (let i = 1; i < milestones.length; i++) {
    if (milestones[i].dueDate && milestones[i - 1].dueDate) {
      if (milestones[i].dueDate <= milestones[i - 1].dueDate) {
        errors.push('Milestone due dates must be in strictly ascending order.');
        break;
      }
    }
  }

  for (const [i, m] of milestones.entries()) {
    if (!m.label.trim()) {
      errors.push(`Milestone ${i + 1} is missing a label.`);
    }
    if (!m.dueDate) {
      errors.push(`Milestone ${i + 1} is missing a due date.`);
    }
    if (m.percentageShare <= 0) {
      errors.push(`Milestone ${i + 1} must have a percentage greater than 0.`);
    }
  }

  return errors;
}

function ReadOnlySchedule({
  schedule,
  awardAmountCents,
  currency,
}: {
  schedule: DisbursementSchedule;
  awardAmountCents: number;
  currency: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">
          Schedule{' '}
          <span className="font-mono text-xs text-slate-500">{schedule.id}</span>
        </p>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
            schedule.status === 'active'
              ? 'bg-green-50 text-green-700'
              : schedule.status === 'amended'
              ? 'bg-amber-50 text-amber-700'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          {schedule.status}
        </span>
      </div>

      {schedule.amendmentReason && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Amendment reason: {schedule.amendmentReason}
        </p>
      )}

      <p className="text-xs text-slate-500">
        Schedules are immutable after activation. Contact an administrator for governed amendments.
      </p>

      <ul className="space-y-2" aria-label="Disbursement milestones">
        {schedule.milestones.map((m, index) => (
          <li
            key={m.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-4"
          >
            <div>
              <p className="font-medium text-slate-900">
                {index + 1}. {m.label}
              </p>
              <p className="text-xs text-slate-500 capitalize">{m.milestoneType}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-900">
                {m.percentageShare.toFixed(1)}%
                {' — '}
                {formatCents(m.amountCents ?? Math.round(awardAmountCents * m.percentageShare / 100), currency)}
              </p>
              <p className="text-xs text-slate-500">
                Due <time dateTime={m.dueDate}>{new Date(m.dueDate).toLocaleDateString()}</time>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface DisbursementScheduleBuilderProps {
  awardId: string;
  awardAmountCents: number;
  currency: string;
  existingSchedule?: DisbursementSchedule | null;
  onSuccess?: (schedule: DisbursementSchedule) => void;
}

export function DisbursementScheduleBuilder({
  awardId,
  awardAmountCents,
  currency,
  existingSchedule,
  onSuccess,
}: DisbursementScheduleBuilderProps) {
  const formId = useId();
  const [milestones, setMilestones] = useState<CreateScheduleMilestone[]>([
    { milestoneType: 'enrollment', label: '', percentageShare: 0, dueDate: '' },
  ]);
  const [formStatus, setFormStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [createdSchedule, setCreatedSchedule] = useState<DisbursementSchedule | null>(null);
  const clientTokenRef = useRef(generateClientToken());

  const createMutation = useCreateDisbursementSchedule();

  const validationErrors = validateMilestones(milestones);
  const totalPercentage = milestones.reduce((sum, m) => sum + m.percentageShare, 0);
  const canSubmit = formStatus !== 'loading';

  function addMilestone() {
    setMilestones((prev) => [
      ...prev,
      { milestoneType: 'custom', label: '', percentageShare: 0, dueDate: '' },
    ]);
  }

  function removeMilestone(index: number) {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  }

  function updateMilestone(index: number, field: keyof CreateScheduleMilestone, value: string | number) {
    setMilestones((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;

    if (validationErrors.length > 0) {
      setFormStatus('error');
      return;
    }

    setFormStatus('loading');
    setErrorMessage('');

    const payload: CreateSchedulePayload = {
      awardId,
      milestones,
      clientToken: clientTokenRef.current,
    };

    try {
      const schedule = await createMutation.mutateAsync(payload);
      setCreatedSchedule(schedule);
      setFormStatus('success');
      onSuccess?.(schedule);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create schedule. Please try again.');
      setFormStatus('error');
      clientTokenRef.current = generateClientToken();
    }
  }

  if (existingSchedule && existingSchedule.status !== 'draft') {
    return (
      <section aria-label="Disbursement schedule" className="space-y-4">
        <ReadOnlySchedule
          schedule={existingSchedule}
          awardAmountCents={awardAmountCents}
          currency={currency}
        />
      </section>
    );
  }

  if (formStatus === 'success' && createdSchedule) {
    return (
      <div
        role="status"
        className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-6"
      >
        <p className="font-semibold text-emerald-800">Disbursement schedule created.</p>
        <p className="text-sm text-emerald-700">
          {createdSchedule.milestones.length} milestone
          {createdSchedule.milestones.length !== 1 ? 's' : ''} defined.
          The schedule will become immutable once activated.
        </p>
        <ReadOnlySchedule
          schedule={createdSchedule}
          awardAmountCents={awardAmountCents}
          currency={currency}
        />
      </div>
    );
  }

  return (
    <section
      aria-label="Define disbursement schedule"
      className="mx-auto w-full max-w-2xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
          Milestone schedule
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Define disbursement milestones
        </h2>
        <p className="text-sm text-slate-500">
          Split the award into verified milestones. Percentages must total exactly 100% and dates
          must be in ascending order. Schedules are immutable after activation.
        </p>
      </header>

      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {formStatus === 'loading' && 'Creating schedule…'}
        {formStatus === 'error' && `Error: ${errorMessage}`}
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <fieldset disabled={formStatus === 'loading'}>
          <legend className="sr-only">Milestone details</legend>

          <ul className="space-y-4" aria-label="Milestones">
            {milestones.map((milestone, index) => {
              const estimatedCents = Math.round(awardAmountCents * milestone.percentageShare / 100);

              return (
                <li
                  key={index}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">
                      Milestone {index + 1}
                    </span>
                    {milestones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMilestone(index)}
                        aria-label={`Remove milestone ${index + 1}`}
                        className="rounded-full p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-400"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label
                        htmlFor={`${formId}-type-${index}`}
                        className="block text-xs font-medium text-slate-600"
                      >
                        Type
                      </label>
                      <select
                        id={`${formId}-type-${index}`}
                        value={milestone.milestoneType}
                        onChange={(e) =>
                          updateMilestone(index, 'milestoneType', e.target.value)
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {MILESTONE_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor={`${formId}-label-${index}`}
                        className="block text-xs font-medium text-slate-600"
                      >
                        Label <span className="text-red-500" aria-hidden="true">*</span>
                      </label>
                      <input
                        id={`${formId}-label-${index}`}
                        type="text"
                        value={milestone.label}
                        onChange={(e) => updateMilestone(index, 'label', e.target.value)}
                        required
                        aria-required="true"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. Semester 1 completion"
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor={`${formId}-pct-${index}`}
                        className="block text-xs font-medium text-slate-600"
                      >
                        Share (%) <span className="text-red-500" aria-hidden="true">*</span>
                      </label>
                      <input
                        id={`${formId}-pct-${index}`}
                        type="number"
                        min="0.1"
                        max="100"
                        step="0.1"
                        value={milestone.percentageShare || ''}
                        onChange={(e) =>
                          updateMilestone(index, 'percentageShare', parseFloat(e.target.value) || 0)
                        }
                        required
                        aria-required="true"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="25"
                      />
                      {milestone.percentageShare > 0 && (
                        <p className="text-xs text-slate-500">
                          ≈ {formatCents(estimatedCents, currency)}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor={`${formId}-date-${index}`}
                        className="block text-xs font-medium text-slate-600"
                      >
                        Due date <span className="text-red-500" aria-hidden="true">*</span>
                      </label>
                      <input
                        id={`${formId}-date-${index}`}
                        type="date"
                        value={milestone.dueDate}
                        onChange={(e) => updateMilestone(index, 'dueDate', e.target.value)}
                        required
                        aria-required="true"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            onClick={addMilestone}
            className="mt-4 flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add milestone
          </button>

          <div
            className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${
              Math.abs(totalPercentage - 100) < 0.01
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
            aria-live="polite"
          >
            Total: {totalPercentage.toFixed(1)}% / 100%
          </div>

          {validationErrors.length > 0 && formStatus === 'error' && (
            <ul
              role="alert"
              aria-label="Validation errors"
              className="mt-4 space-y-1 rounded-xl border border-red-200 bg-red-50 p-3"
            >
              {validationErrors.map((err, i) => (
                <li key={i} className="text-sm text-red-800">
                  {err}
                </li>
              ))}
            </ul>
          )}

          {formStatus === 'error' && errorMessage && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            aria-busy={formStatus === 'loading'}
            className="mt-6 w-full rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {formStatus === 'loading' ? 'Saving schedule…' : 'Save disbursement schedule'}
          </button>
        </fieldset>
      </form>
    </section>
  );
}

export default DisbursementScheduleBuilder;
