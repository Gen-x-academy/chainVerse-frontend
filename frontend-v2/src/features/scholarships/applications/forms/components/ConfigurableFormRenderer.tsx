'use client';

import React, { useId, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileCheck,
  FileText,
  Lock,
  Send,
  ShieldCheck,
  Split,
  UploadCloud,
  UserCheck,
} from 'lucide-react';
import type {
  ConfigurableFormField,
  ConfigurableFormSchema,
  FormSection,
  FormVersionBinding,
} from '../types';
import {
  evaluateCondition,
  getActiveSectionsAndFields,
} from '../domain';
import { WordLimitIndicator } from '../../validation/components/WordLimitIndicator';
import { countWords } from '../../validation/domain';

export interface ConfigurableFormRendererProps {
  schema: ConfigurableFormSchema;
  initialAnswers?: Record<string, unknown>;
  readOnly?: boolean;
  onSubmitBinding?: (binding: FormVersionBinding) => void;
  className?: string;
}

export function ConfigurableFormRenderer({
  schema,
  initialAnswers = {},
  readOnly = false,
  onSubmitBinding,
  className = '',
}: ConfigurableFormRendererProps) {
  const formId = useId();
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers);
  const [submittedBinding, setSubmittedBinding] = useState<FormVersionBinding | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Real-time active sections & fields evaluation
  const { activeSections, activeFields } = useMemo(() => {
    return getActiveSectionsAndFields(schema, answers);
  }, [schema, answers]);

  function handleAnswerChange(fieldId: string, value: unknown) {
    if (readOnly) return;
    setAnswers((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
    if (errors[fieldId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;

    // Validate active fields
    const nextErrors: Record<string, string> = {};
    for (const field of activeFields) {
      if (field.required) {
        const val = answers[field.id];
        if (
          val === undefined ||
          val === null ||
          (typeof val === 'string' && !val.trim()) ||
          (Array.isArray(val) && val.length === 0)
        ) {
          nextErrors[field.id] = `${field.label} is required.`;
        }
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    // Bind answers strictly to schema version and content hash
    const binding: FormVersionBinding = {
      schemaId: schema.id,
      version: schema.version,
      schemaHash: schema.schemaHash,
      answers,
      submittedAt: new Date().toISOString(),
      verified: true,
    };

    setSubmittedBinding(binding);
    if (onSubmitBinding) {
      onSubmitBinding(binding);
    }
  }

  if (submittedBinding) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-8 text-center shadow-xs space-y-4"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Answers Bound &amp; Verified</h2>
        <p className="text-xs text-slate-600 max-w-md mx-auto">
          Your application answers have been locked to accepted form <strong>v{submittedBinding.version}</strong> and sealed with cryptographic schema hash.
        </p>

        <div className="mx-auto max-w-sm rounded-xl border border-slate-200 bg-white p-4 text-left text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-500">Form Version:</span>
            <span className="font-semibold text-slate-800">v{submittedBinding.version}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Schema Hash:</span>
            <span className="font-mono text-[11px] text-slate-700">{submittedBinding.schemaHash}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Submission Timestamp:</span>
            <span className="text-slate-700">{new Date(submittedBinding.submittedAt!).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={`space-y-8 ${className}`}>
      {/* Immutability and Version header badge */}
      <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5 text-xs text-indigo-950">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-indigo-600 shrink-0" aria-hidden="true" />
          <span>
            Bound to Form Version <strong>v{schema.version}</strong> ({schema.status})
          </span>
        </div>
        <span className="font-mono text-[10px] text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
          Hash: {schema.schemaHash}
        </span>
      </div>

      {/* Render Sections */}
      <div className="space-y-6">
        {activeSections.map((section, sIndex) => (
          <section
            key={section.id}
            aria-labelledby={`sec-heading-${section.id}`}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5"
          >
            <header className="border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-700">
                  {sIndex + 1}
                </span>
                <h3 id={`sec-heading-${section.id}`} className="text-base font-bold text-slate-900">
                  {section.title}
                </h3>
              </div>
              {section.description && (
                <p className="mt-1 text-xs text-slate-500 leading-relaxed ml-7">
                  {section.description}
                </p>
              )}
            </header>

            {/* Section Fields */}
            <div className="space-y-5">
              {section.fields.map((field) => {
                const rawVal = answers[field.id];
                const strVal = typeof rawVal === 'string' ? rawVal : '';
                const wordCount = countWords(strVal);
                const hasError = Boolean(errors[field.id]);

                return (
                  <div key={field.id} className="space-y-1.5" id={`field-wrap-${field.id}`}>
                    <div className="flex items-center justify-between">
                      <label htmlFor={`field-input-${field.id}`} className="block text-sm font-semibold text-slate-800">
                        {field.label}
                        {field.required && <span className="ml-1 text-rose-500" aria-hidden="true">*</span>}
                      </label>
                      <div className="flex items-center gap-2">
                        {field.conditional && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                            <Split className="h-2.5 w-2.5" aria-hidden="true" />
                            Conditional
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-slate-400">answers.{field.id}</span>
                      </div>
                    </div>

                    {field.description && (
                      <p className="text-xs text-slate-500 leading-relaxed">{field.description}</p>
                    )}

                    {/* Statement Kind (Rich Text with Word Limits) */}
                    {field.kind === 'statement' && (
                      <div>
                        {field.statementConfig?.prompt && (
                          <p className="text-xs italic text-slate-600 mb-1">
                            Prompt: {field.statementConfig.prompt}
                          </p>
                        )}
                        <textarea
                          id={`field-input-${field.id}`}
                          rows={4}
                          value={strVal}
                          onChange={(e) => handleAnswerChange(field.id, e.target.value)}
                          placeholder="Compose your statement here..."
                          disabled={readOnly}
                          className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                        <WordLimitIndicator
                          currentWords={wordCount}
                          minWords={field.statementConfig?.minWords}
                          maxWords={field.statementConfig?.maxWords}
                          fieldId={field.id}
                        />
                      </div>
                    )}

                    {/* Question Kind (Select / Text / Boolean) */}
                    {field.kind === 'question' && (
                      <div>
                        {field.type === 'single_select' ? (
                          <select
                            id={`field-input-${field.id}`}
                            value={strVal}
                            onChange={(e) => handleAnswerChange(field.id, e.target.value)}
                            disabled={readOnly}
                            className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-800 focus:border-indigo-500"
                          >
                            <option value="">-- Choose Option --</option>
                            {(field.questionConfig?.options ?? []).map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : field.type === 'boolean' ? (
                          <label className="flex items-center gap-2 pt-1 cursor-pointer">
                            <input
                              id={`field-input-${field.id}`}
                              type="checkbox"
                              checked={Boolean(rawVal)}
                              onChange={(e) => handleAnswerChange(field.id, e.target.checked)}
                              disabled={readOnly}
                              className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                            />
                            <span className="text-xs text-slate-700">{field.description || field.label}</span>
                          </label>
                        ) : (
                          <input
                            id={`field-input-${field.id}`}
                            type={field.type === 'number' ? 'number' : 'text'}
                            value={strVal}
                            onChange={(e) => handleAnswerChange(field.id, e.target.value)}
                            disabled={readOnly}
                            className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-800 focus:border-indigo-500"
                          />
                        )}
                      </div>
                    )}

                    {/* Consent Kind */}
                    {field.kind === 'consent' && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                        <p className="text-xs text-slate-700 leading-relaxed font-serif italic">
                          &ldquo;{field.consentConfig?.legalNoticeText}&rdquo;
                        </p>
                        <label className="flex items-center gap-2 pt-1 cursor-pointer">
                          <input
                            id={`field-input-${field.id}`}
                            type="checkbox"
                            checked={Boolean(rawVal)}
                            onChange={(e) => handleAnswerChange(field.id, e.target.checked)}
                            disabled={readOnly}
                            className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                          />
                          <span className="text-xs font-semibold text-slate-900">
                            I affirmatively agree and consent to these terms.
                          </span>
                        </label>
                      </div>
                    )}

                    {/* Reference Kind */}
                    {field.kind === 'reference' && (
                      <div className="space-y-1">
                        <input
                          id={`field-input-${field.id}`}
                          type="email"
                          placeholder="referee@university.edu"
                          value={strVal}
                          onChange={(e) => handleAnswerChange(field.id, e.target.value)}
                          disabled={readOnly}
                          className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-800 focus:border-indigo-500"
                        />
                        <p className="text-[11px] text-slate-400">
                          Referee will receive an automated verification request.
                        </p>
                      </div>
                    )}

                    {/* Evidence Kind */}
                    {field.kind === 'evidence' && (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4 text-center space-y-2">
                        <UploadCloud className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
                        <div className="text-xs text-slate-700">
                          <span>Allowed: {field.evidenceConfig?.allowedExtensions.join(', ')}</span>
                          <span className="mx-1">&bull;</span>
                          <span>Max: {((field.evidenceConfig?.maxSizeBytes || 1) / 1024 / 1024).toFixed(0)}MB</span>
                        </div>
                        <input
                          id={`field-input-${field.id}`}
                          type="text"
                          placeholder="Evidence upload reference or document ID"
                          value={strVal}
                          onChange={(e) => handleAnswerChange(field.id, e.target.value)}
                          disabled={readOnly}
                          className="w-full max-w-sm mx-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800"
                        />
                      </div>
                    )}

                    {hasError && (
                      <p role="alert" className="flex items-center gap-1 text-xs text-rose-600">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{errors[field.id]}</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {!readOnly && (
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            <span>Submit Answers (Lock to v{schema.version})</span>
          </button>
        </div>
      )}
    </form>
  );
}
