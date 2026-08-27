'use client';

import React, { useState } from 'react';
import { ChevronDown, X, Info } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface FacetOption {
  value: string;
  label: string;
  count: number;
  disabled?: boolean;
  disabledReason?: string;
}

export interface FacetProps {
  title: string;
  options: FacetOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  isLoading?: boolean;
  error?: string | null;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
}

export function Facet({
  title,
  options,
  selectedValues,
  onChange,
  isLoading = false,
  error = null,
  collapsible = true,
  defaultCollapsed = false,
  className,
}: FacetProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const handleToggle = (value: string) => {
    const option = options.find(o => o.value === value);
    if (option?.disabled) return;
    
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const handleRemoveAll = () => {
    onChange([]);
  };

  const handleRemoveOne = (value: string) => {
    onChange(selectedValues.filter(v => v !== value));
  };

  const toggleCollapse = () => {
    if (collapsible) {
      setIsCollapsed(!isCollapsed);
    }
  };

  const hasSelectedValues = selectedValues.length > 0;

  return (
    <div className={cn('border-b border-gray-200 py-4', className)}>
      <div 
        className={cn(
          'flex items-center justify-between cursor-pointer',
          collapsible && 'hover:text-gray-700'
        )}
        onClick={toggleCollapse}
      >
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-gray-900">{title}</h3>
          {hasSelectedValues && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              {selectedValues.length}
            </Badge>
          )}
        </div>
        {collapsible && (
          <ChevronDown 
            className={cn(
              'h-4 w-4 text-gray-500 transition-transform',
              !isCollapsed && 'transform rotate-180'
            )} 
          />
        )}
      </div>

      {/* Selected filters display */}
      {hasSelectedValues && !isCollapsed && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedValues.map(value => {
            const option = options.find(o => o.value === value);
            return (
              <Badge 
                key={value}
                variant="secondary"
                className="flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200"
              >
                {option?.label || value}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveOne(value);
                  }}
                  className="ml-1 hover:bg-blue-100 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveAll();
            }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Options list */}
      {!isCollapsed && (
        <div className="mt-3 space-y-2">
          {isLoading ? (
            // Loading state
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))
          ) : error ? (
            // Error state
            <p className="text-sm text-red-500">{error}</p>
          ) : options.length === 0 ? (
            // Empty state
            <p className="text-sm text-gray-500">No options available</p>
          ) : (
            options.map(option => (
              <div 
                key={option.value} 
                className={cn(
                  'flex items-center space-x-3',
                  option.disabled && 'opacity-50'
                )}
              >
                <Checkbox
                  id={`${title}-${option.value}`}
                  checked={selectedValues.includes(option.value)}
                  onCheckedChange={() => handleToggle(option.value)}
                  disabled={option.disabled}
                  className={option.disabled ? 'cursor-not-allowed' : ''}
                />
                <label
                  htmlFor={`${title}-${option.value}`}
                  className={cn(
                    'text-sm text-gray-700 flex-1 cursor-pointer flex items-center justify-between',
                    option.disabled && 'cursor-not-allowed'
                  )}
                >
                  <span className="flex items-center gap-2">
                    {option.label}
                    {option.disabled && option.disabledReason && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{option.disabledReason}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </span>
                  <span className="text-gray-400 text-xs">{option.count}</span>
                </label>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// FacetGroup component to manage multiple facets
export interface FacetGroupProps {
  children: React.ReactNode;
  className?: string;
}

export function FacetGroup({ children, className }: FacetGroupProps) {
  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 p-4', className)}>
      {children}
    </div>
  );
}

// ActiveFilters component to display all selected filters across facets
export interface ActiveFiltersProps {
  filters: { key: string; label: string; value: string; valueLabel: string }[];
  onRemove: (key: string, value: string) => void;
  onClearAll: () => void;
  className?: string;
}

export function ActiveFilters({ 
  filters, 
  onRemove, 
  onClearAll,
  className 
}: ActiveFiltersProps) {
  if (filters.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-2 mb-4', className)}>
      <span className="text-sm text-gray-600">Active filters:</span>
      {filters.map(filter => (
        <Badge
          key={`${filter.key}-${filter.value}`}
          variant="secondary"
          className="flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200"
        >
          <span className="text-xs">{filter.valueLabel}</span>
          <button
            onClick={() => onRemove(filter.key, filter.value)}
            className="ml-1 hover:bg-blue-100 rounded-full p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <button
        onClick={onClearAll}
        className="text-xs text-gray-500 hover:text-gray-700 underline ml-2"
      >
        Clear all
      </button>
    </div>
  );
}