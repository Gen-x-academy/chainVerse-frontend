'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  MENTOR_PROFILE_LIMITS,
  canPublishMentorProfile,
  mentorshipProfileService,
  validateMentorProfile,
} from '../service';
import type { MentorProfile } from '../types';

type Props = {
  mentorId: string;
  canEdit?: boolean;
};

const INPUT_CLASS =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200';
const TEXTAREA_CLASS = `${INPUT_CLASS} min-h-[96px]`;

export function MentorProfileEditor({ mentorId, canEdit = true }: Props) {
  const baseId = useId();
  const [profile, setProfile] = useState<MentorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfile(await mentorshipProfileService.get(mentorId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the profile.');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [mentorId]);

  useEffect(() => {
    void load();
  }, [load]);

  const errors = useMemo(() => (profile ? validateMentorProfile(profile) : []), [profile]);
  const errorByPath = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of errors) map.set(item.path, item.message);
    return map;
  }, [errors]);

  const update = <K extends keyof MentorProfile>(key: K, value: MentorProfile[K]) => {
    if (!profile || !canEdit) return;
    setProfile({ ...profile, [key]: value });
  };

  const persist = async (publish: boolean) => {
    if (!profile) return;
    if (errors.length > 0) {
      setError('Fix the highlighted fields before saving.');
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const saved = publish
        ? await mentorshipProfileService.publish(profile)
        : await mentorshipProfileService.save(profile);
      setProfile(saved);
      setStatus(publish ? 'Profile published.' : 'Draft saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600" role="status" aria-live="polite">
        Loading mentor profile...
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700" role="alert">
        <p className="font-semibold">The profile could not be loaded.</p>
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
        No mentor profile exists yet.
      </div>
    );
  }

  const publishable = canPublishMentorProfile(profile);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby={`${baseId}-heading`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 id={`${baseId}-heading`} className="text-xl font-semibold text-slate-900">
          Mentor professional profile
        </h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
          {profile.visibility} · v{profile.version}
        </span>
      </div>

      {!canEdit && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="note">
          You do not have permission to edit this profile. Fields are read-only.
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
          <label htmlFor={`${baseId}-headline`} className="block text-sm font-medium text-slate-700">
            Headline
          </label>
          <input
            id={`${baseId}-headline`}
            type="text"
            value={profile.headline}
            disabled={!canEdit}
            maxLength={MENTOR_PROFILE_LIMITS.headline}
            className={INPUT_CLASS}
            onChange={(event) => update('headline', event.target.value)}
          />
        </div>

        <div>
          <label htmlFor={`${baseId}-bio`} className="block text-sm font-medium text-slate-700">
            Biography
          </label>
          <textarea
            id={`${baseId}-bio`}
            value={profile.biography}
            disabled={!canEdit}
            className={TEXTAREA_CLASS}
            onChange={(event) => update('biography', event.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${baseId}-languages`} className="block text-sm font-medium text-slate-700">
              Teaching languages (comma separated)
            </label>
            <input
              id={`${baseId}-languages`}
              type="text"
              value={profile.languages.join(', ')}
              disabled={!canEdit}
              className={INPUT_CLASS}
              onChange={(event) =>
                update(
                  'languages',
                  event.target.value
                    .split(',')
                    .map((value) => value.trim())
                    .filter(Boolean),
                )
              }
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
              placeholder="Europe/London"
              className={INPUT_CLASS}
              onChange={(event) => update('timeZone', event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${baseId}-years`} className="block text-sm font-medium text-slate-700">
              Years of experience
            </label>
            <input
              id={`${baseId}-years`}
              type="number"
              min={0}
              max={MENTOR_PROFILE_LIMITS.maxYearsOfExperience}
              value={Number.isFinite(profile.yearsOfExperience) ? profile.yearsOfExperience : ''}
              disabled={!canEdit}
              aria-invalid={errorByPath.has('yearsOfExperience') || undefined}
              className={INPUT_CLASS}
              onChange={(event) => update('yearsOfExperience', Number(event.target.value))}
            />
          </div>
          <div>
            <label htmlFor={`${baseId}-approach`} className="block text-sm font-medium text-slate-700">
              Teaching approach
            </label>
            <textarea
              id={`${baseId}-approach`}
              value={profile.teachingApproach}
              disabled={!canEdit}
              className={TEXTAREA_CLASS}
              onChange={(event) => update('teachingApproach', event.target.value)}
            />
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="alert">
          <p className="font-semibold">This profile is not ready to publish yet.</p>
          <ul className="mt-2 list-disc pl-5">
            {errors.map((item) => (
              <li key={`${item.path}:${item.code}`}>{item.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canEdit || saving || errors.length > 0}
          aria-busy={saving}
          onClick={() => void persist(false)}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Save draft
        </button>
        <button
          type="button"
          disabled={!canEdit || saving || !publishable}
          onClick={() => void persist(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Publish profile
        </button>
        {!publishable && (
          <span className="text-xs text-slate-500">Complete the required fields to publish.</span>
        )}
      </div>
    </section>
  );
}
