'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  MENTEE_VISIBILITIES,
  computeProfileCompleteness,
  mentorshipMenteeProfileService,
  validateMenteeLearningProfile,
} from '../service';
import type { MenteeLearningProfile, MenteeProfileVisibility } from '../types';

type Props = {
  menteeId: string;
  canEdit?: boolean;
};

const INPUT_CLASS =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200';

export function MenteeLearningProfileForm({ menteeId, canEdit = true }: Props) {
  const baseId = useId();
  const [profile, setProfile] = useState<MenteeLearningProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfile(await mentorshipMenteeProfileService.get(menteeId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the learning profile.');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [menteeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const errors = useMemo(() => (profile ? validateMenteeLearningProfile(profile) : []), [profile]);
  const completeness = useMemo(
    () => (profile ? computeProfileCompleteness(profile) : { score: 0, missing: [] }),
    [profile],
  );

  const update = <K extends keyof MenteeLearningProfile>(key: K, value: MenteeLearningProfile[K]) => {
    if (!profile || !canEdit) return;
    setProfile({ ...profile, [key]: value });
  };

  const persist = async () => {
    if (!profile) return;
    if (errors.length > 0) {
      setError('Fix the highlighted fields before saving.');
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const saved = await mentorshipMenteeProfileService.save(profile);
      setProfile(saved);
      setStatus('Learning profile saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the learning profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600" role="status" aria-live="polite">
        Loading learning profile...
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700" role="alert">
        <p className="font-semibold">The learning profile could not be loaded.</p>
        <p className="mt-1">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-200"
        >
          Retry loading profile
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600" role="status">
        No learning profile exists yet.
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby={`${baseId}-heading`}>
      <h2 id={`${baseId}-heading`} className="text-xl font-semibold text-slate-900">
        Mentee learning profile
      </h2>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">
          Profile completeness: {Math.round(completeness.score * 100)}%
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(completeness.score * 100)}
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200"
        >
          <div className="h-full bg-indigo-600" style={{ width: `${Math.round(completeness.score * 100)}%` }} />
        </div>
        {completeness.missing.length > 0 && (
          <p className="mt-2 text-xs text-slate-500">Missing: {completeness.missing.join(', ')}.</p>
        )}
      </div>

      {!canEdit && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="note">
          You do not have permission to edit this profile.
        </div>
      )}

      {status && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status" aria-live="polite">
          {status}
        </div>
      )}

      {error && profile && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <div className="mt-4 grid gap-4">
        <div>
          <label htmlFor={`${baseId}-goals`} className="block text-sm font-medium text-slate-700">
            Learning goals (one per line)
          </label>
          <textarea
            id={`${baseId}-goals`}
            value={profile.goals.join('\n')}
            disabled={!canEdit}
            className={`${INPUT_CLASS} min-h-[96px]`}
            onChange={(event) =>
              update(
                'goals',
                event.target.value
                  .split('\n')
                  .map((goal) => goal.trim())
                  .filter(Boolean),
              )
            }
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor={`${baseId}-level`} className="block text-sm font-medium text-slate-700">
              Current level
            </label>
            <select
              id={`${baseId}-level`}
              value={profile.currentLevel}
              disabled={!canEdit}
              className={INPUT_CLASS}
              onChange={(event) => update('currentLevel', event.target.value as MenteeLearningProfile['currentLevel'])}
            >
              {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${baseId}-language`} className="block text-sm font-medium text-slate-700">
              Preferred language
            </label>
            <input
              id={`${baseId}-language`}
              type="text"
              value={profile.preferredLanguage}
              disabled={!canEdit}
              className={INPUT_CLASS}
              onChange={(event) => update('preferredLanguage', event.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`${baseId}-tz`} className="block text-sm font-medium text-slate-700">
              Time zone
            </label>
            <input
              id={`${baseId}-tz`}
              type="text"
              value={profile.timeZone}
              disabled={!canEdit}
              className={INPUT_CLASS}
              onChange={(event) => update('timeZone', event.target.value)}
            />
          </div>
        </div>

        <div>
          <label htmlFor={`${baseId}-visibility`} className="block text-sm font-medium text-slate-700">
            Visibility
          </label>
          <select
            id={`${baseId}-visibility`}
            value={profile.visibility}
            disabled={!canEdit}
            className={INPUT_CLASS}
            onChange={(event) => update('visibility', event.target.value as MenteeProfileVisibility)}
          >
            {MENTEE_VISIBILITIES.map((visibility) => (
              <option key={visibility} value={visibility}>
                {visibility}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        Accessibility needs and matching preferences are sensitive. They stay private and are only
        used by authorized matching — a mentor never sees them.
      </div>

      <div className="mt-6">
        <button
          type="button"
          disabled={!canEdit || saving || errors.length > 0}
          aria-busy={saving}
          onClick={() => void persist()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Saving learning profile...' : 'Save learning profile'}
        </button>
      </div>
    </section>
  );
}
