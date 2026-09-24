'use client';

import React from 'react';
import { Check } from 'lucide-react';

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

export interface Facet {
  key: string;
  label: string;
  options: FacetOption[];
}

interface FacetedFilterProps {
  facets: Facet[];
  selected: Record<string, string[]>;
  onChange: (facets: Record<string, string[]>) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function FacetedFilter({
  facets,
  selected,
  onChange,
  isLoading = false,
  error = null,
}: FacetedFilterProps) {
  const toggleOption = (facetKey: string, optionValue: string) => {
    const current = selected[facetKey] ?? [];
    const next = current.includes(optionValue)
      ? current.filter(v => v !== optionValue)
      : [...current, optionValue];
    onChange({ ...selected, [facetKey]: next });
  };

  const activeCount = Object.values(selected).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="space-y-4" aria-label="Catalog filters">
      {activeCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{activeCount} filter{activeCount > 1 ? 's' : ''} active</span>
          <button
            type="button"
            onClick={() => onChange({})}
            className="text-xs text-indigo-600 hover:text-indigo-800 underline"
          >
            Clear all
          </button>
        </div>
      )}

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          Could not load filters: {error}
        </p>
      ) : isLoading && facets.length === 0 ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading filters">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      ) : facets.length === 0 ? (
        <p className="text-sm text-gray-500" role="status">
          No filters available.
        </p>
      ) : (
        facets.map(facet => (
          <fieldset key={facet.key} className="space-y-1.5">
            <legend className="text-sm font-medium text-gray-900 mb-2">{facet.label}</legend>
            {facet.options.map(option => {
              const isSelected = (selected[facet.key] ?? []).includes(option.value);
              return (
                <label
                  key={option.value}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <div
                    className={`w-4 h-4 border rounded flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-600'
                        : 'border-gray-300 group-hover:border-gray-400'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" aria-hidden="true" />}
                  </div>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleOption(facet.key, option.value)}
                    className="sr-only"
                  />
                  <span className="text-sm text-gray-700 flex-1">{option.label}</span>
                  <span className="text-xs text-gray-400">{option.count}</span>
                </label>
              );
            })}
          </fieldset>
        ))
      )}
    </div>
  );
}
