'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MentorshipAudience, MentorshipFieldName, MentorshipPrivacyPreferences, MentorshipPrivacySetting } from '../types';
import { mentorshipPrivacyService } from '../service';

type Props = {
  userId: string;
};

const FIELDS: Array<{ key: MentorshipFieldName; label: string }> = [
  { key: 'profile', label: 'Profile' },
  { key: 'goals', label: 'Goals' },
  { key: 'availability', label: 'Availability' },
  { key: 'achievements', label: 'Achievements' },
  { key: 'contact', label: 'Contact' },
];

const AUDIENCES: MentorshipAudience[] = ['private', 'mentees', 'mentors', 'staff', 'public'];

export function PrivacyControls({ userId }: Props) {
  const [prefs, setPrefs] = useState<MentorshipPrivacyPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPrefs(await mentorshipPrivacyService.get(userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load privacy settings');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateSetting = (field: MentorshipFieldName, audience: MentorshipAudience) => {
    if (!prefs) return;
    setPrefs({
      ...prefs,
      settings: prefs.settings.map((s) =>
        s.field === field ? { ...s, audience, visible: audience !== 'private', updatedAt: new Date().toISOString(), version: s.version + 1 } : s,
      ),
    });
  };

  const save = async () => {
    if (!prefs) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const saved = await mentorshipPrivacyService.update(userId, prefs.settings);
      setPrefs(saved);
      setStatus('Privacy settings updated');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save privacy settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div role="status">Loading privacy controls...</div>;
  if (error && !prefs) return <div role="alert">{error}</div>;
  if (!prefs) return null;

  return (
    <div className="space-y-4">
      {status && <div role="status">{status}</div>}
      {error && <div role="alert">{error}</div>}
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left">Field</th>
            <th className="text-left">Audience</th>
          </tr>
        </thead>
        <tbody>
          {FIELDS.map((f) => {
            const setting = prefs.settings.find((s) => s.field === f.key);
            return (
              <tr key={f.key}>
                <td>{f.label}</td>
                <td>
                  <select
                    value={setting?.audience ?? 'private'}
                    onChange={(e) => updateSetting(f.key, e.target.value as MentorshipAudience)}
                    className="border p-1 rounded"
                  >
                    {AUDIENCES.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button onClick={() => void save()} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded">
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}
