'use client';

import { useState } from 'react';

const LEAD_TIME_OPTIONS = [1, 3, 7] as const;

interface ReminderSettingsProps {
  timezone: string;
  onSave?: (s: { leadDays: number; quietHoursStart: string; quietHoursEnd: string }) => void;
}

/** Lets a patron pick a reminder lead time and quiet-hour window. */
export function ReminderSettings({ timezone, onSave }: ReminderSettingsProps) {
  const [leadDays, setLeadDays] = useState<number>(3);
  const [quietHoursStart, setQuietHoursStart] = useState('21:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('08:00');
  return (
    <div className="space-y-3 text-sm">
      <label className="block font-medium">
        Remind me before due date
        <select value={leadDays} onChange={(e) => setLeadDays(Number(e.target.value))} className="mt-1 block rounded border px-2 py-1">
          {LEAD_TIME_OPTIONS.map((d) => (
            <option key={d} value={d}>{d} day{d > 1 ? 's' : ''}</option>
          ))}
        </select>
      </label>
      <div className="flex gap-3">
        <label className="block font-medium">
          Quiet hours start
          <input type="time" value={quietHoursStart} onChange={(e) => setQuietHoursStart(e.target.value)} className="mt-1 block rounded border px-2 py-1" />
        </label>
        <label className="block font-medium">
          Quiet hours end
          <input type="time" value={quietHoursEnd} onChange={(e) => setQuietHoursEnd(e.target.value)} className="mt-1 block rounded border px-2 py-1" />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">Times shown in {timezone}.</p>
      <button onClick={() => onSave?.({ leadDays, quietHoursStart, quietHoursEnd })} className="rounded bg-primary px-3 py-1.5 text-primary-foreground">
        Save preferences
      </button>
    </div>
  );
}
