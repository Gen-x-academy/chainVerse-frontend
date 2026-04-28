import React from 'react';
import clsx from 'clsx';
import { FormError } from './FormError';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Rendered as a <label> above the input. */
  label?: string;
  /** Validation error message — triggers red border and error text. */
  error?: string;
  /** Hint text shown below the input when there is no error. */
  helperText?: string;
  /** Shows a red asterisk next to the label. */
  required?: boolean;
}

/**
 * Input
 *
 * Reusable form input with:
 * - Optional label with required indicator
 * - Normal, error, and disabled visual states
 * - Helper text for contextual hints
 * - Accessible: label is associated via htmlFor/id
 */
export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  required,
  id,
  className,
  disabled,
  ...props
}) => {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block mb-1 text-sm font-medium text-gray-700"
        >
          {label}
          {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
        </label>
      )}

      <input
        id={inputId}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-hint` : undefined}
        className={clsx(
          'w-full px-3 py-2 border rounded-md transition',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
          error
            ? 'border-red-500 focus-visible:ring-red-500 bg-red-50'
            : 'border-gray-300 focus-visible:ring-blue-500 bg-white',
          disabled && 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60',
          className,
        )}
        {...props}
      />

      {error ? (
        <FormError message={error} />
      ) : helperText ? (
        <p id={`${inputId}-hint`} className="text-xs text-gray-500 mt-1">
          {helperText}
        </p>
      ) : null}
    </div>
  );
};
