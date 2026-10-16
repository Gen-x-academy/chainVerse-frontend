'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  mentorshipTaxonomyService,
  migrateExpertiseId,
  resolveExpertiseId,
  validateTaxonomy,
} from '../service';
import type { ExpertiseNode } from '../types';

type Props = {
  canManage?: boolean;
};

export function ExpertiseTaxonomyBrowser({ canManage = false }: Props) {
  const baseId = useId();
  const [nodes, setNodes] = useState<ExpertiseNode[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setNodes(await mentorshipTaxonomyService.list());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the taxonomy.');
      setNodes(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const taxonomyErrors = useMemo(() => (nodes ? validateTaxonomy(nodes) : []), [nodes]);

  const resolvedId = useMemo(
    () => (nodes && query.trim() ? resolveExpertiseId(query, nodes) : undefined),
    [nodes, query],
  );

  const migratedId = useMemo(() => {
    if (!nodes || !resolvedId) return undefined;
    return migrateExpertiseId(resolvedId, nodes);
  }, [nodes, resolvedId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600" role="status" aria-live="polite">
        Loading expertise taxonomy...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700" role="alert">
        <p className="font-semibold">The expertise taxonomy could not be loaded.</p>
        <p className="mt-1">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-200"
        >
          Retry loading taxonomy
        </button>
      </div>
    );
  }

  if (!nodes || nodes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600" role="status">
        No expertise skills are defined yet.
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby={`${baseId}-heading`}>
      <h2 id={`${baseId}-heading`} className="text-xl font-semibold text-slate-900">
        Mentor expertise taxonomy
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {nodes.length} skills. Filters always target the stable skill id, never the label.
      </p>

      <div className="mt-4">
        <label htmlFor={`${baseId}-search`} className="block text-sm font-medium text-slate-700">
          Find a skill by label or alias
        </label>
        <input
          id={`${baseId}-search`}
          type="search"
          value={query}
          placeholder="e.g. machine learning"
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          onChange={(event) => setQuery(event.target.value)}
        />
        {query.trim() && (
          <p className="mt-2 text-sm text-slate-600" role="status" aria-live="polite">
            {resolvedId
              ? `Resolves to stable id "${migratedId ?? resolvedId}"${migratedId && migratedId !== resolvedId ? ' (migrated from a deprecated skill)' : ''}.`
              : 'No skill matches that label or alias.'}
          </p>
        )}
      </div>

      {taxonomyErrors.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="alert">
          <p className="font-semibold">The taxonomy has {taxonomyErrors.length} problem(s).</p>
          <ul className="mt-2 list-disc pl-5">
            {taxonomyErrors.map((item) => (
              <li key={`${item.nodeId}:${item.code}`}>{item.message}</li>
            ))}
          </ul>
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {nodes.map((node) => (
          <li key={node.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-900">{node.label}</span>
              <code className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{node.id}</code>
              {node.deprecated && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  deprecated → {node.replacedBy}
                </span>
              )}
              {node.evidenceRequired && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">
                  evidence required
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Proficiency: {node.proficiencyLevels.join(', ') || 'none'} · Aliases:{' '}
              {node.aliases.join(', ') || 'none'}
            </p>
          </li>
        ))}
      </ul>

      {canManage && (
        <p className="mt-6 text-xs text-slate-500">
          Node changes are audited; use the deprecate action to retire a skill in favour of its
          replacement.
        </p>
      )}
    </section>
  );
}
