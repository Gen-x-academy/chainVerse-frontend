'use client';

import React, { useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Copy,
  GitBranch,
  History,
  Lock,
  Pencil,
  Shield,
  UploadCloud,
} from 'lucide-react';
import type { ConfigurableFormSchema } from '../types';

export interface VersionHistoryPanelProps {
  schema: ConfigurableFormSchema;
  allSchemas: ConfigurableFormSchema[];
  onSelectSchema: (id: string) => void;
  onPublish: () => Promise<boolean>;
  onFork: (incrementType: 'patch' | 'minor' | 'major') => Promise<boolean>;
  isOperating?: boolean;
  className?: string;
}

export function VersionHistoryPanel({
  schema,
  allSchemas,
  onSelectSchema,
  onPublish,
  onFork,
  isOperating = false,
  className = '',
}: VersionHistoryPanelProps) {
  const [selectedForkType, setSelectedForkType] = useState<'minor' | 'patch' | 'major'>('minor');
  const isPublished = schema.status === 'published';
  const isDraft = schema.status === 'draft';
  const isArchived = schema.status === 'archived';

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-indigo-600" aria-hidden="true" />
          <h2 className="text-sm font-bold text-slate-900">Schema Version Governance</h2>
        </div>

        <div className="flex items-center gap-2">
          {isPublished && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200"
              title="Published schemas are immutable. Changes require creating a new draft version."
            >
              <Lock className="h-3 w-3" aria-hidden="true" />
              <span>v{schema.version} (Immutable)</span>
            </span>
          )}

          {isDraft && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
              <Pencil className="h-3 w-3" aria-hidden="true" />
              <span>v{schema.version} (Draft)</span>
            </span>
          )}

          {isArchived && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
              <Archive className="h-3 w-3" aria-hidden="true" />
              <span>v{schema.version} (Archived)</span>
            </span>
          )}
        </div>
      </div>

      {/* Immutability details */}
      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-2 text-xs">
        <div className="flex items-center justify-between text-slate-500">
          <span>Cryptographic Schema Hash:</span>
          <span className="font-mono text-[11px] text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
            {schema.schemaHash}
          </span>
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          {isPublished
            ? 'This schema is published and immutable. Applicants submit answers tied to this exact hash. Any modifications require creating a new version draft.'
            : 'Draft schema. You may add, edit, and reorder sections and fields freely before publishing.'}
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        {isDraft ? (
          <button
            type="button"
            onClick={onPublish}
            disabled={isOperating}
            aria-busy={isOperating}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 transition"
          >
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            <span>Publish Schema (Make Immutable)</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={selectedForkType}
              onChange={(e) => setSelectedForkType(e.target.value as 'minor' | 'patch' | 'major')}
              className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-indigo-500"
            >
              <option value="patch">Patch Bump (e.g. 1.0.1 - Typo/Clarity)</option>
              <option value="minor">Minor Bump (e.g. 1.1.0 - New Questions)</option>
              <option value="major">Major Bump (e.g. 2.0.0 - Overhaul)</option>
            </select>

            <button
              type="button"
              onClick={() => onFork(selectedForkType)}
              disabled={isOperating}
              aria-busy={isOperating}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
            >
              <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Fork New Draft</span>
            </button>
          </div>
        )}

        {/* Version Switcher */}
        {allSchemas.length > 1 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Switch Version:</span>
            <select
              value={schema.id}
              onChange={(e) => onSelectSchema(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
            >
              {allSchemas.map((s) => (
                <option key={s.id} value={s.id}>
                  v{s.version} ({s.status})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
