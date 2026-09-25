'use client';

import { useEffect, useState } from 'react';
import { assetConfigService } from '../service';
import type { AssetConfig } from '../types';

type Props = {
  programId: string;
};

const STATUS_STYLES: Record<AssetConfig['status'], string> = {
  approved: 'bg-emerald-100 text-emerald-800',
  pending_review: 'bg-amber-100 text-amber-800',
  rejected: 'bg-red-100 text-red-800',
  deprecated: 'bg-slate-100 text-slate-600',
};

export function AssetConfigList({ programId }: Props) {
  const [configs, setConfigs] = useState<AssetConfig[]>([]);
  const [status, setStatus] = useState<'loading' | 'empty' | 'loaded' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    assetConfigService
      .listForProgram(programId)
      .then((data) => {
        if (!cancelled) {
          setConfigs(data);
          setStatus(data.length === 0 ? 'empty' : 'loaded');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : 'Failed to load asset configurations.');
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [programId]);

  if (status === 'loading') {
    return (
      <div role="status" aria-label="Loading asset configurations" className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" aria-hidden="true" />
        ))}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {errorMessage}
      </div>
    );
  }

  if (status === 'empty') {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
        No assets configured for this program yet.
      </div>
    );
  }

  return (
    <section aria-label="Configured assets">
      <ul className="space-y-3" role="list">
        {configs.map((config) => (
          <li
            key={config.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-slate-900">
                <span className="font-mono">{config.asset.code}</span>
                <span className="ml-2 text-xs text-slate-400 capitalize">
                  ({config.asset.type} · {config.asset.network})
                </span>
              </p>
              {config.asset.issuer && (
                <p className="text-xs font-mono text-slate-400 break-all">{config.asset.issuer}</p>
              )}
              <p className="text-xs text-slate-500">
                {config.trustlineRequirement.required
                  ? 'Trustline required'
                  : 'No trustline required'}
              </p>
            </div>

            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[config.status]}`}
              aria-label={`Status: ${config.status.replace('_', ' ')}`}
            >
              {config.status.replace('_', ' ')}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default AssetConfigList;
