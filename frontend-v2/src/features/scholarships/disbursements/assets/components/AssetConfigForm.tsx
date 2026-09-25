'use client';

import { type FormEvent, useId, useState } from 'react';
import { assetConfigService } from '../service';
import type { AssetConfig, AssetType, CreateAssetConfigPayload, StellarNetwork } from '../types';

type FormStatus = 'idle' | 'loading' | 'success' | 'error';

type Props = {
  programId: string;
  onSuccess?: (config: AssetConfig) => void;
};

export function AssetConfigForm({ programId, onSuccess }: Props) {
  const formId = useId();
  const statusRegionId = `${formId}-status`;

  const [assetCode, setAssetCode] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('issued');
  const [issuer, setIssuer] = useState('');
  const [decimals, setDecimals] = useState('7');
  const [network, setNetwork] = useState<StellarNetwork>('testnet');
  const [trustlineRequired, setTrustlineRequired] = useState(true);
  const [trustlineReason, setTrustlineReason] = useState('');
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [lastConfig, setLastConfig] = useState<AssetConfig | null>(null);

  const isNative = assetType === 'native';

  const handleReset = () => {
    setStatus('idle');
    setErrorMessage('');
    setLastConfig(null);
    setAssetCode('');
    setIssuer('');
    setDecimals('7');
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    const payload: CreateAssetConfigPayload = {
      programId,
      asset: {
        code: isNative ? 'XLM' : assetCode.trim().toUpperCase(),
        type: assetType,
        issuer: isNative ? undefined : issuer.trim() || undefined,
        decimals: Number(decimals),
        network,
      },
      trustlineRequirement: {
        required: isNative ? false : trustlineRequired,
        reason: trustlineReason.trim() || (isNative ? 'Native asset; no trustline needed.' : 'Issued asset requires a trustline to receive payments.'),
      },
    };

    try {
      const config = await assetConfigService.create(payload);
      setLastConfig(config);
      setStatus('success');
      onSuccess?.(config);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save asset configuration.');
      setStatus('error');
    }
  };

  if (status === 'success' && lastConfig) {
    return (
      <section
        aria-label="Asset configuration saved"
        className="mx-auto w-full max-w-2xl space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6"
      >
        <p role="status" className="font-semibold text-emerald-800">
          Asset configuration saved.
        </p>
        <dl className="space-y-2 text-sm text-emerald-700">
          <div className="flex justify-between gap-4">
            <dt className="font-medium text-emerald-900">Asset code</dt>
            <dd className="font-mono">{lastConfig.asset.code}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-medium text-emerald-900">Network</dt>
            <dd className="capitalize">{lastConfig.asset.network}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-medium text-emerald-900">Trustline required</dt>
            <dd>{lastConfig.trustlineRequirement.required ? 'Yes' : 'No'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-medium text-emerald-900">Status</dt>
            <dd className="capitalize">{lastConfig.status.replace('_', ' ')}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          Configure another asset
        </button>
      </section>
    );
  }

  return (
    <section
      aria-label="Configure Stellar asset"
      className="mx-auto w-full max-w-2xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
          Asset Configuration
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Configure Stellar asset
        </h2>
        <p className="text-sm text-slate-500">
          Define the native or issued asset approved for this program, including network,
          issuer, decimals, and trustline requirements.
        </p>
      </header>

      <div id={statusRegionId} aria-live="polite" aria-atomic="true" className="sr-only">
        {status === 'loading' && 'Saving asset configuration…'}
        {status === 'success' && 'Asset configuration saved.'}
        {status === 'error' && `Error: ${errorMessage}`}
      </div>

      <form onSubmit={handleSubmit} aria-describedby={statusRegionId} noValidate>
        <fieldset className="space-y-5" disabled={status === 'loading'}>
          <legend className="sr-only">Asset details</legend>

          <div className="space-y-2">
            <label htmlFor={`${formId}-type`} className="block text-sm font-medium text-slate-700">
              Asset type
            </label>
            <select
              id={`${formId}-type`}
              value={assetType}
              onChange={(e) => setAssetType(e.target.value as AssetType)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="native">Native (XLM)</option>
              <option value="issued">Issued (custom token)</option>
            </select>
          </div>

          {!isNative && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor={`${formId}-code`}
                  className="block text-sm font-medium text-slate-700"
                >
                  Asset code
                  <span className="ml-1 text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id={`${formId}-code`}
                  type="text"
                  value={assetCode}
                  onChange={(e) => setAssetCode(e.target.value)}
                  required
                  aria-required="true"
                  maxLength={12}
                  placeholder="e.g. USDC"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor={`${formId}-issuer`}
                  className="block text-sm font-medium text-slate-700"
                >
                  Issuer account
                  <span className="ml-1 text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id={`${formId}-issuer`}
                  type="text"
                  value={issuer}
                  onChange={(e) => setIssuer(e.target.value)}
                  required
                  aria-required="true"
                  placeholder="G..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor={`${formId}-network`}
                className="block text-sm font-medium text-slate-700"
              >
                Network
              </label>
              <select
                id={`${formId}-network`}
                value={network}
                onChange={(e) => setNetwork(e.target.value as StellarNetwork)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="testnet">Testnet</option>
                <option value="mainnet">Mainnet</option>
                <option value="futurenet">Futurenet</option>
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor={`${formId}-decimals`}
                className="block text-sm font-medium text-slate-700"
              >
                Decimals
              </label>
              <input
                id={`${formId}-decimals`}
                type="number"
                min="0"
                max="18"
                value={decimals}
                onChange={(e) => setDecimals(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {!isNative && (
            <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <input
                  id={`${formId}-trustline`}
                  type="checkbox"
                  checked={trustlineRequired}
                  onChange={(e) => setTrustlineRequired(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor={`${formId}-trustline`} className="text-sm font-medium text-slate-700">
                  Trustline required for recipients
                </label>
              </div>

              {trustlineRequired && (
                <div className="space-y-2">
                  <label
                    htmlFor={`${formId}-trustline-reason`}
                    className="block text-sm font-medium text-slate-700"
                  >
                    Guidance note for recipients
                  </label>
                  <textarea
                    id={`${formId}-trustline-reason`}
                    value={trustlineReason}
                    onChange={(e) => setTrustlineReason(e.target.value)}
                    rows={2}
                    placeholder="Explain why a trustline is needed and how to set one up."
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>
          )}

          {status === 'error' && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'loading' || (!isNative && (!assetCode.trim() || !issuer.trim()))}
            aria-busy={status === 'loading'}
            className="w-full rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'loading' ? 'Saving configuration…' : 'Save asset configuration'}
          </button>
        </fieldset>
      </form>
    </section>
  );
}

export default AssetConfigForm;
