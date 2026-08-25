"use client";

import { useState } from "react";

export type ChannelPrefs = { inApp: boolean; email: boolean; push: boolean };

// Per-event channel preference controls. Mandatory events can't be disabled.
export default function NotificationChannelPrefs({
  eventLabel,
  required,
  value,
  onChange,
}: {
  eventLabel: string;
  required?: boolean;
  value: ChannelPrefs;
  onChange: (next: ChannelPrefs) => void;
}) {
  const [prefs, setPrefs] = useState(value);

  const toggle = (key: keyof ChannelPrefs) => {
    if (required) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    onChange(next);
  };

  return (
    <div className="flex items-center justify-between border-b py-2 text-sm">
      <span>
        {eventLabel}
        {required && <span className="text-xs text-gray-400 ml-2">(required, cannot disable)</span>}
      </span>
      <div className="flex gap-3">
        {(["inApp", "email", "push"] as const).map((key) => (
          <label key={key} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={prefs[key]}
              disabled={required}
              onChange={() => toggle(key)}
            />
            {key}
          </label>
        ))}
      </div>
    </div>
  );
}
