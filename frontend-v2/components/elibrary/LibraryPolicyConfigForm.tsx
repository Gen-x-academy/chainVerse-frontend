"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

export interface LibraryPolicyValues {
  loanDurationDays: number;
  maxRenewals: number;
  finePerDayCents: number;
  holdExpiryDays: number;
}

export interface LibraryPolicyConfigFormProps {
  initialValues: LibraryPolicyValues;
  onSave: (values: LibraryPolicyValues) => void;
  fieldErrors?: Partial<Record<keyof LibraryPolicyValues, string>>;
  effectiveAt?: string;
  className?: string;
}

const FIELDS: { key: keyof LibraryPolicyValues; label: string }[] = [
  { key: "loanDurationDays", label: "Loan duration (days)" },
  { key: "maxRenewals", label: "Max renewals" },
  { key: "finePerDayCents", label: "Fine per day (cents)" },
  { key: "holdExpiryDays", label: "Hold expiry (days)" },
];

export function LibraryPolicyConfigForm({
  initialValues,
  onSave,
  fieldErrors = {},
  effectiveAt,
  className,
}: LibraryPolicyConfigFormProps) {
  const [values, setValues] = useState(initialValues);

  return (
    <form
      className={cn("space-y-3", className)}
      onSubmit={(e) => { e.preventDefault(); onSave(values); }}
    >
      {FIELDS.map(({ key, label }) => (
        <div key={key}>
          <label className="block text-xs text-gray-500 mb-1">{label}</label>
          <input
            type="number"
            value={values[key]}
            onChange={(e) => setValues({ ...values, [key]: Number(e.target.value) })}
            className="w-full text-sm border border-gray-300 rounded-md px-2 py-1"
          />
          {fieldErrors[key] && (
            <p className="text-xs text-red-600 mt-1">{fieldErrors[key]}</p>
          )}
        </div>
      ))}
      {effectiveAt && (
        <p className="text-xs text-gray-400">Effective as of {effectiveAt}</p>
      )}
      <button type="submit" className="text-sm bg-gray-900 text-white px-4 py-1.5 rounded-md">
        Save policy
      </button>
    </form>
  );
}
