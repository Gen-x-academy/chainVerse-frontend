'use client';

import { Lock } from 'lucide-react';
import { resolveCredentialStatuses } from '../logic';
import type { CredentialClaim } from '../types';
import { CredentialStatusBadge } from './CredentialStatusBadge';

/**
 * Full view of a single credential claim.
 *
 * Evidence documents are referenced but never rendered here: the API decides
 * what a reviewer may read, and the UI keeps the reference list-only.
 */
export function CredentialClaimDetail({ claim }: { claim: CredentialClaim }) {
  const resolved = resolveCredentialStatuses([claim]);
  const status = resolved[claim.internalId] ?? claim.status;

  return (
    <article className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <header className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
        <Lock className="h-5 w-5 text-gray-500" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-gray-900">Credential claim</h2>
      </header>
      <div className="space-y-6 p-6">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-900">Public id</dt>
            <dd className="text-sm text-gray-700">{claim.publicId}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-900">Credential</dt>
            <dd className="text-sm text-gray-700">
              {claim.credentialType} {claim.credentialRef}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-900">Mentor</dt>
            <dd className="text-sm text-gray-700">{claim.mentorId}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-900">Status</dt>
            <dd>
              <CredentialStatusBadge status={status} />
            </dd>
          </div>
        </dl>

        <section aria-labelledby="evidence-heading">
          <h3 id="evidence-heading" className="text-base font-semibold text-gray-900">
            Evidence
          </h3>
          {claim.evidence.length === 0 ? (
            <p className="text-sm text-gray-500">No evidence references.</p>
          ) : (
            <ul className="space-y-2">
              {claim.evidence.map((evidence) => (
                <li key={evidence} className="text-sm text-gray-700">
                  {evidence}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-gray-500">
            Access to the evidence documents is restricted to reviewers.
          </p>
        </section>
      </div>
    </article>
  );
}
