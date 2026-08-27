'use client';

import React from 'react';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 'bibliographic', label: 'Bibliographic' },
  { id: 'contributors', label: 'Contributors' },
  { id: 'taxonomy', label: 'Taxonomy' },
  { id: 'holdings', label: 'Holdings' },
  { id: 'digital', label: 'Digital formats' },
] as const;

export type BookFormStep = (typeof STEPS)[number]['id'];

export interface BookFormStepperProps {
  currentStep: BookFormStep;
  onStepClick?: (step: BookFormStep) => void;
  completedSteps?: BookFormStep[];
  className?: string;
}

export function BookFormStepper({
  currentStep,
  onStepClick,
  completedSteps = [],
  className,
}: BookFormStepperProps) {
  return (
    <nav aria-label="Book form sections" className={cn('flex flex-wrap gap-2', className)}>
      {STEPS.map((step, index) => {
        const isActive = step.id === currentStep;
        const isComplete = completedSteps.includes(step.id);
        const clickable = Boolean(onStepClick);

        return (
          <button
            key={step.id}
            type="button"
            disabled={!clickable}
            onClick={() => onStepClick?.(step.id)}
            className={cn(
              'text-xs md:text-sm px-3 py-1.5 rounded-full border transition',
              isActive && 'bg-gray-900 text-white border-gray-900',
              !isActive && isComplete && 'bg-green-50 text-green-800 border-green-200',
              !isActive && !isComplete && 'bg-white text-gray-600 border-gray-200',
              clickable && !isActive && 'hover:border-gray-400 cursor-pointer',
              !clickable && 'cursor-default'
            )}
            aria-current={isActive ? 'step' : undefined}
          >
            {index + 1}. {step.label}
          </button>
        );
      })}
    </nav>
  );
}

export { STEPS as BOOK_FORM_STEPS };
