'use client';

import React from 'react';
import { AlertCircle, Calendar, DollarSign, HelpCircle } from 'lucide-react';
import type {
  ApplicationAnswerValue,
  ApplicationFieldSchema,
  FieldValidationError,
} from '../types';
import { WordLimitIndicator } from './WordLimitIndicator';

export interface FormFieldRendererProps {
  field: ApplicationFieldSchema;
  value: ApplicationAnswerValue;
  error?: FieldValidationError;
  touched?: boolean;
  wordCount?: number;
  readOnly?: boolean;
  onChange: (value: ApplicationAnswerValue) => void;
  onBlur?: () => void;
}

export function FormFieldRenderer({
  field,
  value,
  error,
  touched,
  wordCount = 0,
  readOnly = false,
  onChange,
  onBlur,
}: FormFieldRendererProps) {
  const inputId = `field-${field.id}`;
  const errorId = `${inputId}-error`;
  const descId = `${inputId}-desc`;
  const helpId = `${inputId}-help`;

  const hasError = Boolean(error && (touched || error.code === 'WORD_LIMIT_EXCEEDED'));

  const describedByParts: string[] = [];
  if (field.description) describedByParts.push(descId);
  if (field.helpText) describedByParts.push(helpId);
  if (hasError) describedByParts.push(errorId);
  const ariaDescribedBy = describedByParts.length > 0 ? describedByParts.join(' ') : undefined;

  // Render Read-Only View (Reviewer / Sponsor Mode)
  if (readOnly) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-800">{field.label}</span>
          <span className="font-mono text-[11px] text-slate-400">answers.{field.id}</span>
        </div>
        {field.type === 'rich_text' && (
          <div>
            <p className="whitespace-pre-wrap text-slate-700 leading-relaxed font-sans mt-1">
              {String(value || '(No answer provided)')}
            </p>
            <div className="mt-2 text-[11px] text-slate-500">
              Normalized Word Count: <strong>{wordCount} words</strong>
              {field.maxWords && ` (Limit: ${field.maxWords})`}
            </div>
          </div>
        )}
        {field.type !== 'rich_text' && (
          <div className="font-medium text-slate-900 mt-1">
            {Array.isArray(value)
              ? value.join(', ')
              : field.type === 'currency'
              ? `$${(Number(value || 0) / 100).toFixed(2)}`
              : String(value ?? '(Empty)')}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5" id={`container-${field.id}`}>
      {/* Field Label */}
      <div className="flex items-center justify-between">
        <label htmlFor={inputId} className="block text-sm font-semibold text-slate-800">
          {field.label}
          {field.required && <span className="ml-1 text-rose-500" aria-hidden="true">*</span>}
        </label>
        <span className="font-mono text-[10px] text-slate-400" aria-label={`Field path answers.${field.id}`}>
          answers.{field.id}
        </span>
      </div>

      {/* Description */}
      {field.description && (
        <p id={descId} className="text-xs text-slate-500 leading-relaxed">
          {field.description}
        </p>
      )}

      {/* Input Types */}
      {field.type === 'text' && (
        <input
          id={inputId}
          name={field.id}
          type="text"
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder}
          required={field.required}
          aria-required={field.required}
          aria-invalid={hasError}
          aria-describedby={ariaDescribedBy}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
            hasError
              ? 'border-rose-300 bg-rose-50/20 focus:border-rose-500 focus:ring-rose-100'
              : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100'
          }`}
        />
      )}

      {field.type === 'rich_text' && (
        <div>
          <textarea
            id={inputId}
            name={field.id}
            rows={5}
            value={typeof value === 'string' ? value : ''}
            placeholder={field.placeholder}
            required={field.required}
            aria-required={field.required}
            aria-invalid={hasError}
            aria-describedby={ariaDescribedBy}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
              hasError
                ? 'border-rose-300 bg-rose-50/20 focus:border-rose-500 focus:ring-rose-100'
                : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100'
            }`}
          />
          <WordLimitIndicator
            currentWords={wordCount}
            minWords={field.minWords}
            maxWords={field.maxWords}
            fieldId={field.id}
          />
        </div>
      )}

      {field.type === 'number' && (
        <input
          id={inputId}
          name={field.id}
          type="number"
          step="any"
          value={value !== null && value !== undefined ? String(value) : ''}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          required={field.required}
          aria-required={field.required}
          aria-invalid={hasError}
          aria-describedby={ariaDescribedBy}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          onBlur={onBlur}
          className={`w-full max-w-xs rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
            hasError
              ? 'border-rose-300 bg-rose-50/20 focus:border-rose-500 focus:ring-rose-100'
              : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100'
          }`}
        />
      )}

      {field.type === 'currency' && (
        <div className="relative max-w-xs">
          <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
          <input
            id={inputId}
            name={field.id}
            type="text"
            value={
              typeof value === 'number'
                ? (value / 100).toFixed(2)
                : typeof value === 'string'
                ? value
                : ''
            }
            placeholder={field.placeholder || '0.00'}
            required={field.required}
            aria-required={field.required}
            aria-invalid={hasError}
            aria-describedby={ariaDescribedBy}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            className={`w-full rounded-xl border pl-8 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
              hasError
                ? 'border-rose-300 bg-rose-50/20 focus:border-rose-500 focus:ring-rose-100'
                : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100'
            }`}
          />
        </div>
      )}

      {field.type === 'date' && (
        <div className="relative max-w-xs">
          <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden="true" />
          <input
            id={inputId}
            name={field.id}
            type="date"
            value={typeof value === 'string' ? value : ''}
            min={field.minDate}
            max={field.maxDate}
            required={field.required}
            aria-required={field.required}
            aria-invalid={hasError}
            aria-describedby={ariaDescribedBy}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            className={`w-full rounded-xl border pl-9 pr-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 ${
              hasError
                ? 'border-rose-300 bg-rose-50/20 focus:border-rose-500 focus:ring-rose-100'
                : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100'
            }`}
          />
        </div>
      )}

      {field.type === 'single_select' && (
        <select
          id={inputId}
          name={field.id}
          value={typeof value === 'string' ? value : ''}
          required={field.required}
          aria-required={field.required}
          aria-invalid={hasError}
          aria-describedby={ariaDescribedBy}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 ${
            hasError
              ? 'border-rose-300 bg-rose-50/20 focus:border-rose-500 focus:ring-rose-100'
              : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100'
          }`}
        >
          <option value="">-- Select an option --</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {field.type === 'multi_select' && (
        <div
          role="group"
          aria-labelledby={`${inputId}-label`}
          aria-invalid={hasError}
          aria-describedby={ariaDescribedBy}
          className="grid gap-2 sm:grid-cols-2 pt-1"
        >
          <span id={`${inputId}-label`} className="sr-only">{field.label} selection group</span>
          {(field.options ?? []).map((opt) => {
            const currentList = Array.isArray(value) ? value : [];
            const isChecked = currentList.includes(opt.value);

            return (
              <label
                key={opt.value}
                className={`flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition ${
                  isChecked
                    ? 'border-indigo-600 bg-indigo-50/40 text-indigo-900'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-800'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange([...currentList, opt.value]);
                    } else {
                      onChange(currentList.filter((v) => v !== opt.value));
                    }
                  }}
                  onBlur={onBlur}
                  className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <span className="text-xs font-medium">{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}

      {field.type === 'boolean' && (
        <label className="flex items-start gap-3 pt-1 cursor-pointer">
          <input
            id={inputId}
            name={field.id}
            type="checkbox"
            checked={Boolean(value)}
            required={field.required}
            aria-required={field.required}
            aria-invalid={hasError}
            aria-describedby={ariaDescribedBy}
            onChange={(e) => onChange(e.target.checked)}
            onBlur={onBlur}
            className="mt-0.5 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
          />
          <span className="text-xs text-slate-700 leading-relaxed">
            {field.description || field.label}
          </span>
        </label>
      )}

      {/* Help text */}
      {field.helpText && (
        <p id={helpId} className="text-[11px] text-slate-400">
          {field.helpText}
        </p>
      )}

      {/* Error message */}
      {hasError && (
        <p id={errorId} role="alert" className="flex items-center gap-1.5 text-xs text-rose-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error?.message}</span>
        </p>
      )}
    </div>
  );
}
