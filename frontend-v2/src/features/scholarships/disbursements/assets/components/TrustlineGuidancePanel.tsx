'use client';

import { useEffect, useId, useState } from 'react';
import { assetConfigService } from '../service';
import type { StellarAsset, TrustlineStatus } from '../types';

type Props = {
  walletAddress: string;
  asset: StellarAsset;
  guidanceNote?: string;
};

export function TrustlineGuidancePanel({ walletAddress, asset, guidanceNote }: Props) {
  const id = useId();
  const [status, setStatus] = useState<'loading' | 'established' | 'missing' | 'error'>('loading');
  const [trustlineData, setTrustlineData] = useState<TrustlineStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    assetConfigService
      .getTrustlineStatus(walletAddress, asset.code, asset.issuer)
      .then((data) => {
        if (!cancelled) {
          setTrustlineData(data);
          setStatus(data.established ? 'established' : 'missing');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : 'Could not check trustline status.');
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [walletAddress, asset.code, asset.issuer]);

  if (status === 'loading') {
    return (
      <div
        role="status"
        aria-label="Checking trustline status"
        className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500"
      >
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent align-middle mr-2" aria-hidden="true" />
        Checking trustline status for <span className="font-mono font-semibold">{asset.code}</span>…
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        role="alert"
        aria-label="Trustline check error"
        className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
      >
        {errorMessage}
      </div>
    );
  }

  if (status === 'established') {
    return (
      <div
        role="status"
        aria-label="Trustline established"
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800"
      >
        <p className="font-semibold">
          Trustline for <span className="font-mono">{asset.code}</span> is established.
        </p>
        {trustlineData?.balance !== undefined && (
          <p className="mt-1 text-emerald-700">
            Balance: <span className="font-mono">{trustlineData.balance} {asset.code}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="mx-auto w-full max-w-2xl space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-5"
    >
      <header>
        <h3
          id={`${id}-heading`}
          className="text-base font-semibold text-amber-900"
        >
          Trustline required for {asset.code}
        </h3>
      </header>

      <p className="text-sm text-amber-800">
        {guidanceNote ??
          `Your wallet must establish a trustline for ${asset.code} before you can receive this scholarship payment.`}
      </p>

      <div className="space-y-2 text-sm text-amber-700">
        <p className="font-medium text-amber-900">How to establish a trustline:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Open a Stellar-compatible wallet (e.g. Lobstr, Solar Wallet, or Freighter).</li>
          <li>Go to <strong>Add asset</strong> and search for <span className="font-mono font-medium">{asset.code}</span>.</li>
          {asset.issuer && (
            <li>
              Confirm the issuer account:{' '}
              <span
                className="break-all font-mono text-xs"
                aria-label={`Issuer account ${asset.issuer}`}
              >
                {asset.issuer}
              </span>
            </li>
          )}
          <li>Approve the trustline. Your wallet will reserve a small XLM balance.</li>
          <li>Return here and reload this page once the trustline is confirmed.</li>
        </ol>
      </div>

      <p className="text-xs text-amber-600">
        Payments will not be processed until the trustline is verified. Your award eligibility
        is preserved during this step.
      </p>
    </section>
  );
}

export default TrustlineGuidancePanel;
