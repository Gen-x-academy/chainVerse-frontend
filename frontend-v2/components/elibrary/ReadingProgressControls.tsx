"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

export interface ReadingProgressControlsProps {
  /** 0-100, clamped to the rendition's valid bounds by the caller */
  progress: number;
  isPrivate?: boolean;
  onChangePrivacy?: (isPrivate: boolean) => void;
  onReset?: () => void;
  className?: string;
}

export function ReadingProgressControls({
  progress,
  isPrivate = false,
  onChangePrivacy,
  onReset,
  className,
}: ReadingProgressControlsProps) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div className={cn("rounded-lg border border-gray-200 p-3 text-sm", className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-600">Progress</span>
        <span className="font-medium">{clamped}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100">
        <div
          className="h-2 rounded-full bg-blue-600"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-3">
        <label className="flex items-center gap-2 text-xs text-gray-500">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => onChangePrivacy?.(e.target.checked)}
          />
          Keep progress private
        </label>
        {confirmingReset ? (
          <div className="flex gap-2 text-xs">
            <button onClick={() => { onReset?.(); setConfirmingReset(false); }} className="text-red-600">
              Confirm reset
            </button>
            <button onClick={() => setConfirmingReset(false)} className="text-gray-400">
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingReset(true)}
            className="text-xs text-gray-500 hover:underline"
          >
            Reset progress
          </button>
        )}
      </div>
    </div>
  );
}
