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
}

export function FacetedFilter({ facets, selected, onChange }: FacetedFilterProps) {
  const toggleOption = (facetKey: string, optionValue: string) => {
    const current = selected[facetKey] ?? [];
    const next = current.includes(optionValue)
      ? current.filter(v => v !== optionValue)
      : [...current, optionValue];
    onChange({ ...selected, [facetKey]: next });
  };

  const activeCount = Object.values(selected).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="space-y-4">
      {activeCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{activeCount} filter{activeCount > 1 ? 's' : ''} active</span>
          <button
            onClick={() => onChange({})}
            className="text-xs text-indigo-600 hover:text-indigo-800 underline"
          >
            Clear all
          </button>
        </div>
      )}

      {facets.map(facet => (
        <div key={facet.key}>
          <h3 className="text-sm font-medium text-gray-900 mb-2">{facet.label}</h3>
          <div className="space-y-1.5">
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
                    {isSelected && <Check className="w-3 h-3 text-white" />}
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
          </div>
        </div>
      ))}
    </div>
  );
}
