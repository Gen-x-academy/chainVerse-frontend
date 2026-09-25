'use client';

import { AssetConfigForm, AssetConfigList } from '@/src/features/scholarships/disbursements/assets';

export default function AssetConfigPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Stellar Asset Configuration
        </h1>
        <p className="mt-2 text-slate-600">
          Define native or issued assets approved for scholarship disbursements, including
          network, issuer, decimals, and trustline requirements.
        </p>
      </header>

      <section aria-labelledby="configure-heading">
        <h2 id="configure-heading" className="mb-4 text-xl font-semibold text-slate-800">
          Add asset configuration
        </h2>
        <AssetConfigForm programId="default" />
      </section>

      <section aria-labelledby="list-heading">
        <h2 id="list-heading" className="mb-4 text-xl font-semibold text-slate-800">
          Configured assets
        </h2>
        <AssetConfigList programId="default" />
      </section>
    </div>
  );
}
