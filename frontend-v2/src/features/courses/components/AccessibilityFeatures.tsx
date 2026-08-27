'use client';

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import type { AccessibilityFeatures } from '../types';
import { BadgeCheck, BadgeX, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AccessibilityFeaturesProps {
  accessibility?: AccessibilityFeatures;
  className?: string;
}

const accessibilityItems = [
  {
    key: 'largePrint',
    label: 'Large Print',
    description: 'Course materials are available in large print format for easier readability.',
  },
  {
    key: 'braille',
    label: 'Braille',
    description: 'Course content is available in braille format.',
  },
  {
    key: 'dyslexiaFriendly',
    label: 'Dyslexia-Friendly',
    description: 'Optimized formatting and fonts to support readers with dyslexia.',
  },
  {
    key: 'captioned',
    label: 'Closed Captions',
    description: 'All video content includes accurate closed captions.',
  },
  {
    key: 'transcript',
    label: 'Transcripts Available',
    description: 'Full text transcripts are provided for all audio and video content.',
  },
  {
    key: 'screenReaderCompatible',
    label: 'Screen Reader Compatible',
    description: 'Fully compatible with popular screen readers for visually impaired users.',
  },
] as const;

export function AccessibilityFeatures({ accessibility, className = '' }: AccessibilityFeaturesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const availableFeatures = accessibilityItems.filter(
    (item) => accessibility?.[item.key] === true
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!isExpanded) return;

    const validIndices = buttonRefs.current
      .map((ref, index) => (ref ? index : -1))
      .filter((i) => i !== -1);

    if (validIndices.length === 0) return;

    let newIndex: number | null = null;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (focusedIndex === null) {
        newIndex = validIndices[0];
      } else {
        const currentPos = validIndices.indexOf(focusedIndex);
        newIndex = validIndices[(currentPos + 1) % validIndices.length];
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (focusedIndex === null) {
        newIndex = validIndices[validIndices.length - 1];
      } else {
        const currentPos = validIndices.indexOf(focusedIndex);
        newIndex = validIndices[(currentPos - 1 + validIndices.length) % validIndices.length];
      }
    } else if (e.key === 'Escape') {
      setIsExpanded(false);
      containerRef.current?.focus();
      return;
    }

    if (newIndex !== null) {
      setFocusedIndex(newIndex);
      buttonRefs.current[newIndex]?.focus();
    }
  };

  useEffect(() => {
    if (isExpanded && focusedIndex === null && availableFeatures.length > 0) {
      const firstValidIndex = buttonRefs.current.findIndex((ref) => ref !== null);
      if (firstValidIndex !== -1) {
        setFocusedIndex(firstValidIndex);
        buttonRefs.current[firstValidIndex]?.focus();
      }
    }
  }, [isExpanded, focusedIndex, availableFeatures.length]);

  if (!accessibility || availableFeatures.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`border border-gray-200 rounded-xl p-5 ${className}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label="Accessibility features"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <BadgeCheck className="w-5 h-5 text-green-600" />
          Accessibility Features
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-controls="accessibility-features-list"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          {isExpanded ? 'Show less' : `Show all (${availableFeatures.length})`}
        </Button>
      </div>

      <div
        id="accessibility-features-list"
        className={`flex flex-wrap gap-2 transition-all duration-200 ${!isExpanded ? 'overflow-hidden' : ''}`}
        style={{ maxHeight: isExpanded ? 'none' : '48px' }}
      >
        {availableFeatures.map((item, index) => (
          <button
            key={item.key}
            ref={(el) => (buttonRefs.current[index] = el)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-semibold rounded-full hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
            aria-label={`${item.label}: ${item.description}`}
            title={item.description}
          >
            <BadgeCheck className="w-3.5 h-3.5" />
            {item.label}
          </button>
        ))}
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          {accessibilityItems.map((item) => {
            const isAvailable = accessibility?.[item.key] === true;
            return (
              <div
                key={item.key}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  isAvailable ? 'bg-green-50/50' : 'bg-gray-50'
                }`}
              >
                {isAvailable ? (
                  <BadgeCheck className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <BadgeX className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <h3 className={`font-medium text-sm ${isAvailable ? 'text-green-800' : 'text-gray-500'}`}>
                    {item.label}
                    {!isAvailable && <span className="ml-2 text-xs">(Not available)</span>}
                  </h3>
                  <p className={`text-xs mt-1 ${isAvailable ? 'text-green-700' : 'text-gray-400'}`}>
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}