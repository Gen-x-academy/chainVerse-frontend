'use client';

import React from 'react';
import type { AccessibilityFeatures } from '../types';

const DEFAULT_CATEGORIES = ['Blockchain', 'DeFi', 'NFTs', 'Smart Contracts'];
const DEFAULT_LEVELS = ['All', 'Beginner', 'Intermediate', 'Advanced'];

const ACCESSIBILITY_OPTIONS: { key: keyof AccessibilityFeatures; label: string }[] = [
  { key: 'largePrint', label: 'Large Print' },
  { key: 'braille', label: 'Braille' },
  { key: 'dyslexiaFriendly', label: 'Dyslexia-Friendly' },
  { key: 'captioned', label: 'Closed Captions' },
  { key: 'transcript', label: 'Transcripts' },
  { key: 'screenReaderCompatible', label: 'Screen Reader Compatible' },
];

export interface CourseFiltersProps {
  categories?: string[];
  levels?: string[];
  selectedCategories: string[];
  selectedLevel: string;
  priceRange: number;
  selectedAccessibility: (keyof AccessibilityFeatures)[];
  onCategoryChange: (categories: string[]) => void;
  onLevelChange: (level: string) => void;
  onPriceChange: (price: number) => void;
  onAccessibilityChange: (accessibility: (keyof AccessibilityFeatures)[]) => void;
}

export const CourseFilters: React.FC<CourseFiltersProps> = ({
  categories = DEFAULT_CATEGORIES,
  levels = DEFAULT_LEVELS,
  selectedCategories,
  selectedLevel,
  priceRange,
  selectedAccessibility,
  onCategoryChange,
  onLevelChange,
  onPriceChange,
  onAccessibilityChange,
}) => {
  const handleCategoryToggle = (category: string) => {
    if (selectedCategories.includes(category)) {
      onCategoryChange(selectedCategories.filter((c) => c !== category));
    } else {
      onCategoryChange([...selectedCategories, category]);
    }
  };

  const handleAccessibilityToggle = (key: keyof AccessibilityFeatures) => {
    if (selectedAccessibility.includes(key)) {
      onAccessibilityChange(selectedAccessibility.filter((k) => k !== key));
    } else {
      onAccessibilityChange([...selectedAccessibility, key]);
    }
  };

  return (
    <aside className="w-full lg:w-64 flex-shrink-0 overflow-hidden">
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        {/* Category Filter */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Category</h3>
          <div className="space-y-2">
            {categories.map((category) => (
              <label
                key={category}
                htmlFor={`category-${category}`}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  id={`category-${category}`}
                  type="checkbox"
                  checked={selectedCategories.includes(category)}
                  onChange={() => handleCategoryToggle(category)}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700 truncate">{category}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Level Filter */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Level</h3>
          <div className="space-y-2">
            {levels.map((level) => (
              <label
                key={level}
                htmlFor={`level-${level}`}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  id={`level-${level}`}
                  type="radio"
                  name="level"
                  checked={selectedLevel === level}
                  onChange={() => onLevelChange(level)}
                  className="w-4 h-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700 truncate">{level}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Price Range Slider */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Price Range</h3>
          <input
            type="range"
            min={0}
            max={500}
            value={priceRange}
            onChange={(e) => onPriceChange(Number(e.target.value))}
            className="w-full accent-indigo-600"
            aria-label="Price range filter"
          />
          <div className="flex justify-between text-sm text-gray-600 mt-1">
            <span>$0</span>
            <span>${priceRange}</span>
          </div>
        </div>

        {/* Accessibility Filters */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Accessibility Features</h3>
          <div className="space-y-2">
            {ACCESSIBILITY_OPTIONS.map((option) => (
              <label
                key={option.key}
                htmlFor={`accessibility-${option.key}`}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  id={`accessibility-${option.key}`}
                  type="checkbox"
                  checked={selectedAccessibility.includes(option.key)}
                  onChange={() => handleAccessibilityToggle(option.key)}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  aria-label={`Filter by ${option.label}`}
                />
                <span className="text-sm text-gray-700 truncate">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};