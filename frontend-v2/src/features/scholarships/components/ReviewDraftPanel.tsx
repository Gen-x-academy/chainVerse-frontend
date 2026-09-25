'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { reviewDraftService, isDraftOwner, isDraftConflict } from '../review-draft';
import type { ReviewDraft, SaveDraftPayload } from '../review-draft';
import type { ScoringRubric, CriterionScore } from '../scoring-rubric';

const AUTOSAVE_DEBOUNCE_MS = 2000;

interface Props {
  applicationId: string;
  reviewerId: string;
  rubric: ScoringRubric;
}

export function ReviewDraftPanel({ applicationId, reviewerId, rubric }: Props) {
  const [loadStatus, setLoadStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [draft, setDraft] = useState<ReviewDraft | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'conflict' | 'error'>('idle');
  const [conflictDraft, setConflictDraft] = useState<ReviewDraft | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoadStatus('loading');
    reviewDraftService
      .load(applicationId)
      .then((loaded) => {
        if (!mounted) return;
        if (loaded) {
          if (!isDraftOwner(loaded, reviewerId)) {
            setLoadStatus('error');
            return;
          }
          setDraft(loaded);
          const scoreMap: Record<string, number> = {};
          const commentMap: Record<string, string> = {};
          for (const s of loaded.scores) {
            scoreMap[s.criterionId] = s.score;
            if (s.comment) commentMap[s.criterionId] = s.comment;
          }
          setScores(scoreMap);
          setComments(commentMap);
          setNotes(loaded.notes);
        }
        setLoadStatus('loaded');
      })
      .catch(() => {
        if (mounted) setLoadStatus('error');
      });
    return () => {
      mounted = false;
    };
  }, [applicationId, reviewerId]);

  const scheduleSave = useCallback(
    (nextScores: Record<string, number>, nextComments: Record<string, string>, nextNotes: string) => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => {
        void (async () => {
          const criterionScores: CriterionScore[] = rubric.criteria
            .filter((c) => nextScores[c.id] !== undefined)
            .map((c) => ({
              criterionId: c.id,
              rubricId: rubric.id,
              rubricVersion: rubric.version,
              score: nextScores[c.id],
              comment: nextComments[c.id] || undefined,
            }));

          const payload: SaveDraftPayload = {
            rubricId: rubric.id,
            rubricVersion: rubric.version,
            scores: criterionScores,
            notes: nextNotes,
            etag: draft?.etag,
          };

          setSaveStatus('saving');
          try {
            const saved = await reviewDraftService.save(applicationId, payload);
            setDraft(saved);
            setSaveStatus('saved');
          } catch (err) {
            const error = err as { conflict?: boolean; serverDraft?: ReviewDraft };
            if (error.conflict && error.serverDraft) {
              setConflictDraft(error.serverDraft);
              setSaveStatus('conflict');
            } else {
              setSaveStatus('error');
            }
          }
        })();
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [applicationId, draft?.etag, rubric]
  );

  function handleScoreChange(criterionId: string, value: number) {
    const next = { ...scores, [criterionId]: value };
    setScores(next);
    setSaveStatus('idle');
    scheduleSave(next, comments, notes);
  }

  function handleCommentChange(criterionId: string, value: string) {
    const next = { ...comments, [criterionId]: value };
    setComments(next);
    setSaveStatus('idle');
    scheduleSave(scores, next, notes);
  }

  function handleNotesChange(value: string) {
    setNotes(value);
    setSaveStatus('idle');
    scheduleSave(scores, comments, value);
  }

  function acceptServerVersion() {
    if (!conflictDraft) return;
    setDraft(conflictDraft);
    const scoreMap: Record<string, number> = {};
    const commentMap: Record<string, string> = {};
    for (const s of conflictDraft.scores) {
      scoreMap[s.criterionId] = s.score;
      if (s.comment) commentMap[s.criterionId] = s.comment;
    }
    setScores(scoreMap);
    setComments(commentMap);
    setNotes(conflictDraft.notes);
    setConflictDraft(null);
    setSaveStatus('idle');
  }

  if (loadStatus === 'loading') {
    return (
      <p role="status" aria-live="polite" className="py-8 text-sm text-slate-600">
        Loading draft…
      </p>
    );
  }

  if (loadStatus === 'error') {
    return (
      <p role="alert" className="py-8 text-sm text-red-700">
        Could not load your draft. You may not have permission to view this review.
      </p>
    );
  }

  return (
    <section
      className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 text-slate-900"
      aria-labelledby="draft-panel-title"
    >
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Private score draft
        </p>
        <h2 id="draft-panel-title" className="text-3xl font-bold tracking-tight md:text-4xl">
          Save your working scores
        </h2>
        <p className="max-w-2xl text-sm text-slate-600">
          Your scores are saved privately and are invisible to the applicant and other reviewers
          until you submit. Changes are autosaved every {AUTOSAVE_DEBOUNCE_MS / 1000} seconds.
        </p>
      </header>

      {conflictDraft && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        >
          <p className="font-semibold">Save conflict detected</p>
          <p className="mt-1">
            Another session saved this draft (at{' '}
            {new Date(conflictDraft.savedAt).toLocaleTimeString()}). Accept the server version or
            keep editing to overwrite.
          </p>
          <button
            type="button"
            onClick={acceptServerVersion}
            className="mt-3 rounded-full bg-amber-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            Accept server version
          </button>
        </div>
      )}

      <div className="space-y-4">
        {rubric.criteria.map((criterion) => (
          <div
            key={criterion.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
          >
            <div>
              <h3 className="font-semibold text-slate-900">
                {criterion.name}
                <span className="ml-2 text-xs font-normal text-slate-500">
                  ({criterion.weightPercent}%)
                </span>
              </h3>
              {criterion.description && (
                <p className="mt-1 text-sm text-slate-600">{criterion.description}</p>
              )}
              {criterion.guidanceNotes && (
                <p className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                  {criterion.guidanceNotes}
                </p>
              )}
            </div>

            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500 sr-only">
                Score for {criterion.name}
              </legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Score for ${criterion.name}`}>
                {criterion.scale.map((point) => {
                  const selected = scores[criterion.id] === point.value;
                  const isDisqualifying =
                    criterion.disqualifyingThreshold !== undefined &&
                    point.value < criterion.disqualifyingThreshold;
                  return (
                    <label
                      key={point.value}
                      title={point.description}
                      className={`flex cursor-pointer flex-col items-center rounded-xl border px-4 py-2 text-sm transition
                        ${selected ? 'border-indigo-500 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}
                        ${isDisqualifying ? 'border-red-200' : ''}`}
                    >
                      <input
                        type="radio"
                        name={`score-${criterion.id}`}
                        value={point.value}
                        checked={selected}
                        onChange={() => handleScoreChange(criterion.id, point.value)}
                        className="sr-only"
                      />
                      <span className="text-lg font-bold">{point.value}</span>
                      <span className="text-xs">{point.label}</span>
                      {isDisqualifying && (
                        <span className="mt-0.5 text-xs text-red-600">disqualifying</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {(criterion.requiresComment || comments[criterion.id]) && (
              <div className="space-y-1">
                <label
                  className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                  htmlFor={`comment-${criterion.id}`}
                >
                  Comment{criterion.requiresComment ? ' (required)' : ''}
                </label>
                <textarea
                  id={`comment-${criterion.id}`}
                  rows={2}
                  value={comments[criterion.id] ?? ''}
                  onChange={(e) => handleCommentChange(criterion.id, e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-required={criterion.requiresComment}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
        <label className="block text-sm font-medium text-slate-700" htmlFor="draft-notes">
          Private notes
        </label>
        <textarea
          id="draft-notes"
          rows={3}
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Notes visible only to you — not included in the submitted review."
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="flex items-center gap-3 text-sm" aria-live="polite">
        {saveStatus === 'saving' && <span className="text-slate-500">Autosaving…</span>}
        {saveStatus === 'saved' && (
          <span role="status" className="text-emerald-700">
            Draft saved privately at {draft ? new Date(draft.savedAt).toLocaleTimeString() : '—'}
          </span>
        )}
        {saveStatus === 'error' && (
          <span role="alert" className="text-red-700">
            Autosave failed. Your changes will be retried on the next edit.
          </span>
        )}
        {saveStatus === 'idle' && draft && (
          <span className="text-slate-500">
            Last saved {new Date(draft.savedAt).toLocaleTimeString()}
          </span>
        )}
        {!draft && saveStatus === 'idle' && (
          <span className="text-slate-400">No draft yet — start scoring to autosave.</span>
        )}
      </div>
    </section>
  );
}

export default ReviewDraftPanel;
