'use client';

import React from 'react';
import {
  Building2,
  FileText,
  Lock,
  Mail,
  Phone,
  Scale,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import type { SponsorPrivateContacts } from '../types';

export interface PrivateContactsCardProps {
  privateContacts?: SponsorPrivateContacts;
  isAuthorized: boolean;
  tenantId?: string;
  onEdit?: () => void;
  className?: string;
}

export function PrivateContactsCard({
  privateContacts,
  isAuthorized,
  tenantId,
  onEdit,
  className = '',
}: PrivateContactsCardProps) {
  if (!isAuthorized) {
    return (
      <div
        role="region"
        aria-label="Private contacts confidential section"
        className={`rounded-2xl border border-slate-200 bg-slate-50/60 p-6 text-center space-y-2 ${className}`}
      >
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200/70 text-slate-500">
          <Lock className="h-5 w-5" aria-hidden="true" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">Private Contacts Redacted</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Confidential billing, legal, and compliance contacts are restricted to tenant administrators and verified compliance auditors.
        </p>
      </div>
    );
  }

  const billing = privateContacts?.billingContact;
  const legal = privateContacts?.legalContact;
  const compliance = privateContacts?.complianceContact;
  const taxId = privateContacts?.taxId;
  const regNumber = privateContacts?.registrationNumber;

  return (
    <div
      role="region"
      aria-label="Tenant private contacts"
      className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">Tenant-Scoped Private Contacts</h3>
            <p className="text-[11px] text-slate-500">
              Confidential internal data &bull; Scoped to tenant <strong>{tenantId || 'Active'}</strong>
            </p>
          </div>
        </div>

        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit Contacts
          </button>
        )}
      </div>

      {/* Privacy Notice Banner */}
      <div
        role="note"
        className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-900 flex items-start gap-2.5"
      >
        <Shield className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" aria-hidden="true" />
        <div className="leading-relaxed">
          <span className="font-semibold">Zero Public Exposure Guarantee:</span> These contacts and registration identifiers are encrypted and accessible exclusively to your organization&apos;s finance/owner team and platform compliance officers. They are never rendered on public directories or revealed to student applicants.
        </div>
      </div>

      {/* Contacts Grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Billing Contact */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <Building2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" aria-hidden="true" />
            <span>Billing &amp; Payouts</span>
          </div>
          {billing ? (
            <div className="space-y-1 text-slate-600">
              <p className="font-semibold text-slate-900">{billing.name}</p>
              <div className="flex items-center gap-1">
                <Mail className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />
                <a href={`mailto:${billing.email}`} className="text-indigo-600 hover:underline">
                  {billing.email}
                </a>
              </div>
              {billing.phone && (
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />
                  <span>{billing.phone}</span>
                </div>
              )}
              {billing.billingAddress && (
                <p className="text-[11px] text-slate-500 pt-1 leading-normal">{billing.billingAddress}</p>
              )}
            </div>
          ) : (
            <p className="text-slate-400 italic">No billing contact specified.</p>
          )}
        </div>

        {/* Legal Contact */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <Scale className="h-3.5 w-3.5 text-indigo-600 shrink-0" aria-hidden="true" />
            <span>Legal Signatory</span>
          </div>
          {legal ? (
            <div className="space-y-1 text-slate-600">
              <p className="font-semibold text-slate-900">{legal.name}</p>
              <div className="flex items-center gap-1">
                <Mail className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />
                <a href={`mailto:${legal.email}`} className="text-indigo-600 hover:underline">
                  {legal.email}
                </a>
              </div>
              {legal.phone && (
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />
                  <span>{legal.phone}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-400 italic">No legal contact specified.</p>
          )}
        </div>

        {/* Compliance Contact */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-600 shrink-0" aria-hidden="true" />
            <span>Compliance Officer</span>
          </div>
          {compliance ? (
            <div className="space-y-1 text-slate-600">
              <p className="font-semibold text-slate-900">{compliance.name}</p>
              <div className="flex items-center gap-1">
                <Mail className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />
                <a href={`mailto:${compliance.email}`} className="text-indigo-600 hover:underline">
                  {compliance.email}
                </a>
              </div>
              {compliance.phone && (
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />
                  <span>{compliance.phone}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-400 italic">No compliance contact specified.</p>
          )}
        </div>
      </div>

      {/* Confidential Legal Identifiers */}
      <div className="flex flex-wrap items-center gap-6 rounded-xl border border-slate-100 bg-slate-50/30 p-3 text-xs">
        <div>
          <span className="text-slate-500">Tax ID / EIN: </span>
          <span className="font-mono font-semibold text-slate-800">
            {taxId || 'Not provided'}
          </span>
        </div>
        <div>
          <span className="text-slate-500">Registration Number: </span>
          <span className="font-mono font-semibold text-slate-800">
            {regNumber || 'Not provided'}
          </span>
        </div>
      </div>
    </div>
  );
}
