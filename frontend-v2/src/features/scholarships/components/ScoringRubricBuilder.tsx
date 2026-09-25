'use client';

import { useState } from 'react';
import {
  validateRubricWeights,
  scoringRubricService,
} from '../scoring-rubric';
import type { RubricCriterion, ScoringRubric, RubricScale } from '../scoring-rubric';

const DEFAULT_SCALE: RubricScale[] = [
  { value: 0, label: 'Insufficient', description: 'Does not meet the minimum bar.' },
  { value: 1, label: 'Developing', description: 'Partially meets the requirement.' },
  { value: 2, label: 'Proficient', description: 'Fully meets the requirement.' },
  { value: 3, label: 'Excellent', description: 'Exceeds the requirement.' },
];

function newCriterion(id: string): RubricCriterion {
  return {
    id,
    name: '',
    description: '',
    weightPercent: 0,
    scale: DEFAULT_SCALE,
    guidanceNotes: '',
    requiresComment: false,
    disqualifyingThreshold: undefined,
  };
}

interface Props {
  roundId: string;
  existingRubric?: ScoringRubric;
  onSaved?: (rubric: ScoringRubric) => void;
}

export function ScoringRubricBuilder({ roundId, existingRubric, onSaved }: Props) {
  const isPublished = existingRubric?.status === 'published';

  const [name, setName] = useState(existingRubric?.name ?? '');
  const [description, setDescription] = useState(existingRubric?.description ?? '');
  const [criteria, setCriteria] = useState<RubricCriterion[]>(
    existingRubric?.criteria ?? [newCriterion('criterion-1')]
  );
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [publishStatus, setPublishStatus] = useState<'idle' | 'publishing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const weightErrors = validateRubricWeights(criteria);
  const weightTotal = criteria.reduce((sum, c) => sum + c.weightPercent, 0);

  function addCriterion() {
    setCriteria((prev) => [...prev, newCriterion(`criterion-${Date.now()}`)]);
  }

  function removeCriterion(id: string) {
    setCriteria((prev) => prev.filter((c) => c.id !== id));
  }

  function updateCriterion(id: string, patch: Partial<RubricCriterion>) {
    setCriteria((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function handleSave() {
    if (weightErrors.length > 0) {
      setErrorMessage(weightErrors[0].message);
      return;
    }
    setSaveStatus('saving');
    setErrorMessage(null);
    try {
      let saved: ScoringRubric;
      if (existingRubric) {
        saved = await scoringRubricService.update(existingRubric.id, { name, description, criteria });
      } else {
        saved = await scoringRubricService.create(roundId, { name, description, criteria });
      }
      setSaveStatus('success');
      onSaved?.(saved);
    } catch {
      setSaveStatus('error');
      setErrorMessage('Could not save the rubric. Please try again.');
    }
  }

  async function handlePublish() {
    if (!existingRubric) return;
    setPublishStatus('publishing');
    setErrorMessage(null);
    try {
      const published = await scoringRubricService.publish(existingRubric.id);
      setPublishStatus('success');
      onSaved?.(published);
    } catch {
      setPublishStatus('error');
      setErrorMessage('Could not publish the rubric. Please try again.');
    }
  }

  return (
    <section
      className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 text-slate-900"
      aria-labelledby="rubric-builder-title"
    >
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Scoring rubrics
        </p>
        <h2 id="rubric-builder-title" className="text-3xl font-bold tracking-tight md:text-4xl">
          {isPublished ? 'Rubric (published — read only)' : 'Build scoring rubric'}
        </h2>
        <p className="max-w-2xl text-sm text-slate-600">
          Define weighted criteria, rating scales, guidance notes, required comments, and
          disqualifying conditions. Published rubrics are immutable; a new version is created for
          changes.
        </p>
        {isPublished && (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800"
          >
            Version {existingRubric.version} — published{' '}
            {existingRubric.publishedAt
              ? new Date(existingRubric.publishedAt).toLocaleDateString()
              : ''}
            . This rubric is immutable. All scores reference this exact version.
          </div>
        )}
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700" htmlFor="rubric-name">
            Rubric name
          </label>
          <input
            id="rubric-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPublished}
            placeholder="e.g. Standard Merit Review Rubric v2"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700" htmlFor="rubric-desc">
            Description
          </label>
          <textarea
            id="rubric-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isPublished}
            rows={2}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Criteria
            <span
              className={`ml-2 text-sm font-normal ${weightTotal === 100 ? 'text-emerald-600' : 'text-amber-600'}`}
            >
              ({weightTotal}/100%)
            </span>
          </h3>
          {!isPublished && (
            <button
              type="button"
              onClick={addCriterion}
              className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              + Add criterion
            </button>
          )}
        </div>

        {criteria.map((c, idx) => (
          <div
            key={c.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
            aria-label={`Criterion ${idx + 1}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Name
                </label>
                <input
                  type="text"
                  value={c.name}
                  onChange={(e) => updateCriterion(c.id, { name: e.target.value })}
                  disabled={isPublished}
                  placeholder="e.g. Academic merit"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
              <div className="w-28 space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Weight (%)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={c.weightPercent}
                  onChange={(e) =>
                    updateCriterion(c.id, { weightPercent: Number(e.target.value) })
                  }
                  disabled={isPublished}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
              {!isPublished && (
                <button
                  type="button"
                  onClick={() => removeCriterion(c.id)}
                  disabled={criteria.length <= 1}
                  aria-label={`Remove criterion ${c.name || idx + 1}`}
                  className="mt-5 rounded-full p-1 text-slate-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-40"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Description
              </label>
              <input
                type="text"
                value={c.description}
                onChange={(e) => updateCriterion(c.id, { description: e.target.value })}
                disabled={isPublished}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Guidance notes (visible to reviewers)
              </label>
              <textarea
                value={c.guidanceNotes}
                onChange={(e) => updateCriterion(c.id, { guidanceNotes: e.target.value })}
                disabled={isPublished}
                rows={2}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Scale ({c.scale.length} points)
              </p>
              <ol className="space-y-1">
                {c.scale.map((s) => (
                  <li key={s.value} className="flex items-center gap-3 text-sm">
                    <span className="w-6 text-center font-bold text-indigo-700">{s.value}</span>
                    <span className="font-medium text-slate-800">{s.label}</span>
                    <span className="text-slate-500">{s.description}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={c.requiresComment}
                  onChange={(e) => updateCriterion(c.id, { requiresComment: e.target.checked })}
                  disabled={isPublished}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium text-slate-700">Require comment</span>
              </label>
              <div className="flex items-center gap-2">
                <label
                  className="text-slate-700 font-medium"
                  htmlFor={`disqualify-${c.id}`}
                >
                  Disqualifying threshold
                </label>
                <input
                  id={`disqualify-${c.id}`}
                  type="number"
                  min={0}
                  max={Math.max(...c.scale.map((s) => s.value))}
                  value={c.disqualifyingThreshold ?? ''}
                  onChange={(e) =>
                    updateCriterion(c.id, {
                      disqualifyingThreshold: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                  disabled={isPublished}
                  placeholder="none"
                  className="w-20 rounded-xl border border-slate-300 bg-white px-3 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
                  aria-describedby={`disqualify-help-${c.id}`}
                />
                <span id={`disqualify-help-${c.id}`} className="text-xs text-slate-500">
                  Scores below this value disqualify the applicant.
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {weightErrors.length > 0 && (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {weightErrors.map((e) => (
            <p key={e.field}>{e.message}</p>
          ))}
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="text-sm text-red-700">
          {errorMessage}
        </p>
      )}

      {!isPublished && (
        <div className="flex flex-wrap gap-3" aria-live="polite">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saveStatus === 'saving' || weightErrors.length > 0}
            className="rounded-full bg-slate-800 px-6 py-2 text-sm font-medium text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {saveStatus === 'saving' ? 'Saving…' : 'Save draft'}
          </button>
          {existingRubric && (
            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={publishStatus === 'publishing' || weightErrors.length > 0}
              className="rounded-full bg-indigo-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {publishStatus === 'publishing' ? 'Publishing…' : 'Publish rubric'}
            </button>
          )}
          {saveStatus === 'success' && (
            <p role="status" className="self-center text-sm text-emerald-700">
              Rubric saved.
            </p>
          )}
          {publishStatus === 'success' && (
            <p role="status" className="self-center text-sm text-emerald-700">
              Rubric published and locked.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export default ScoringRubricBuilder;
