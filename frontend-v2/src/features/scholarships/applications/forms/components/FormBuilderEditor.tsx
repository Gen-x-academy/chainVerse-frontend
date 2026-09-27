'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileCheck,
  FileText,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Settings,
  Split,
  Trash2,
} from 'lucide-react';
import { useConfigurableFormStore } from '../store';
import { useFormSchema, useRoundFormSchemas } from '../hooks';
import { VersionHistoryPanel } from './VersionHistoryPanel';
import { ConditionalRuleBuilder } from './ConditionalRuleBuilder';
import { ConfigurableFormRenderer } from './ConfigurableFormRenderer';
import type { FormFieldKind, FormSection } from '../types';

export interface FormBuilderEditorProps {
  roundId?: string;
  initialSchemaId?: string;
  userRole?: string; // 'sponsor' | 'administrator' | 'student'
  className?: string;
}

export function FormBuilderEditor({
  roundId = 'round-stellar-2026',
  initialSchemaId = 'schema-round-stellar-draft',
  userRole = 'administrator',
  className = '',
}: FormBuilderEditorProps) {
  const isOperator = userRole === 'administrator' || userRole === 'sponsor';

  const {
    activeSchema,
    mode,
    setMode,
    loadSchema,
    addSection,
    deleteSection,
    addField,
    deleteField,
    setFieldCondition,
    publishSchema,
    forkSchema,
    conditionalValidation,
    error,
    successMessage,
    clearMessages,
    isLoading,
  } = useConfigurableFormStore();

  const { data: allSchemas = [] } = useRoundFormSchemas(roundId);

  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [showAddSection, setShowAddSection] = useState(false);
  const [selectedSectionForField, setSelectedSectionForField] = useState<string | null>(null);

  // Field creation modal/inline state
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldKind, setNewFieldKind] = useState<FormFieldKind>('question');
  const [newFieldRequired, setNewFieldRequired] = useState(true);

  useEffect(() => {
    loadSchema(initialSchemaId);
  }, [initialSchemaId, loadSchema]);

  if (isLoading || !activeSchema) {
    return (
      <div role="status" aria-busy="true" className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mx-auto" />
        <h2 className="text-sm font-semibold text-slate-800">Loading form builder...</h2>
      </div>
    );
  }

  const isPublished = activeSchema.status === 'published';

  // Flat list of all fields across sections
  const allFields = activeSchema.sections.flatMap((s) => s.fields);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Toast notifications */}
      {successMessage && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>{successMessage}</span>
          </div>
          <button type="button" onClick={clearMessages} className="font-semibold underline">Dismiss</button>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={clearMessages} className="font-semibold underline">Dismiss</button>
        </div>
      )}

      {/* Version History & Immutability Panel */}
      <VersionHistoryPanel
        schema={activeSchema}
        allSchemas={allSchemas}
        onSelectSchema={(id) => loadSchema(id)}
        onPublish={() => publishSchema('user-admin')}
        onFork={(inc) => forkSchema(inc, 'user-admin')}
      />

      {/* Conditional Logic Alert if invalid */}
      {conditionalValidation && !conditionalValidation.valid && (
        <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900 space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <span>Conditional Logic Validation Warning</span>
          </div>
          <ul className="list-disc pl-5 space-y-0.5">
            {conditionalValidation.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Mode navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <nav aria-label="Builder views" className="flex gap-4">
          <button
            type="button"
            onClick={() => setMode('builder')}
            className={`flex items-center gap-1.5 pb-2 text-xs font-semibold border-b-2 transition ${
              mode === 'builder'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Layers className="h-4 w-4" aria-hidden="true" />
            <span>Section &amp; Field Builder</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('preview')}
            className={`flex items-center gap-1.5 pb-2 text-xs font-semibold border-b-2 transition ${
              mode === 'preview'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            <span>Interactive Form Preview</span>
          </button>
        </nav>

        {isOperator && mode === 'builder' && !isPublished && (
          <button
            type="button"
            onClick={() => setShowAddSection(true)}
            className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Add Section</span>
          </button>
        )}
      </div>

      {/* Interactive Preview Mode */}
      {mode === 'preview' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Previewing student interactive application journey with real-time conditional evaluation.
          </div>
          <ConfigurableFormRenderer schema={activeSchema} />
        </div>
      )}

      {/* Builder Mode */}
      {mode === 'builder' && (
        <div className="space-y-6">
          {/* Add Section Inline Form */}
          {showAddSection && !isPublished && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
              <h3 className="text-xs font-bold text-indigo-950">Add New Form Section</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Section Title (e.g. Research & Capstone Proposal)"
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newSectionTitle.trim()) {
                      addSection(newSectionTitle.trim());
                      setNewSectionTitle('');
                      setShowAddSection(false);
                    }
                  }}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddSection(false)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {activeSchema.sections.length === 0 ? (
            <div role="status" className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center">
              <Layers className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
              <h3 className="mt-2 text-sm font-semibold text-slate-900">No sections added yet</h3>
              <p className="mt-1 text-xs text-slate-500">
                Click &ldquo;Add Section&rdquo; above to begin structuring the application form.
              </p>
            </div>
          ) : (
            activeSchema.sections.map((section, sIdx) => (
              <div
                key={section.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-700">
                      {sIdx + 1}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">{section.title}</h3>
                  </div>

                  {!isPublished && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedSectionForField(section.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        <Plus className="h-3 w-3" aria-hidden="true" />
                        <span>Add Field</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSection(section.id)}
                        aria-label={`Delete section ${section.title}`}
                        className="rounded-lg p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Add Field Inline Modal for this section */}
                {selectedSectionForField === section.id && !isPublished && (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 space-y-3">
                    <h4 className="text-xs font-bold text-indigo-950">Add Field to {section.title}</h4>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <input
                        type="text"
                        placeholder="Field Label (e.g. Personal Essay)"
                        value={newFieldLabel}
                        onChange={(e) => setNewFieldLabel(e.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                      />
                      <select
                        value={newFieldKind}
                        onChange={(e) => setNewFieldKind(e.target.value as FormFieldKind)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800"
                      >
                        <option value="statement">Statement (Rich Text / Essay)</option>
                        <option value="question">Question (Custom Field)</option>
                        <option value="consent">Consent (Legal Agreement)</option>
                        <option value="reference">Reference (Referee Recommendation)</option>
                        <option value="evidence">Evidence (Supporting Document)</option>
                      </select>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newFieldRequired}
                            onChange={(e) => setNewFieldRequired(e.target.checked)}
                            className="rounded text-indigo-600"
                          />
                          <span>Required</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            if (newFieldLabel.trim()) {
                              const fieldId = `field_${newFieldLabel
                                .toLowerCase()
                                .replace(/[^a-z0-9]/g, '_')}_${Date.now().toString().slice(-4)}`;
                              addField(section.id, {
                                id: fieldId,
                                kind: newFieldKind,
                                type: newFieldKind === 'statement' ? 'rich_text' : 'text',
                                label: newFieldLabel.trim(),
                                required: newFieldRequired,
                                statementConfig:
                                  newFieldKind === 'statement'
                                    ? { prompt: 'Please elaborate...', maxWords: 500 }
                                    : undefined,
                              });
                              setNewFieldLabel('');
                              setSelectedSectionForField(null);
                            }
                          }}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedSectionForField(null)}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Fields list */}
                <div className="space-y-3">
                  {section.fields.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No fields in this section.</p>
                  ) : (
                    section.fields.map((field) => (
                      <div
                        key={field.id}
                        className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{field.label}</span>
                            <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                              Kind: {field.kind}
                            </span>
                            {field.required && (
                              <span className="text-[10px] font-semibold text-rose-600">Required</span>
                            )}
                          </div>

                          {!isPublished && (
                            <button
                              type="button"
                              onClick={() => deleteField(field.id)}
                              aria-label={`Delete field ${field.label}`}
                              className="text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>

                        {/* Conditional rule builder for this field */}
                        {!isPublished && (
                          <ConditionalRuleBuilder
                            currentFieldId={field.id}
                            condition={field.conditional}
                            availableTargetFields={allFields}
                            onChange={(cond) => setFieldCondition(field.id, cond)}
                          />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
