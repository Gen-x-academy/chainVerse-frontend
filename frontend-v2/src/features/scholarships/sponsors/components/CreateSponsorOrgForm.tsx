'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Globe,
  Lock,
  Mail,
  Palette,
  Scale,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import type { CreateSponsorOrgPayload, LegalEntityType } from '../types';

export interface CreateSponsorOrgFormProps {
  tenantId: string;
  userEmail: string;
  onSubmit: (payload: CreateSponsorOrgPayload) => Promise<boolean>;
  isSubmitting?: boolean;
  className?: string;
}

export function CreateSponsorOrgForm({
  tenantId,
  userEmail,
  onSubmit,
  isSubmitting = false,
  className = '',
}: CreateSponsorOrgFormProps) {
  // Form State
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [legalEntityType, setLegalEntityType] = useState<LegalEntityType>('foundation');
  const [jurisdiction, setJurisdiction] = useState('US');
  const [contactEmail, setContactEmail] = useState(userEmail);
  const [website, setWebsite] = useState('');

  // Branding
  const [tagline, setTagline] = useState('');
  const [bio, setBio] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [publicEmail, setPublicEmail] = useState('');
  const [twitter, setTwitter] = useState('');
  const [github, setGithub] = useState('');

  // Private Contacts
  const [taxId, setTaxId] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [billingName, setBillingName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [billingPhone, setBillingPhone] = useState('');
  const [legalContactName, setLegalContactName] = useState('');
  const [legalContactEmail, setLegalContactEmail] = useState('');

  // Validation
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: string[] = [];

    if (!name.trim()) nextErrors.push('Organization Display Name is required.');
    if (!legalName.trim()) nextErrors.push('Official Legal Entity Name is required.');
    if (!jurisdiction.trim()) nextErrors.push('Legal Jurisdiction is required.');
    if (!contactEmail.trim() || !contactEmail.includes('@')) {
      nextErrors.push('A valid primary contact email is required.');
    }

    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors([]);

    const payload: CreateSponsorOrgPayload = {
      name: name.trim(),
      legalName: legalName.trim(),
      legalEntityType,
      jurisdiction: jurisdiction.trim().toUpperCase(),
      contactEmail: contactEmail.trim().toLowerCase(),
      publicEmail: (publicEmail || contactEmail).trim().toLowerCase(),
      website: website.trim() || undefined,
      branding: {
        tagline: tagline.trim() || undefined,
        bio: bio.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        bannerUrl: bannerUrl.trim() || undefined,
        socialLinks: {
          twitter: twitter.trim() || undefined,
          github: github.trim() || undefined,
        },
      },
      privateContacts: {
        taxId: taxId.trim() || undefined,
        registrationNumber: regNumber.trim() || undefined,
        billingContact: billingEmail.trim()
          ? {
              name: billingName.trim() || name.trim(),
              email: billingEmail.trim().toLowerCase(),
              phone: billingPhone.trim() || undefined,
            }
          : undefined,
        legalContact: legalContactEmail.trim()
          ? {
              name: legalContactName.trim() || legalName.trim(),
              email: legalContactEmail.trim().toLowerCase(),
            }
          : undefined,
      },
    };

    await onSubmit(payload);
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={`rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-8 ${className}`}
    >
      {/* Header with Tenant Scoping Indicator */}
      <div className="border-b border-slate-100 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Register Sponsor Organization</h2>
            <p className="text-xs text-slate-500">
              Establish a verified funding organization profile with tenant-scoped isolation.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            <Building2 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            <span>Tenant: {tenantId}</span>
          </div>
        </div>
      </div>

      {/* Validation Errors Alert */}
      {errors.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 space-y-1"
        >
          <div className="flex items-center gap-1.5 font-bold">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
            <span>Please resolve the following errors:</span>
          </div>
          <ul className="list-disc pl-5 space-y-0.5">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Section 1: Legal Identity & Primary Contacts */}
      <section aria-labelledby="heading-legal" className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <Scale className="h-4 w-4 text-indigo-600" aria-hidden="true" />
          <h3 id="heading-legal" className="text-sm font-bold text-slate-900">
            1. Legal Entity &amp; Core Identity
          </h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="org-name" className="block text-xs font-semibold text-slate-700 mb-1">
              Organization Public Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="org-name"
              type="text"
              placeholder="e.g. Stellar Impact Foundation"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="legal-name" className="block text-xs font-semibold text-slate-700 mb-1">
              Official Registered Legal Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="legal-name"
              type="text"
              placeholder="e.g. Stellar Impact Foundation Inc."
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="entity-type" className="block text-xs font-semibold text-slate-700 mb-1">
              Legal Entity Classification <span className="text-rose-500">*</span>
            </label>
            <select
              id="entity-type"
              value={legalEntityType}
              onChange={(e) => setLegalEntityType(e.target.value as LegalEntityType)}
              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-indigo-500"
            >
              <option value="foundation">Charitable Foundation / Trust</option>
              <option value="corporation">Corporation / LLC / Ltd</option>
              <option value="dao">Decentralized Autonomous Organization (DAO)</option>
              <option value="university">University / Higher Education Institution</option>
              <option value="non_profit">Non-Profit Organization (501c3 / NGO)</option>
              <option value="individual">Individual Philanthropist</option>
            </select>
          </div>

          <div>
            <label htmlFor="jurisdiction" className="block text-xs font-semibold text-slate-700 mb-1">
              Incorporation Jurisdiction (ISO Code) <span className="text-rose-500">*</span>
            </label>
            <input
              id="jurisdiction"
              type="text"
              placeholder="e.g. US, GB, SG, CH, DE"
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value.toUpperCase())}
              required
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="contact-email" className="block text-xs font-semibold text-slate-700 mb-1">
              Primary Administrative Email <span className="text-rose-500">*</span>
            </label>
            <input
              id="contact-email"
              type="email"
              placeholder="contact@stellarimpact.org"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="website" className="block text-xs font-semibold text-slate-700 mb-1">
              Official Website
            </label>
            <input
              id="website"
              type="url"
              placeholder="https://stellarimpact.org"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-indigo-500"
            />
          </div>
        </div>
      </section>

      {/* Section 2: Public Branding & Story */}
      <section aria-labelledby="heading-branding" className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <Palette className="h-4 w-4 text-indigo-600" aria-hidden="true" />
          <h3 id="heading-branding" className="text-sm font-bold text-slate-900">
            2. Public Branding &amp; Funding Profile
          </h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="tagline" className="block text-xs font-semibold text-slate-700 mb-1">
              Organization Tagline
            </label>
            <input
              id="tagline"
              type="text"
              placeholder="e.g. Catalyzing next-generation researchers in cryptographic protocols."
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-indigo-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="bio" className="block text-xs font-semibold text-slate-700 mb-1">
              Public Mission &amp; Bio
            </label>
            <textarea
              id="bio"
              rows={3}
              placeholder="Describe your organization's mission, scholarship objectives, and funding focus..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="logo-url" className="block text-xs font-semibold text-slate-700 mb-1">
              Logo Image URL
            </label>
            <input
              id="logo-url"
              type="url"
              placeholder="https://.../logo.png"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="banner-url" className="block text-xs font-semibold text-slate-700 mb-1">
              Banner Image URL
            </label>
            <input
              id="banner-url"
              type="url"
              placeholder="https://.../banner.jpg"
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="public-email" className="block text-xs font-semibold text-slate-700 mb-1">
              Public Grants Inquiry Email
            </label>
            <input
              id="public-email"
              type="email"
              placeholder="grants@stellarimpact.org"
              value={publicEmail}
              onChange={(e) => setPublicEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="twitter" className="block text-xs font-semibold text-slate-700 mb-1">
              Twitter / X Handle or URL
            </label>
            <input
              id="twitter"
              type="text"
              placeholder="@stellarimpact"
              value={twitter}
              onChange={(e) => setTwitter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-indigo-500"
            />
          </div>
        </div>
      </section>

      {/* Section 3: Contact Segregation & Private Contacts */}
      <section aria-labelledby="heading-private" className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <Lock className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          <h3 id="heading-private" className="text-sm font-bold text-slate-900">
            3. Confidential Private Contacts &amp; KYC (Strictly Redacted)
          </h3>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs text-emerald-950 flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" aria-hidden="true" />
          <p className="leading-relaxed">
            <strong>Privacy Guarantee:</strong> Information in this section is strictly tenant-scoped and encrypted. It is accessible exclusively to your organization&apos;s finance managers and verified platform compliance auditors. <em>These contacts are never rendered publicly or exposed to students.</em>
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="tax-id" className="block text-xs font-semibold text-slate-700 mb-1">
              Tax ID / EIN / VAT Number
            </label>
            <input
              id="tax-id"
              type="text"
              placeholder="e.g. US-EIN-84-9382910"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label htmlFor="reg-number" className="block text-xs font-semibold text-slate-700 mb-1">
              Company Registration ID
            </label>
            <input
              id="reg-number"
              type="text"
              placeholder="e.g. DE-CORP-9281920"
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label htmlFor="billing-name" className="block text-xs font-semibold text-slate-700 mb-1">
              Billing Contact Full Name
            </label>
            <input
              id="billing-name"
              type="text"
              placeholder="e.g. Marcus Vance"
              value={billingName}
              onChange={(e) => setBillingName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="billing-email" className="block text-xs font-semibold text-slate-700 mb-1">
              Billing &amp; Disbursement Email
            </label>
            <input
              id="billing-email"
              type="email"
              placeholder="billing@stellarimpact.org"
              value={billingEmail}
              onChange={(e) => setBillingEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-indigo-500"
            />
          </div>
        </div>
      </section>

      {/* Submit Footer */}
      <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isSubmitting ? 'Registering Organization...' : 'Create Sponsor Organization'}
        </button>
      </div>
    </form>
  );
}
